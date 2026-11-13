from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_customer
from app.db.session import get_db
from app.models import (
    ACTIVE_BOOKING_STATUSES, Address, Booking, BookingStatus, BookingStatusEvent, ProviderSpecialty,
    ServiceCategory, ServiceEngagementLog, SlotLock, User,
)
from app.schemas.booking import BookingCreate, BookingDetail, BookingRead, ReasonIn, SlotLockCreate, SlotLockRead
from app.schemas.quotation import QuotationRead
from app.services import booking_service as bs
from app.services import geo, quotation_service
from app.services.catalog_service import related_category_ids

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _lock_out(lock: SlotLock) -> SlotLockRead:
    left = int((bs.aware(lock.expires_at) - bs.utcnow()).total_seconds())
    return SlotLockRead(
        id=lock.id, provider_id=lock.provider_id, start_at=lock.start_at, end_at=lock.end_at,
        expires_at=lock.expires_at, seconds_left=max(left, 0),
    )


def _owned_booking(db: Session, user: User, booking_id: int) -> Booking:
    booking = db.scalar(
        select(Booking).where(Booking.id == booking_id, Booking.customer_id == user.id).options(*bs.booking_loader())
    )
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return booking


def _reload(db: Session, user: User, booking_id: int) -> Booking:
    db.expire_all()
    return _owned_booking(db, user, booking_id)


# Slot holds
@router.post("/slot-locks", response_model=SlotLockRead, status_code=status.HTTP_201_CREATED)
def hold_slot(payload: SlotLockCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    """Reserve a slot for SLOT_LOCK_MINUTES while the customer finishes the form. One hold per customer."""
    if payload.end <= payload.start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "end must be after start")
    provider = bs.lock_provider_row(db, payload.provider_id)  # serialises racing customers
    if not provider.is_accepting_jobs:
        raise HTTPException(status.HTTP_409_CONFLICT, "This technician is not accepting jobs right now")
    bs.purge_expired_locks(db)
    bs.release_user_locks(db, user.id)
    db.flush()
    if not bs.slot_is_offered(db, provider.id, payload.start, payload.end):
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That slot is no longer available. Please pick another.")
    lock = SlotLock(
        provider_id=provider.id, locked_by_id=user.id, start_at=payload.start, end_at=payload.end,
        expires_at=bs.utcnow() + timedelta(minutes=settings.SLOT_LOCK_MINUTES),
    )
    db.add(lock)
    db.commit()
    return _lock_out(lock)


@router.delete("/slot-locks/{lock_id}", status_code=status.HTTP_204_NO_CONTENT)
def release_slot(lock_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    lock = db.get(SlotLock, lock_id)
    if lock is None or lock.locked_by_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot hold not found")
    db.delete(lock)
    db.commit()


# Create + read
@router.post("", response_model=BookingDetail, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    provider = bs.lock_provider_row(db, payload.provider_id)

    lock = db.get(SlotLock, payload.slot_lock_id)
    if lock is None or lock.locked_by_id != user.id or lock.provider_id != provider.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your slot hold was not found. Please pick a time again.")
    if bs.aware(lock.expires_at) <= bs.utcnow():
        db.delete(lock)
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, "Your slot hold expired. Please pick a time again.")

    address = db.get(Address, payload.address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
    category = db.get(ServiceCategory, payload.category_id)
    if category is None or not category.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")

    related = set(related_category_ids(db, category.id))
    if not any(s.category_id in related for s in provider.specialties):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "This technician does not offer that service")
    point = (float(address.latitude), float(address.longitude)) if address.latitude is not None and address.longitude is not None else None
    near = geo.nearest_area(address.area, point, [a.area for a in provider.service_areas if a.city.lower() == address.city.lower()])
    if near is None or near[1] > settings.MATCH_MAX_RADIUS_KM:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"This technician does not cover {address.area}")

    open_count = db.scalar(
        select(func.count()).select_from(Booking).where(Booking.customer_id == user.id, Booking.status.in_(ACTIVE_BOOKING_STATUSES))
    )
    if open_count >= settings.MAX_ACTIVE_BOOKINGS_PER_CUSTOMER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You have too many open bookings. Complete or cancel one first.")
    if bs.has_conflicting_booking(db, provider.id, lock.start_at, lock.end_at):
        db.delete(lock)
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, "That slot was just taken. Please pick another.")

    booking = Booking(
        customer_id=user.id, provider_id=provider.id, category_id=category.id, address_id=address.id,
        scheduled_start=lock.start_at, scheduled_end=lock.end_at, status=BookingStatus.PENDING,
        notes=payload.notes, complexity=payload.complexity, service_area=address.area,
        address_text=f"{address.street}, {address.area}, {address.city}",
    )
    db.add(booking)
    db.flush()
    db.delete(lock)  # the booking itself now holds the slot (PENDING counts as active)
    db.add(BookingStatusEvent(booking_id=booking.id, from_status=None, to_status=BookingStatus.PENDING,
                              actor_id=user.id, actor_role="customer", note="Request placed"))
    db.add(ServiceEngagementLog(customer_id=user.id, provider_id=provider.id, category_id=category.id,
                                booking_id=booking.id, event_type="booked", summary=category.name))
    db.commit()
    return bs.serialize_booking(_reload(db, user, booking.id), "customer", detail=True)


@router.get("", response_model=list[BookingRead])
def my_bookings(
    status_filter: str | None = Query(None, alias="status", description="Comma-separated statuses"),
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    stmt = select(Booking).where(Booking.customer_id == user.id)
    if status_filter:
        try:
            wanted = [BookingStatus(s.strip()) for s in status_filter.split(",") if s.strip()]
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown status filter")
        stmt = stmt.where(Booking.status.in_(wanted))
    bookings = db.scalars(stmt.order_by(Booking.scheduled_start.desc()).limit(100).options(*bs.booking_loader())).all()
    bs.expire_all(db, list(bookings))
    return [bs.serialize_booking(b, "customer") for b in bookings]


@router.get("/{booking_id}", response_model=BookingDetail)
def booking_detail(booking_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    booking = _owned_booking(db, user, booking_id)
    bs.expire_all(db, [booking])
    return bs.serialize_booking(booking, "customer", detail=True)


# Actions
@router.post("/{booking_id}/cancel", response_model=BookingDetail)
def cancel_booking(booking_id: int, payload: ReasonIn, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    booking = _owned_booking(db, user, booking_id)
    bs.cancel(db, booking, actor_role="customer", actor_id=user.id, reason=payload.reason)
    db.commit()
    return bs.serialize_booking(_reload(db, user, booking_id), "customer", detail=True)


@router.get("/{booking_id}/quotations", response_model=list[QuotationRead])
def quotation_history(booking_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return list(_owned_booking(db, user, booking_id).quotations)


@router.post("/{booking_id}/quotation/accept", response_model=BookingDetail)
def accept_quotation(booking_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    booking = _owned_booking(db, user, booking_id)
    quotation_service.accept_quotation(db, booking, user.id)
    db.commit()
    return bs.serialize_booking(_reload(db, user, booking_id), "customer", detail=True)


@router.post("/{booking_id}/quotation/reject", response_model=BookingDetail)
def reject_quotation(booking_id: int, payload: ReasonIn, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    booking = _owned_booking(db, user, booking_id)
    quotation_service.reject_quotation(db, booking, user.id, payload.reason)
    db.commit()
    return bs.serialize_booking(_reload(db, user, booking_id), "customer", detail=True)
