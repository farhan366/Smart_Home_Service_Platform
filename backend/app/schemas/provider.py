from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.models import DocumentType, VerificationStatus

Text80 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class SpecialtyIn(BaseModel):
    category_id: int
    custom_hourly_rate: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)


class AreaIn(BaseModel):
    area: Text80
    city: Text80 = "Dhaka"


class ProviderProfileUpsert(BaseModel):
    headline: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, max_length=2000)
    years_experience: int = Field(default=0, ge=0, le=60)
    base_hourly_rate: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    min_fixed_rate: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    is_accepting_jobs: bool = True
    # None = leave unchanged, [] = clear
    specialties: list[SpecialtyIn] | None = None
    service_areas: list[AreaIn] | None = None

    @field_validator("specialties")
    @classmethod
    def unique_specialties(cls, v):
        if v and len({s.category_id for s in v}) != len(v):
            raise ValueError("Duplicate specialty selected")
        return v


class SpecialtyRead(BaseModel):
    category_id: int
    category_name: str
    parent_name: str | None = None
    custom_hourly_rate: Decimal | None = None


class AreaRead(BaseModel):
    area: str
    city: str


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doc_type: DocumentType
    title: str
    original_filename: str
    status: VerificationStatus
    review_note: str | None
    created_at: datetime


class ProviderPublicRead(BaseModel):
    id: int
    user_id: int
    full_name: str
    avatar_url: str | None = None
    headline: str | None = None
    bio: str | None = None
    years_experience: int
    base_hourly_rate: Decimal
    min_fixed_rate: Decimal
    is_accepting_jobs: bool
    is_contact_verified: bool
    is_credential_verified: bool
    avg_rating: Decimal
    rating_count: int
    completed_jobs: int
    specialties: list[SpecialtyRead]
    service_areas: list[AreaRead]
    member_since: datetime


class ProviderPrivateRead(ProviderPublicRead):
    documents: list[DocumentRead]


class DocumentReview(BaseModel):
    status: Literal["approved", "rejected"]
    review_note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def note_required_on_reject(self):
        if self.status == "rejected" and not self.review_note:
            raise ValueError("Provide a reason when rejecting a document")
        return self


class ContactVerification(BaseModel):
    verified: bool
