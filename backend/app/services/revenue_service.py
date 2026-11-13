from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Booking, BookingStatus, ProviderProfile
from app.schemas.booking import DailyPoint, DayBookings, MoneyBucket, MonthlyPoint, RevenueResponse
from app.services.booking_service import aware, local_tz, money

ZERO = Decimal("0.00")


def _bucket(rows: list[Booking]) -> MoneyBucket:
    return MoneyBucket(
        gross=money(sum((b.final_amount or ZERO for b in rows), ZERO)),
        platform_fee=money(sum((b.platform_fee or ZERO for b in rows), ZERO)),
        net=money(sum((b.net_amount or ZERO for b in rows), ZERO)),
        jobs=len(rows),
    )


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _add_months(d: date, n: int) -> date:
    idx = d.year * 12 + (d.month - 1) + n
    return date(idx // 12, idx % 12 + 1, 1)


def revenue_summary(db: Session, provider: ProviderProfile, month: str | None) -> RevenueResponse:
    tz = local_tz()
    today = datetime.now(tz).date()
    try:
        focus = date.fromisoformat(f"{month}-01") if month else _month_start(today)
    except ValueError:
        focus = _month_start(today)
    first_month = _add_months(_month_start(today), -5)
    range_start = datetime.combine(min(first_month, focus), time.min, tzinfo=tz)

    done = db.scalars(
        select(Booking).where(
            Booking.provider_id == provider.id,
            Booking.status == BookingStatus.COMPLETED,
            Booking.completed_at >= range_start,
        )
    ).all()
    local_day = {b.id: aware(b.completed_at).astimezone(tz).date() for b in done}

    by_day: dict[date, list[Booking]] = defaultdict(list)
    by_month: dict[date, list[Booking]] = defaultdict(list)
    for b in done:
        by_day[local_day[b.id]].append(b)
        by_month[_month_start(local_day[b.id])].append(b)

    next_month = _add_months(focus, 1)
    days_in_month = (next_month - focus).days
    last_day = min(days_in_month, (today - focus).days + 1) if focus <= today else 0
    daily = [
        DailyPoint(date=(focus + timedelta(days=i)).isoformat(), **_bucket(by_day.get(focus + timedelta(days=i), [])).model_dump())
        for i in range(days_in_month if focus < _month_start(today) else max(last_day, 0))
    ]
    monthly = [
        MonthlyPoint(month=_add_months(first_month, i).strftime("%Y-%m"), **_bucket(by_month.get(_add_months(first_month, i), [])).model_dump())
        for i in range(6)
    ]

    month_bucket = _bucket(by_month.get(focus, []))
    open_jobs = db.scalars(
        select(Booking).where(
            Booking.provider_id == provider.id,
            Booking.status.in_((BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS)),
        )
    ).all()
    pipeline = money(sum((b.quoted_amount or ZERO for b in open_jobs), ZERO))
    pct = Decimal(str(settings.PLATFORM_COMMISSION_PERCENT))
    return RevenueResponse(
        commission_percent=settings.PLATFORM_COMMISSION_PERCENT,
        today=_bucket(by_day.get(today, [])),
        month=month_bucket,
        month_label=focus.strftime("%B %Y"),
        average_ticket=money(month_bucket.gross / month_bucket.jobs) if month_bucket.jobs else ZERO,
        pipeline_gross=pipeline,
        pipeline_net=money(pipeline * (Decimal(100) - pct) / Decimal(100)),
        daily=daily,
        monthly=monthly,
    )


def day_counts(bookings: list[Booking], day: date) -> DayBookings:
    tz = local_tz()
    rows = [b for b in bookings if aware(b.scheduled_start).astimezone(tz).date() == day and b.status != BookingStatus.CANCELLED]
    count = lambda *st: sum(1 for b in rows if b.status in st)  # noqa: E731
    S = BookingStatus
    return DayBookings(
        date=day.isoformat(), total=len(rows), pending=count(S.PENDING, S.QUOTED),
        confirmed=count(S.CONFIRMED), in_progress=count(S.IN_PROGRESS), completed=count(S.COMPLETED),
    )
