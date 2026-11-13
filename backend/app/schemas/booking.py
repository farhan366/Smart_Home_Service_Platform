from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

from app.models import BookingStatus
from app.schemas.quotation import QuotationRead

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


# Slot locks
class SlotLockCreate(BaseModel):
    provider_id: int
    start: AwareDatetime
    end: AwareDatetime


class SlotLockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    start_at: datetime
    end_at: datetime
    expires_at: datetime
    seconds_left: int = 0


# Bookings
class BookingCreate(BaseModel):
    provider_id: int
    category_id: int
    address_id: int
    slot_lock_id: int
    notes: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=2000)]
    complexity: int = Field(default=2, ge=1, le=3)


class ReasonIn(BaseModel):
    reason: Reason


class CategoryBrief(BaseModel):
    id: int
    name: str
    parent_name: str | None = None


class PartyBrief(BaseModel):
    id: int
    full_name: str
    headline: str | None = None
    phone: str | None = None  # withheld until the booking is confirmed
    avatar_url: str | None = None


class StatusEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_status: BookingStatus | None
    to_status: BookingStatus
    actor_role: str
    note: str | None
    created_at: datetime


class BookingRead(BaseModel):
    id: int
    status: BookingStatus
    category: CategoryBrief | None
    customer: PartyBrief
    provider: PartyBrief
    service_area: str | None
    address_text: str | None  # full street only for the customer, or the provider once confirmed
    scheduled_start: datetime
    scheduled_end: datetime
    notes: str | None
    complexity: int
    quoted_amount: Decimal | None
    final_amount: Decimal | None = None
    platform_fee: Decimal | None = None
    net_amount: Decimal | None = None
    cancelled_by: str | None = None
    cancel_reason: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    active_quotation: QuotationRead | None = None
    allowed_actions: list[str] = []


class BookingDetail(BookingRead):
    events: list[StatusEventRead] = []
    quotations: list[QuotationRead] = []


# Provider-side operations
class CompleteIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class QuickAcceptIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class DayBookings(BaseModel):
    date: str
    total: int
    pending: int
    confirmed: int
    in_progress: int
    completed: int


class ScheduleResponse(BaseModel):
    date: str
    bookings: list[BookingRead]
    summary: DayBookings
    overview: list[DayBookings]  # 7-day strip starting at `date`
    day_net_so_far: Decimal


class MoneyBucket(BaseModel):
    gross: Decimal
    platform_fee: Decimal
    net: Decimal
    jobs: int


class DailyPoint(MoneyBucket):
    date: str


class MonthlyPoint(MoneyBucket):
    month: str  # YYYY-MM


class RevenueResponse(BaseModel):
    commission_percent: float
    today: MoneyBucket
    month: MoneyBucket
    month_label: str
    average_ticket: Decimal
    pipeline_gross: Decimal   # confirmed + in-progress work not yet settled
    pipeline_net: Decimal
    daily: list[DailyPoint]
    monthly: list[MonthlyPoint]

