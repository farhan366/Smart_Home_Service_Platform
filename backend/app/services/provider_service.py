import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import (
    DocumentType,
    ProviderDocument,
    ProviderProfile,
    ProviderSpecialty,
    ServiceCategory,
    User,
    VerificationStatus,
)
from app.schemas.provider import DocumentRead
from app.schemas.service import ProviderCard

# Documents that, once approved, grant the "credential verified" badge.
CREDENTIAL_DOC_TYPES = (DocumentType.TRADE_LICENSE, DocumentType.TRAINING_CERTIFICATE)

ALLOWED_UPLOADS = {
    "application/pdf": (".pdf", b"%PDF"),
    "image/png": (".png", b"\x89PNG"),
    "image/jpeg": (".jpg", b"\xff\xd8"),
}


def profile_loader():
    """Eager-load options shared by every query that serialises a provider."""
    return (
        selectinload(ProviderProfile.user),
        selectinload(ProviderProfile.specialties)
        .selectinload(ProviderSpecialty.category)
        .selectinload(ServiceCategory.parent),
        selectinload(ProviderProfile.service_areas),
    )


def get_profile_or_404(db: Session, user: User) -> ProviderProfile:
    profile = db.scalar(
        select(ProviderProfile).where(ProviderProfile.user_id == user.id).options(*profile_loader())
    )
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider profile not found")
    return profile


def _specialty_dicts(profile: ProviderProfile) -> list[dict]:
    out = []
    for s in profile.specialties:
        cat = s.category
        out.append(
            {
                "category_id": cat.id,
                "category_name": cat.name,
                "parent_name": cat.parent.name if cat.parent else None,
                "custom_hourly_rate": s.custom_hourly_rate,
            }
        )
    return out


def serialize_profile(profile: ProviderProfile, *, private: bool = False) -> dict:
    data = {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.user.full_name,
        "avatar_url": profile.user.avatar_url,
        "headline": profile.headline,
        "bio": profile.bio,
        "years_experience": profile.years_experience,
        "base_hourly_rate": profile.base_hourly_rate,
        "min_fixed_rate": profile.min_fixed_rate,
        "is_accepting_jobs": profile.is_accepting_jobs,
        "is_contact_verified": profile.is_contact_verified,
        "is_credential_verified": profile.is_credential_verified,
        "avg_rating": profile.avg_rating,
        "rating_count": profile.rating_count,
        "completed_jobs": profile.completed_jobs,
        "specialties": _specialty_dicts(profile),
        "service_areas": [{"area": a.area, "city": a.city} for a in profile.service_areas],
        "member_since": profile.created_at,
    }
    if private:
        data["documents"] = [DocumentRead.model_validate(d) for d in profile.documents]
    return data


def to_card(profile: ProviderProfile) -> ProviderCard:
    return ProviderCard(
        id=profile.id,
        full_name=profile.user.full_name,
        avatar_url=profile.user.avatar_url,
        headline=profile.headline,
        years_experience=profile.years_experience,
        base_hourly_rate=profile.base_hourly_rate,
        min_fixed_rate=profile.min_fixed_rate,
        avg_rating=profile.avg_rating,
        rating_count=profile.rating_count,
        is_contact_verified=profile.is_contact_verified,
        is_credential_verified=profile.is_credential_verified,
        specialties=[s.category.name for s in profile.specialties],
        areas=[a.area for a in profile.service_areas],
    )


def recompute_credential_badge(profile: ProviderProfile) -> None:
    """Badge is on iff at least one trade credential document is approved."""
    profile.is_credential_verified = any(
        d.status == VerificationStatus.APPROVED and d.doc_type in CREDENTIAL_DOC_TYPES
        for d in profile.documents
    )


def save_upload(profile_id: int, file: UploadFile) -> tuple[str, str]:
    """Validate (type, signature, size) and persist an upload. Returns (path, mime)."""
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_UPLOADS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF, PNG or JPG files are allowed")
    ext, signature = ALLOWED_UPLOADS[mime]

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    content = file.file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.MAX_UPLOAD_MB} MB")
    if not content.startswith(signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File content does not match its declared type")

    folder = Path(settings.UPLOAD_DIR) / "providers" / str(profile_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{ext}"  # server-generated name: no path traversal
    path.write_bytes(content)
    return str(path), mime


def delete_file_quietly(path: str) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
