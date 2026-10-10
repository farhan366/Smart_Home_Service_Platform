from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class AddressBase(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    area: Short
    city: Short
    street: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=255)]
    latitude: Decimal | None = Field(default=None, ge=-90, le=90, max_digits=9, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, max_digits=9, decimal_places=6)
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=60)
    area: str | None = Field(default=None, min_length=2, max_length=80)
    city: str | None = Field(default=None, min_length=2, max_length=80)
    street: str | None = Field(default=None, min_length=3, max_length=255)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    is_default: bool | None = None


class AddressRead(AddressBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
