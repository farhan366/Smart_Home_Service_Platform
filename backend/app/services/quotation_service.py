"""Itemised quotations: build, submit, revise, accept, reject."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Booking, BookingStatus, BookingStatusEvent, ProviderProfile, Quotation, QuotationItem, QuotationStatus, QuoteItemType
from app.schemas.quotation import QuotationCreate, QuoteItemIn
from app.services import booking_service as bs
from app.services.scoring import estimate_price


def effective_hourly_rate(provider: ProviderProfile, category_id: int | None, related_ids: set[int]) -> Decimal:
    """Per-specialty override if the provider set one for a matching category, else the base rate."""
    rates = [
        s.custom_hourly_rate
        for s in provider.specialties
        if s.custom_hourly_rate is not None and (s.category_id == category_id or s.category_id in related_ids)
    ]
    return min(rates) if rates else provider.base_hourly_rate


def _build_items(items: list[QuoteItemIn]) -> tuple[list[QuotationItem], Decimal, Decimal]:
    rows, labor, material = [], Decimal("0"), Decimal("0")
    for it in items:
        line = bs.money(it.quantity * it.unit_price)
        rows.append(
            QuotationItem(
                item_type=it.item_type, description=it.description, quantity=it.quantity,
                unit=it.unit, unit_price=it.unit_price, line_total=line,
            )
        )
        if it.item_type == QuoteItemType.LABOR:
            labor += line
        else:
            material += line
    return rows, labor, material


def submit_quotation(db: Session, booking: Booking, provider: ProviderProfile, payload: QuotationCreate, actor_id: int) -> Quotation:
    """First quote moves PENDING -> QUOTED; a revision supersedes the open quote and the booking stays QUOTED."""
    if booking.status not in (BookingStatus.PENDING, BookingStatus.QUOTED):
        raise HTTPException(status.HTTP_409_CONFLICT, "A quotation can only be sent while the request is pending or quoted")
    bs.expire_stale_quote(db, booking)
    if booking.status not in (BookingStatus.PENDING, BookingStatus.QUOTED):
        raise HTTPException(status.HTTP_409_CONFLICT, "This request is no longer open for quotation")

    prior = bs.latest_quotation(booking)
    if prior and prior.status == QuotationStatus.SUBMITTED:
        prior.status = QuotationStatus.WITHDRAWN
        prior.responded_at = bs.utcnow()
        db.flush()  # free the one-open-quote-per-booking unique index before inserting the revision

    rows, labor, material = _build_items(payload.items)
    hours = payload.valid_hours or settings.QUOTE_VALIDITY_HOURS
    valid_until = min(bs.utcnow() + timedelta(hours=hours), bs.aware(booking.scheduled_start))
    if valid_until <= bs.utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "The scheduled slot has already started; this request can no longer be quoted")

    quote = Quotation(
        booking_id=booking.id, provider_id=provider.id, version=(prior.version + 1) if prior else 1,
        status=QuotationStatus.SUBMITTED, labor_total=bs.money(labor), material_total=bs.money(material),
        total=bs.money(labor + material), note=payload.note, valid_until=valid_until, items=rows,
    )
    db.add(quote)
    db.flush()
    booking.quotations.append(quote)
    booking.quoted_amount = quote.total

    if booking.status == BookingStatus.PENDING:
        bs.transition(db, booking, BookingStatus.QUOTED, actor_role="provider", actor_id=actor_id,
                      note=f"Quotation v{quote.version} sent: ৳{quote.total}")
    else:
        db.add(BookingStatusEvent(booking_id=booking.id, from_status=booking.status, to_status=booking.status,
                                     actor_id=actor_id, actor_role="provider", note=f"Revised quotation v{quote.version}: ৳{quote.total}"))
    return quote


def standard_quote_payload(provider: ProviderProfile, booking: Booking, rate: Decimal, note: str | None) -> QuotationCreate:
    """'Accept at my standard rate': one labour line from the hourly rate and the job's complexity,
    never below the provider's minimum visit charge."""
    hours, price = estimate_price(float(rate), float(provider.min_fixed_rate), booking.complexity)
    if Decimal(str(hours)) * rate >= provider.min_fixed_rate:
        item = QuoteItemIn(item_type=QuoteItemType.LABOR, description="Service labour (standard estimate)",
                           quantity=Decimal(str(hours)), unit="hr", unit_price=rate)
    else:
        item = QuoteItemIn(item_type=QuoteItemType.LABOR, description="Minimum visit charge",
                           quantity=Decimal("1"), unit="visit", unit_price=Decimal(str(price)))
    return QuotationCreate(items=[item], note=note)


def accept_quotation(db: Session, booking: Booking, customer_id: int) -> Quotation:
    bs.expire_stale_quote(db, booking)
    quote = bs.latest_quotation(booking)
    if booking.status != BookingStatus.QUOTED or quote is None or quote.status != QuotationStatus.SUBMITTED:
        raise HTTPException(status.HTTP_409_CONFLICT, "There is no open quotation to accept (it may have expired or been revised)")
    quote.status = QuotationStatus.ACCEPTED
    quote.responded_at = bs.utcnow()
    booking.quoted_amount = quote.total
    bs.transition(db, booking, BookingStatus.CONFIRMED, actor_role="customer", actor_id=customer_id,
                  note=f"Quotation v{quote.version} accepted: ৳{quote.total}")
    return quote


def reject_quotation(db: Session, booking: Booking, customer_id: int, reason: str) -> Quotation:
    bs.expire_stale_quote(db, booking)
    quote = bs.latest_quotation(booking)
    if booking.status != BookingStatus.QUOTED or quote is None or quote.status != QuotationStatus.SUBMITTED:
        raise HTTPException(status.HTTP_409_CONFLICT, "There is no open quotation to reject")
    quote.status = QuotationStatus.REJECTED
    quote.responded_at = bs.utcnow()
    quote.rejection_reason = reason
    booking.quoted_amount = None
    # Reopens the request so the technician can send a revised estimate; the customer may also just cancel.
    bs.transition(db, booking, BookingStatus.PENDING, actor_role="customer", actor_id=customer_id,
                  note=f"Quotation v{quote.version} rejected: {reason}")
    return quote
