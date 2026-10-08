from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class CategoryCreate(BaseModel):
    name: Name
    parent_id: int | None = None
    description: str | None = Field(default=None, max_length=1000)
    icon: str | None = Field(default=None, max_length=50)
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Name | None = None
    description: str | None = Field(default=None, max_length=1000)
    icon: str | None = Field(default=None, max_length=50)
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    name: str
    slug: str
    description: str | None
    icon: str | None
    sort_order: int
    is_active: bool


class CategoryTree(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    children: list[CategoryTree] = []


class AreaCount(BaseModel):
    area: str
    city: str
    provider_count: int


class ProviderCard(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None = None
    headline: str | None = None
    years_experience: int
    base_hourly_rate: Decimal
    min_fixed_rate: Decimal
    avg_rating: Decimal
    rating_count: int
    is_contact_verified: bool
    is_credential_verified: bool
    specialties: list[str]
    areas: list[str]


class ProviderSearchResponse(BaseModel):
    items: list[ProviderCard]
    total: int
    page: int
    page_size: int
