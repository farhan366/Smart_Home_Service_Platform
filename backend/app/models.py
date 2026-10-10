from __future__ import annotations

import enum
from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import ( 
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Persist enum *values* (lowercase) rather than member names."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])

# Enums
class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    PROVIDER = "provider"
    ADMIN = "admin"


class DocumentType(str, enum.Enum):
    NATIONAL_ID = "national_id"
    TRADE_LICENSE = "trade_license"
    TRAINING_CERTIFICATE = "training_certificate"
    OTHER = "other"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    QUOTED = "quoted"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"

ACTIVE_BOOKING_STATUSES = (
    BookingStatus.PENDING,
    BookingStatus.QUOTED,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
)


# Identity
class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.CUSTOMER, index=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    addresses: Mapped[list[Address]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="Address.id"
    )
    provider_profile: Mapped[ProviderProfile | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    engagement_logs: Mapped[list[ServiceEngagementLog]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )


class Address(TimestampMixin, Base):
    __tablename__ = "addresses"
    __table_args__ = (
        # At most one default address per user, enforced by the database.
        Index(
            "uq_addresses_one_default_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_default"),
            sqlite_where=text("is_default"),
        ),
        CheckConstraint("latitude IS NULL OR latitude BETWEEN -90 AND 90", name="ck_addresses_lat"),
        CheckConstraint("longitude IS NULL OR longitude BETWEEN -180 AND 180", name="ck_addresses_lng"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(60))  # "Home", "Office"
    area: Mapped[str] = mapped_column(String(80), index=True)  # Area / Thana
    city: Mapped[str] = mapped_column(String(80))
    street: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    user: Mapped[User] = relationship(back_populates="addresses")


# Service catalog
class ServiceCategory(TimestampMixin, Base):
    """Self-referencing tree: Electrical (root) -> AC Servicing (child)."""

    __tablename__ = "service_categories"
    __table_args__ = (UniqueConstraint("parent_id", "name", name="uq_category_parent_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("service_categories.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))  # lucide icon name for the UI
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))

    parent: Mapped[ServiceCategory | None] = relationship(back_populates="children", remote_side="ServiceCategory.id")
    children: Mapped[list[ServiceCategory]] = relationship(
        back_populates="parent", cascade="all, delete-orphan", order_by="ServiceCategory.sort_order"
    )

# Provider profiling
class ProviderProfile(TimestampMixin, Base):
    __tablename__ = "provider_profiles"
    __table_args__ = (
        CheckConstraint("base_hourly_rate >= 0", name="ck_provider_hourly_rate"),
        CheckConstraint("min_fixed_rate >= 0", name="ck_provider_min_rate"),
        CheckConstraint("avg_rating BETWEEN 0 AND 5", name="ck_provider_avg_rating"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    headline: Mapped[str | None] = mapped_column(String(160))
    bio: Mapped[str | None] = mapped_column(Text)
    years_experience: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    base_hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, index=True)
    min_fixed_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_accepting_jobs: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))

    # Verification badges
    is_contact_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    is_credential_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    # Denormalised aggregates; written by Module 3 (reviews) / Module 2 (completed jobs).
    avg_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, server_default=text("0"), index=True)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))

    user: Mapped[User] = relationship(back_populates="provider_profile")
    specialties: Mapped[list[ProviderSpecialty]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    service_areas: Mapped[list[ProviderServiceArea]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    documents: Mapped[list[ProviderDocument]] = relationship(
        back_populates="provider", cascade="all, delete-orphan", order_by="ProviderDocument.id"
    )
    availability_rules: Mapped[list[AvailabilityRule]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )


class ProviderSpecialty(Base):
    __tablename__ = "provider_specialties"
    __table_args__ = (UniqueConstraint("provider_id", "category_id", name="uq_provider_category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("service_categories.id", ondelete="CASCADE"), index=True)
    custom_hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))  # overrides base rate if set

    provider: Mapped[ProviderProfile] = relationship(back_populates="specialties")
    category: Mapped[ServiceCategory] = relationship()


class ProviderServiceArea(Base):
    __tablename__ = "provider_service_areas"
    __table_args__ = (UniqueConstraint("provider_id", "area", "city", name="uq_provider_area"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"), index=True)
    area: Mapped[str] = mapped_column(String(80), index=True)
    city: Mapped[str] = mapped_column(String(80))

    provider: Mapped[ProviderProfile] = relationship(back_populates="service_areas")


class ProviderDocument(TimestampMixin, Base):
    __tablename__ = "provider_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"), index=True)
    doc_type: Mapped[DocumentType] = mapped_column(pg_enum(DocumentType, "document_type"))
    title: Mapped[str] = mapped_column(String(120))
    file_path: Mapped[str] = mapped_column(String(500))  # private; never exposed via API
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[VerificationStatus] = mapped_column(
        pg_enum(VerificationStatus, "verification_status"), default=VerificationStatus.PENDING, index=True
    )
    review_note: Mapped[str | None] = mapped_column(String(500))
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    provider: Mapped[ProviderProfile] = relationship(back_populates="documents")


# Operational calendar
class AvailabilityRule(TimestampMixin, Base):
    """Weekly recurring window. day_of_week: Monday=0 ... Sunday=6."""

    __tablename__ = "availability_rules"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_rule_day"),
        CheckConstraint("end_time > start_time", name="ck_rule_time_order"),
        CheckConstraint("slot_minutes BETWEEN 15 AND 480", name="ck_rule_slot_minutes"),
        Index("ix_rule_provider_day", "provider_id", "day_of_week"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"))
    day_of_week: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    slot_minutes: Mapped[int] = mapped_column(SmallInteger, default=60)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))

    provider: Mapped[ProviderProfile] = relationship(back_populates="availability_rules")
 
class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("scheduled_end > scheduled_start", name="ck_booking_time_order"),
        Index("ix_booking_provider_window", "provider_id", "scheduled_start", "scheduled_end"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="RESTRICT"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("service_categories.id", ondelete="SET NULL"))
    address_id: Mapped[int | None] = mapped_column(ForeignKey("addresses.id", ondelete="SET NULL"))
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BookingStatus] = mapped_column(
        pg_enum(BookingStatus, "booking_status"), default=BookingStatus.PENDING, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text)
    quoted_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))


class SlotLock(Base):
    """Short-lived hold on a slot while a customer completes checkout (Module 2)."""

    __tablename__ = "slot_locks"
    __table_args__ = (Index("ix_lock_provider_window", "provider_id", "start_at", "end_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"))
    locked_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(Text)


class ServiceEngagementLog(Base):
    """Past service engagement / interaction events (also the training signal for Module 3's recommender)."""

    __tablename__ = "service_engagement_logs"
    __table_args__ = (Index("ix_engagement_customer_time", "customer_id", "occurred_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    provider_id: Mapped[int | None] = mapped_column(ForeignKey("provider_profiles.id", ondelete="SET NULL"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("service_categories.id", ondelete="SET NULL"))
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(40))  # profile_view | search | booked | completed ...
    summary: Mapped[str | None] = mapped_column(String(255))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer: Mapped[User] = relationship(back_populates="engagement_logs")
