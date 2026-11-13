from __future__ import annotations

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import (
    ACTIVE_BOOKING_STATUSES,
    Booking,
    BookingStatus,
    BookingStatusEvent,
    ProviderProfile,
    Quotation,
    QuotationStatus,
    ServiceCategory,
    SlotLock,
)
from app.schemas.booking import BookingDetail, BookingRead
from app.services.slot_service import generate_slots

S = BookingStatus

TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    S.PENDING: {S.QUOTED, S.CANCELLED},
    S.QUOTED: {S.CONFIRMED, S.PENDING, S.CANCELLED},  # QUOTED -> PENDING = customer rejected / quote expired
    S.CONFIRMED: {S.IN_PROGRESS, S.CANCELLED},
    S.IN_PROGRESS: {S.COMPLETED},
    S.COMPLETED: set(),
    S.CANCELLED: set(),
    S.DISPUTED: set(),  # Module 3
}
REVEAL_CONTACT_STATUSES = (S.CONFIRMED, S.IN_PROGRESS, S.COMPLETED)
CENT = Decimal("0.01")


def money(v) -> Decimal:
    return Decimal(v).quantize(CENT, rounding=ROUND_HALF_UP)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def local_tz() -> ZoneInfo:
    return ZoneInfo(settings.APP_TIMEZONE)


def aware(dt: datetime | None) -> datetime | None:
    """Naive values (e.g. SQLite in tests) are treated as UTC; PostgreSQL always returns aware ones."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def booking_loader():
    return (
        selectinload(Booking.customer),
        selectinload(Booking.provider).selectinload(ProviderProfile.user),
        selectinload(Booking.category).selectinload(ServiceCategory.parent),
        selectinload(Booking.quotations).selectinload(Quotation.items),
        selectinload(Booking.events),
    )


# State machine
def transition(
    db: Session, booking: Booking, to: BookingStatus, *, actor_role: str, actor_id: int | None, note: str | None = None
) -> None:
    if to not in TRANSITIONS[booking.status]:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A {booking.status.value.replace('_', ' ')} booking cannot become {to.value.replace('_', ' ')}"
        )
    db.add(
        BookingStatusEvent(
            booking_id=booking.id, from_status=booking.status, to_status=to,
            actor_id=actor_id, actor_role=actor_role, note=note,
        )
    )
    booking.status = to
    # Keep the in-memory relationship fresh for serialisation within the same request.
    db.flush()


def latest_quotation(booking: Booking) -> Quotation | None:
    return booking.quotations[-1] if booking.quotations else None


def expire_stale_quote(db: Session, booking: Booking) -> bool:
    """Lazy expiry: an unanswered quotation past valid_until lapses and the request reopens for a new one."""
    q = latest_quotation(booking)
    if q and q.status == QuotationStatus.SUBMITTED and aware(q.valid_until) < utcnow():
        q.status = QuotationStatus.EXPIRED
        q.responded_at = utcnow()
        if booking.status == S.QUOTED:
            booking.quoted_amount = None
            transition(db, booking, S.PENDING, actor_role="system", actor_id=None, note=f"Quotation v{q.version} expired")
        return True
    return False


def expire_all(db: Session, bookings: list[Booking]) -> None:
    if any([expire_stale_quote(db, b) for b in bookings]):
        db.commit()


# Permissions (also sent to the UI so it never has to re-implement the rules)
def allowed_actions(booking: Booking, role: str) -> list[str]:
    st = booking.status
    if role == "customer":
        return {
            S.PENDING: ["cancel"],
            S.QUOTED: ["accept_quote", "reject_quote", "cancel"],
            S.CONFIRMED: ["cancel"],
        }.get(st, [])
    if role == "provider":
        actions = {
            S.PENDING: ["accept", "decline"],
            S.QUOTED: ["revise_quote", "decline"],
            S.CONFIRMED: ["start", "cancel"],
            S.IN_PROGRESS: ["complete"],
        }.get(st, [])
        if st == S.CONFIRMED and settings.ENFORCE_START_WINDOW:
            earliest = aware(booking.scheduled_start).timestamp() - settings.EARLY_START_MINUTES * 60
            if utcnow().timestamp() < earliest:
                actions = [a for a in actions if a != "start"]
        return actions
    return []


# Slot capacity checks
def lock_provider_row(db: Session, provider_id: int) -> ProviderProfile:
    """Row-level lock: serialises concurrent hold/book attempts for the same provider (PostgreSQL FOR UPDATE)."""
    provider = db.scalar(select(ProviderProfile).where(ProviderProfile.id == provider_id).with_for_update())
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")
    return provider


def purge_expired_locks(db: Session) -> None:
    db.execute(delete(SlotLock).where(SlotLock.expires_at <= utcnow()))


def release_user_locks(db: Session, user_id: int) -> None:
    db.execute(delete(SlotLock).where(SlotLock.locked_by_id == user_id))


def has_conflicting_booking(db: Session, provider_id: int, start: datetime, end: datetime) -> bool:
    return (
        db.scalar(
            select(Booking.id)
            .where(
                Booking.provider_id == provider_id,
                Booking.status.in_(ACTIVE_BOOKING_STATUSES),
                Booking.scheduled_start < end,
                Booking.scheduled_end > start,
            )
            .limit(1)
        )
        is not None
    )


def slot_is_offered(db: Session, provider_id: int, start: datetime, end: datetime) -> bool:
    """True only if the exact window is one the provider's weekly template currently offers as free."""
    day = start.astimezone(local_tz()).date()
    for entry in generate_slots(db, provider_id, day, 1):
        for slot in entry["slots"]:
            if slot["start"] == start and slot["end"] == end:
                return True
    return False


