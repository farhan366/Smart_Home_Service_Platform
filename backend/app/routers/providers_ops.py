"""Technician workspace: incoming requests, quotations, daily schedule, job progress and revenue."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.deps import require_provider
from app.db.session import get_db
from app.models import Booking, BookingStatus, ProviderProfile, ServiceEngagementLog, User
from app.schemas.booking import (
    BookingDetail, BookingRead, CompleteIn, QuickAcceptIn, ReasonIn, RevenueResponse, ScheduleResponse,
)
from app.schemas.quotation import QuotationCreate
from app.services import booking_service as bs
from app.services import quotation_service, revenue_service
from app.services.catalog_service import related_category_ids
from app.services.provider_service import get_profile_or_404

router = APIRouter(prefix="/provider", tags=["Technician workspace"])


def _my_booking(db: Session, profile: ProviderProfile, booking_id: int) -> Booking:
    booking = db.scalar(
        select(Booking).where(Booking.id == booking_id, Booking.provider_id == profile.id).options(*bs.booking_loader())
    )
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return booking


def _detail(db: Session, profile: ProviderProfile, booking_id: int) -> BookingDetail:
    db.expire_all()
    return bs.serialize_booking(_my_booking(db, profile, booking_id), "provider", detail=True)


def _require_action(booking: Booking, action: str) -> None:
    if action not in bs.allowed_actions(booking, "provider"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You can't {action.replace('_', ' ')} a booking that is {booking.status.value.replace('_', ' ')}"
            + (" (too early to start)" if action == "start" and booking.status == BookingStatus.CONFIRMED else ""),
        )


# Lists
@router.get("/bookings", response_model=list[BookingRead])
def my_jobs(
    status_filter: str | None = Query(None, alias="status", description="Comma-separated, e.g. pending,quoted"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    user: User = Depends(require_provider),
    db: Session = Depends(get_db),
):
    profile = get_profile_or_404(db, user)
    stmt = select(Booking).where(Booking.provider_id == profile.id)
    if status_filter:
        try:
            wanted = [BookingStatus(s.strip()) for s in status_filter.split(",") if s.strip()]
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown status filter")
        stmt = stmt.where(Booking.status.in_(wanted))
    ordering = Booking.scheduled_start.asc() if order == "asc" else Booking.scheduled_start.desc()
    jobs = db.scalars(stmt.order_by(ordering).limit(100).options(*bs.booking_loader())).all()
    bs.expire_all(db, list(jobs))
    return [bs.serialize_booking(b, "provider") for b in jobs]


@router.get("/bookings/{booking_id}", response_model=BookingDetail)
def job_detail(booking_id: int, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = get_profile_or_404(db, user)
    booking = _my_booking(db, profile, booking_id)
    bs.expire_all(db, [booking])
    return bs.serialize_booking(booking, "provider", detail=True)


# Quotation / accept / decline
@router.post("/bookings/{booking_id}/quotation", response_model=BookingDetail)
def send_quotation(booking_id: int, payload: QuotationCreate, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    """Itemised labour + material estimate. Also used to revise an open quotation."""
    profile = get_profile_or_404(db, user)
    booking = _my_booking(db, profile, booking_id)
    quotation_service.submit_quotation(db, booking, profile, payload, user.id)
    db.commit()
    return _detail(db, profile, booking_id)


@router.post("/bookings/{booking_id}/accept", response_model=BookingDetail)
def accept_at_standard_rate(
    booking_id: int, payload: QuickAcceptIn | None = None, user: User = Depends(require_provider), db: Session = Depends(get_db)
):
    """Accept a pending request and send a one-line estimate from the technician's standard rate."""
    profile = get_profile_or_404(db, user)
    booking = _my_booking(db, profile, booking_id)
    _require_action(booking, "accept")
    related = set(related_category_ids(db, booking.category_id)) if booking.category_id else set()
    rate = quotation_service.effective_hourly_rate(profile, booking.category_id, related)
    body = quotation_service.standard_quote_payload(profile, booking, rate, payload.note if payload else None)
    quotation_service.submit_quotation(db, booking, profile, body, user.id)
    db.commit()
    return _detail(db, profile, booking_id)


