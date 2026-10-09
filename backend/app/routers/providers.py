from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user, require_admin, require_provider
from app.db.session import get_db
from app.models import (
    AvailabilityRule,
    DocumentType,
    ProviderDocument,
    ProviderProfile,
    ProviderServiceArea,
    ProviderSpecialty,
    ServiceCategory,
    ServiceEngagementLog,
    User,
    UserRole,
    VerificationStatus,
)
from app.schemas.provider import (
    ContactVerification,
    DocumentRead,
    DocumentReview,
    ProviderPrivateRead,
    ProviderProfileUpsert,
    ProviderPublicRead,
)
from app.schemas.schedule import AvailabilityRuleRead, DaySlots, WeeklyScheduleIn
from app.services.provider_service import (
    delete_file_quietly,
    get_profile_or_404,
    profile_loader,
    recompute_credential_badge,
    save_upload,
    serialize_profile,
)
from app.services.slot_service import generate_slots, validate_no_overlaps
from datetime import date

router = APIRouter(prefix="/providers", tags=["Providers"])
MAX_DOCUMENTS = 10


# ============================ Own profile (provider) ======================== #
@router.get("/me", response_model=ProviderPrivateRead)
def my_profile(user: User = Depends(require_provider), db: Session = Depends(get_db)):
    return serialize_profile(get_profile_or_404(db, user), private=True)