# Serialisation
def _party(user, *, phone_visible: bool, headline: str | None = None) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "headline": headline,
        "phone": user.phone if phone_visible else None,
        "avatar_url": user.avatar_url,
    }


def serialize_booking(booking: Booking, role: str, *, detail: bool = False) -> BookingRead | BookingDetail:
    revealed = booking.status in REVEAL_CONTACT_STATUSES
    cat = booking.category
    data = {
        "id": booking.id,
        "status": booking.status,
        "category": {"id": cat.id, "name": cat.name, "parent_name": cat.parent.name if cat.parent else None} if cat else None,
        # Customer sees their own details; the provider's own view is masked until the customer commits.
        "customer": _party(booking.customer, phone_visible=(role == "customer") or revealed),
        "provider": _party(
            booking.provider.user, phone_visible=(role == "provider") or revealed, headline=booking.provider.headline
        ),
        "service_area": booking.service_area,
        "address_text": booking.address_text if (role == "customer" or revealed) else None,
        "scheduled_start": booking.scheduled_start,
        "scheduled_end": booking.scheduled_end,
        "notes": booking.notes,
        "complexity": booking.complexity,
        "quoted_amount": booking.quoted_amount,
        "final_amount": booking.final_amount,
        "platform_fee": booking.platform_fee if role == "provider" else None,
        "net_amount": booking.net_amount if role == "provider" else None,
        "cancelled_by": booking.cancelled_by,
        "cancel_reason": booking.cancel_reason,
        "started_at": booking.started_at,
        "completed_at": booking.completed_at,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
        "active_quotation": latest_quotation(booking),
        "allowed_actions": allowed_actions(booking, role),
    }
    if detail:
        data["events"] = list(booking.events)
        data["quotations"] = list(booking.quotations)
        return BookingDetail.model_validate(data)
    return BookingRead.model_validate(data)


def cancel(db: Session, booking: Booking, *, actor_role: str, actor_id: int, reason: str) -> None:
    """Cancel from any cancellable state; frees the slot (CANCELLED is not an active status) and withdraws an open quote."""
    transition(db, booking, S.CANCELLED, actor_role=actor_role, actor_id=actor_id, note=reason)
    booking.cancelled_by = actor_role
    booking.cancel_reason = reason
    q = latest_quotation(booking)
    if q and q.status == QuotationStatus.SUBMITTED:
        q.status = QuotationStatus.WITHDRAWN
        q.responded_at = utcnow()