@router.post("/bookings/{booking_id}/decline", response_model=BookingDetail)
def decline_request(booking_id: int, payload: ReasonIn, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = get_profile_or_404(db, user)
    booking = _my_booking(db, profile, booking_id)
    _require_action(booking, "decline")
    bs.cancel(db, booking, actor_role="provider", actor_id=user.id, reason=payload.reason)
    db.commit()
    return _detail(db, profile, booking_id)


# Field execution
@router.post("/bookings/{booking_id}/start", response_model=BookingDetail)
def start_job(booking_id: int, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = get_profile_or_404(db, user)
    booking = _my_booking(db, profile, booking_id)
    _require_action(booking, "start")
    booking.started_at = bs.utcnow()
    bs.transition(db, booking, BookingStatus.IN_PROGRESS, actor_role="provider", actor_id=user.id, note="Technician started the job")
    db.commit()
    return _detail(db, profile, booking_id)


@router.post("/bookings/{booking_id}/complete", response_model=BookingDetail)
def complete_job(booking_id: int, payload: CompleteIn | None = None, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = bs.lock_provider_row(db, get_profile_or_404(db, user).id)
    booking = _my_booking(db, profile, booking_id)
    _require_action(booking, "complete")
    gross = bs.money(booking.quoted_amount or 0)
    fee = bs.money(gross * Decimal(str(settings.PLATFORM_COMMISSION_PERCENT)) / Decimal(100))
    booking.final_amount, booking.platform_fee, booking.net_amount = gross, fee, gross - fee
    booking.completed_at = bs.utcnow()
    profile.completed_jobs = (profile.completed_jobs or 0) + 1
    note = (payload.note if payload and payload.note else None) or "Job completed"
    bs.transition(db, booking, BookingStatus.COMPLETED, actor_role="provider", actor_id=user.id, note=note)
    db.add(ServiceEngagementLog(customer_id=booking.customer_id, provider_id=profile.id, category_id=booking.category_id,
                                booking_id=booking.id, event_type="completed", summary=f"Settled ৳{gross}"))
    db.commit()
    return _detail(db, profile, booking_id)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingDetail)
def cancel_confirmed_job(booking_id: int, payload: ReasonIn, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = get_profile_or_404(db, user)
    booking = _my_booking(db, profile, booking_id)
    _require_action(booking, "cancel")
    bs.cancel(db, booking, actor_role="provider", actor_id=user.id, reason=payload.reason)
    db.commit()
    return _detail(db, profile, booking_id)


# Schedule + revenue
@router.get("/schedule", response_model=ScheduleResponse)
def daily_schedule(
    day: date | None = Query(None, alias="date", description="Defaults to today (app timezone)"),
    user: User = Depends(require_provider),
    db: Session = Depends(get_db),
):
    profile = get_profile_or_404(db, user)
    tz = bs.local_tz()
    day = day or datetime.now(tz).date()
    window_start = datetime.combine(day, time.min, tzinfo=tz)
    window_end = datetime.combine(day + timedelta(days=7), time.min, tzinfo=tz)

    week = db.scalars(
        select(Booking)
        .where(
            Booking.provider_id == profile.id,
            Booking.scheduled_start >= window_start,
            Booking.scheduled_start < window_end,
            Booking.status != BookingStatus.CANCELLED,
        )
        .order_by(Booking.scheduled_start)
        .options(*bs.booking_loader())
    ).all()
    bs.expire_all(db, list(week))

    todays = [b for b in week if bs.aware(b.scheduled_start).astimezone(tz).date() == day]
    net = sum((b.net_amount or Decimal(0) for b in todays if b.status == BookingStatus.COMPLETED), Decimal(0))
    return ScheduleResponse(
        date=day.isoformat(),
        bookings=[bs.serialize_booking(b, "provider") for b in todays],
        summary=revenue_service.day_counts(list(week), day),
        overview=[revenue_service.day_counts(list(week), day + timedelta(days=i)) for i in range(7)],
        day_net_so_far=bs.money(net),
    )


@router.get("/revenue", response_model=RevenueResponse)
def revenue(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="YYYY-MM, defaults to the current month"),
    user: User = Depends(require_provider),
    db: Session = Depends(get_db),
):
    return revenue_service.revenue_summary(db, get_profile_or_404(db, user), month)
