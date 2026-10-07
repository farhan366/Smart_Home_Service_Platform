from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AvailabilityRuleIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="Monday=0 ... Sunday=6")
    start_time: time
    end_time: time
    slot_minutes: int = Field(default=60, ge=15, le=480)
    is_available: bool = True

    @model_validator(mode="after")
    def validate_window(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class WeeklyScheduleIn(BaseModel):
    rules: list[AvailabilityRuleIn] = Field(max_length=42)


class AvailabilityRuleRead(AvailabilityRuleIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class SlotRead(BaseModel):
    start: datetime
    end: datetime


class DaySlots(BaseModel):
    date: date
    slots: list[SlotRead]
