from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models import QuotationStatus, QuoteItemType


class QuoteItemIn(BaseModel):
    item_type: QuoteItemType
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    quantity: Decimal = Field(gt=0, le=9999, max_digits=8, decimal_places=2)
    unit: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)] = "pcs"
    unit_price: Decimal = Field(ge=0, le=10_000_000, max_digits=10, decimal_places=2)


class QuotationCreate(BaseModel):
    items: list[QuoteItemIn] = Field(min_length=1, max_length=30)
    note: str | None = Field(default=None, max_length=1000)
    valid_hours: int | None = Field(default=None, ge=1, le=168, description="Defaults to QUOTE_VALIDITY_HOURS")

    @model_validator(mode="after")
    def needs_labor_and_value(self):
        if not any(i.item_type == QuoteItemType.LABOR for i in self.items):
            raise ValueError("Add at least one labour line (e.g. diagnosis / installation hours)")
        if sum(i.quantity * i.unit_price for i in self.items) <= 0:
            raise ValueError("The quotation total must be greater than zero")
        return self


class QuoteItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_type: QuoteItemType
    description: str
    quantity: Decimal
    unit: str
    unit_price: Decimal
    line_total: Decimal


class QuotationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    version: int
    status: QuotationStatus
    labor_total: Decimal
    material_total: Decimal
    total: Decimal
    note: str | None
    valid_until: datetime
    responded_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    items: list[QuoteItemRead]
