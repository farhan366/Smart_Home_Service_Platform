from collections import defaultdict
from datetime import date, datetime, timedelta
from datetime import time as dtime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import ACTIVE_BOOKING_STATUSES, AvailabilityRule, Booking, SlotLock
from app.schemas.schedule import AvailabilityRuleIn


def validate_no_overlaps(rules: list[AvailabilityRuleIn]) -> None:
    """Reject schedules where two windows on the same weekday intersect."""
    by_day: dict[int, list[AvailabilityRuleIn]] = defaultdict(list)
    for r in rules:
        by_day[r.day_of_week].append(r)
    for day, items in by_day.items():
        items.sort(key=lambda r: r.start_time)
        for prev, nxt in zip(items, items[1:]):
            if nxt.start_time < prev.end_time:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"Overlapping windows on day {day}: {prev.start_time:%H:%M}-{prev.end_time:%H:%M} "
                    f"and {nxt.start_time:%H:%M}-{nxt.end_time:%H:%M}",
                )


def generate_slots(db: Session, provider_id: int, start_date: date, days: int) -> list[dict]:
    """Expand weekly rules into concrete slots, removing anything that is booked,
    locked, in the past, or inside the minimum lead time."""
    tz = ZoneInfo(settings.APP_TIMEZONE)
    end_date = start_date + timedelta(days=days - 1)
    range_start = datetime.combine(start_date, dtime.min, tzinfo=tz)
    range_end = datetime.combine(end_date + timedelta(days=1), dtime.min, tzinfo=tz)
    now = datetime.now(tz)
    earliest = now + timedelta(minutes=settings.MIN_BOOKING_LEAD_MINUTES)

    rules = db.scalars(
        select(AvailabilityRule).where(
            AvailabilityRule.provider_id == provider_id, AvailabilityRule.is_available.is_(True)
        )
    ).all()
    rules_by_day: dict[int, list[AvailabilityRule]] = defaultdict(list)
    for r in rules:
        rules_by_day[r.day_of_week].append(r)

    busy: list[tuple[datetime, datetime]] = []
    busy += db.execute(
        select(Booking.scheduled_start, Booking.scheduled_end).where(
            Booking.provider_id == provider_id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.scheduled_start < range_end,
            Booking.scheduled_end > range_start,
        )
    ).all()
    busy += db.execute(
        select(SlotLock.start_at, SlotLock.end_at).where(
            SlotLock.provider_id == provider_id,
            SlotLock.expires_at > now,
            SlotLock.start_at < range_end,
            SlotLock.end_at > range_start,
        )
    ).all()

    def aware(dt: datetime) -> datetime:
        return dt if dt.tzinfo else dt.replace(tzinfo=tz)  # defensive: naive values from non-PG backends

    busy = [(aware(a), aware(b)) for a, b in busy]

    def is_free(s: datetime, e: datetime) -> bool:
        return not any(s < b_end and e > b_start for b_start, b_end in busy)

    result = []
    for offset in range(days):
        day = start_date + timedelta(days=offset)
        seen: set[datetime] = set()
        slots = []
        for rule in sorted(rules_by_day.get(day.weekday(), []), key=lambda r: r.start_time):
            step = timedelta(minutes=rule.slot_minutes)
            cursor = datetime.combine(day, rule.start_time, tzinfo=tz)
            window_end = datetime.combine(day, rule.end_time, tzinfo=tz)
            while cursor + step <= window_end:
                slot_end = cursor + step
                if cursor >= earliest and cursor not in seen and is_free(cursor, slot_end):
                    seen.add(cursor)
                    slots.append({"start": cursor, "end": slot_end})
                cursor = slot_end
        result.append({"date": day, "slots": slots})
    return result