@router.put("/me", response_model=ProviderPrivateRead)
def upsert_my_profile(
    payload: ProviderProfileUpsert, user: User = Depends(require_provider), db: Session = Depends(get_db)
):
    profile = db.scalar(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    if profile is None:
        profile = ProviderProfile(user_id=user.id)
        db.add(profile)

    for field in ("headline", "bio", "years_experience", "base_hourly_rate", "min_fixed_rate", "is_accepting_jobs"):
        setattr(profile, field, getattr(payload, field))
    db.flush()

    if payload.specialties is not None:
        ids = [s.category_id for s in payload.specialties]
        found = set(
            db.scalars(
                select(ServiceCategory.id).where(ServiceCategory.id.in_(ids), ServiceCategory.is_active.is_(True))
            )
        )
        missing = set(ids) - found
        if missing:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown service ids: {sorted(missing)}")
        profile.specialties.clear()
        db.flush()  # delete old rows before inserting to respect the unique constraint
        profile.specialties.extend(
            ProviderSpecialty(category_id=s.category_id, custom_hourly_rate=s.custom_hourly_rate)
            for s in payload.specialties
        )

    if payload.service_areas is not None:
        unique = {(a.area.title(), a.city.title()) for a in payload.service_areas}
        profile.service_areas.clear()
        db.flush()
        profile.service_areas.extend(ProviderServiceArea(area=a, city=c) for a, c in sorted(unique))

    db.commit()
    db.expire_all()
    return serialize_profile(get_profile_or_404(db, user), private=True)


# ================================ Documents ================================= #
@router.post("/me/documents", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    doc_type: DocumentType = Form(...),
    title: str = Form(..., min_length=2, max_length=120),
    file: UploadFile = File(...),
    user: User = Depends(require_provider),
    db: Session = Depends(get_db),
):
    profile = get_profile_or_404(db, user)
    if len(profile.documents) >= MAX_DOCUMENTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can upload up to {MAX_DOCUMENTS} documents")
    path, mime = save_upload(profile.id, file)
    doc = ProviderDocument(
        provider_id=profile.id,
        doc_type=doc_type,
        title=title.strip(),
        file_path=path,
        original_filename=Path(file.filename or "document").name[:255],
        mime_type=mime,
    )
    db.add(doc)
    db.commit()
    return doc


@router.delete("/me/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = get_profile_or_404(db, user)
    doc = next((d for d in profile.documents if d.id == document_id), None)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    path = doc.file_path
    profile.documents.remove(doc)
    db.flush()
    recompute_credential_badge(profile)
    db.commit()
    delete_file_quietly(path)


@router.get("/documents/{document_id}/file")
def download_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Private file access: only the owning provider or an admin."""
    doc = db.scalar(
        select(ProviderDocument).where(ProviderDocument.id == document_id).options(selectinload(ProviderDocument.provider))
    )
    if doc is None or not (user.role == UserRole.ADMIN or doc.provider.user_id == user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if not Path(doc.file_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File is no longer available")
    return FileResponse(doc.file_path, media_type=doc.mime_type, filename=doc.original_filename)


# ============================ Admin verification ============================ #
@router.get("/admin/documents/pending", response_model=list[DocumentRead])
def pending_documents(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(
        select(ProviderDocument)
        .where(ProviderDocument.status == VerificationStatus.PENDING)
        .order_by(ProviderDocument.created_at)
    ).all()


@router.patch("/admin/documents/{document_id}/review", response_model=DocumentRead)
def review_document(
    document_id: int, payload: DocumentReview, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    doc = db.scalar(
        select(ProviderDocument)
        .where(ProviderDocument.id == document_id)
        .options(selectinload(ProviderDocument.provider).selectinload(ProviderProfile.documents))
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    doc.status = VerificationStatus(payload.status)
    doc.review_note = payload.review_note
    doc.reviewed_by_id = admin.id
    doc.reviewed_at = datetime.now(timezone.utc)
    db.flush()
    recompute_credential_badge(doc.provider)
    db.commit()
    return doc


@router.patch("/admin/{provider_id}/contact-verification", response_model=ContactVerification)
def set_contact_verification(
    provider_id: int, payload: ContactVerification, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    profile = db.get(ProviderProfile, provider_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")
    profile.is_contact_verified = payload.verified
    db.commit()
    return payload


# ============================ Weekly availability =========================== #
@router.get("/me/availability", response_model=list[AvailabilityRuleRead])
def my_availability(user: User = Depends(require_provider), db: Session = Depends(get_db)):
    profile = get_profile_or_404(db, user)
    return db.scalars(
        select(AvailabilityRule)
        .where(AvailabilityRule.provider_id == profile.id)
        .order_by(AvailabilityRule.day_of_week, AvailabilityRule.start_time)
    ).all()


@router.put("/me/availability", response_model=list[AvailabilityRuleRead])
def set_my_availability(
    payload: WeeklyScheduleIn, user: User = Depends(require_provider), db: Session = Depends(get_db)
):
    """Replace the whole weekly template atomically. Overlapping windows are rejected."""
    validate_no_overlaps(payload.rules)
    profile = get_profile_or_404(db, user)
    profile.availability_rules.clear()
    db.flush()
    profile.availability_rules.extend(AvailabilityRule(**r.model_dump()) for r in payload.rules)
    db.commit()
    return sorted(profile.availability_rules, key=lambda r: (r.day_of_week, r.start_time))


# ============================== Public endpoints ============================ #
@router.get("/{provider_id}", response_model=ProviderPublicRead)
def public_profile(
    provider_id: int, viewer: User | None = Depends(get_optional_user), db: Session = Depends(get_db)
):
    profile = db.scalar(
        select(ProviderProfile).where(ProviderProfile.id == provider_id).options(*profile_loader())
    )
    if profile is None or not profile.user.is_active or profile.base_hourly_rate <= 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")
    if viewer is not None and viewer.role == UserRole.CUSTOMER:
        db.add(ServiceEngagementLog(customer_id=viewer.id, provider_id=profile.id, event_type="profile_view"))
        db.commit()
    return serialize_profile(profile)


@router.get("/{provider_id}/slots", response_model=list[DaySlots])
def provider_slots(
    provider_id: int,
    start_date: date | None = Query(None, description="Defaults to today (app timezone)"),
    days: int = Query(7, ge=1, le=settings.MAX_SLOT_RANGE_DAYS),
    db: Session = Depends(get_db),
):
    if db.get(ProviderProfile, provider_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")
    if start_date is None:
        from zoneinfo import ZoneInfo

        start_date = datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()
    return generate_slots(db, provider_id, start_date, days)
