from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models import (
    Booking,
    ProviderProfile,
    ProviderServiceArea,
    ProviderSpecialty,
    ServiceCategory,
    User,
)
from app.schemas.service import (
    AreaCount,
    CategoryCreate,
    CategoryRead,
    CategoryTree,
    CategoryUpdate,
    ProviderSearchResponse,
)
from app.services.catalog_service import build_tree, descendant_ids, unique_slug
from app.services.provider_service import profile_loader, to_card

router = APIRouter(prefix="/services", tags=["Service Discovery"])


#Categories#
@router.get("/categories", response_model=list[CategoryTree])
def category_tree(db: Session = Depends(get_db)):
    """Full hierarchical catalog (parents with nested sub-services)."""
    rows = db.scalars(select(ServiceCategory).where(ServiceCategory.is_active.is_(True))).all()
    return build_tree(list(rows))


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    parent_slug = None
    if payload.parent_id is not None:
        parent = db.get(ServiceCategory, payload.parent_id)
        if parent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent category not found")
        if parent.parent_id is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Catalog supports two levels: category -> sub-service")
        parent_slug = parent.slug
    category = ServiceCategory(**payload.model_dump(), slug=unique_slug(db, payload.name, parent_slug))
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists here")
    return category


@router.patch("/categories/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int, payload: CategoryUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    category = db.get(ServiceCategory, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists here")
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    category = db.get(ServiceCategory, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    db.delete(category)
    db.commit()


#Areas#
@router.get("/areas", response_model=list[AreaCount])
def list_areas(db: Session = Depends(get_db)):
    """Areas where at least one searchable provider operates."""
    rows = db.execute(
        select(ProviderServiceArea.area, ProviderServiceArea.city, func.count(ProviderServiceArea.provider_id))
        .join(ProviderProfile, ProviderProfile.id == ProviderServiceArea.provider_id)
        .where(ProviderProfile.is_accepting_jobs.is_(True), ProviderProfile.base_hourly_rate > 0)
        .group_by(ProviderServiceArea.area, ProviderServiceArea.city)
        .order_by(ProviderServiceArea.area)
    ).all()
    return [AreaCount(area=a, city=c, provider_count=n) for a, c, n in rows]


#Localized provider search#
SORTS = {
    "rating": lambda: (ProviderProfile.avg_rating.desc(), ProviderProfile.rating_count.desc()),
    "price_asc": lambda: (ProviderProfile.base_hourly_rate.asc(),),
    "price_desc": lambda: (ProviderProfile.base_hourly_rate.desc(),),
    "experience": lambda: (ProviderProfile.years_experience.desc(),),
}


@router.get("/providers", response_model=ProviderSearchResponse)
def search_providers(
    q: str | None = Query(None, max_length=80, description="Name, headline or service keyword"),
    category_id: int | None = Query(None, description="Category or sub-service id"),
    area: str | None = Query(None, max_length=80, description="Area / Thana"),
    min_rating: float | None = Query(None, ge=0, le=5),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    verified_only: bool = False,
    sort: Literal["rating", "price_asc", "price_desc", "experience"] = "rating",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "min_price cannot exceed max_price")

    stmt = (
        select(ProviderProfile)
        .join(User, User.id == ProviderProfile.user_id)
        .where(
            User.is_active.is_(True),
            ProviderProfile.is_accepting_jobs.is_(True),
            ProviderProfile.base_hourly_rate > 0,
        )
    )
    if category_id is not None:
        ids = descendant_ids(db, category_id)
        stmt = stmt.where(ProviderProfile.specialties.any(ProviderSpecialty.category_id.in_(ids)))
    if area:
        stmt = stmt.where(
            ProviderProfile.service_areas.any(func.lower(ProviderServiceArea.area) == area.strip().lower())
        )
    if min_rating is not None:
        stmt = stmt.where(ProviderProfile.avg_rating >= min_rating)
    if min_price is not None:
        stmt = stmt.where(ProviderProfile.base_hourly_rate >= min_price)
    if max_price is not None:
        stmt = stmt.where(ProviderProfile.base_hourly_rate <= max_price)
    if verified_only:
        stmt = stmt.where(ProviderProfile.is_credential_verified.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            User.full_name.ilike(like)
            | ProviderProfile.headline.ilike(like)
            | ProviderProfile.specialties.any(
                ProviderSpecialty.category.has(ServiceCategory.name.ilike(like))
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(*SORTS[sort](), ProviderProfile.id)
        .options(*profile_loader())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return ProviderSearchResponse(items=[to_card(p) for p in rows], total=total, page=page, page_size=page_size)


#Single Provider Public Profile#
@router.get("/providers/{provider_id}")
def get_provider_detail(provider_id: int, db: Session = Depends(get_db)):
    """Fetch single provider's full public profile."""
    provider = db.scalar(
        select(ProviderProfile)
        .where(ProviderProfile.id == provider_id)
        .options(*profile_loader())
    )
    if not provider:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")

    data = to_card(provider)
    res = data.model_dump() if hasattr(data, "model_dump") else dict(data)

    res.update({
        "bio": provider.bio,
        "years_of_experience": provider.years_experience,
        "is_active": provider.is_accepting_jobs,
        "working_days": getattr(provider, "working_days", ["sat", "sun", "mon", "tue", "wed", "thu"]),
        "start_time": getattr(provider, "start_time", "09:00"),
        "end_time": getattr(provider, "end_time", "20:00"),
        "specialties": [s.category.name for s in provider.specialties if s.category],
        "areas": [a.area for a in provider.service_areas],
    })
    return res


#Dynamic Slots & Double-Booking Prevention#
DAY_NAME_MAP = {
    0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"
}

@router.get("/providers/{provider_id}/available-slots")
def get_available_slots(
    provider_id: int, 
    date: str = Query(..., description="Format: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """Dynamic booking slots based on recurring operational schedule."""
    try:
        selected_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD")

    provider = db.get(ProviderProfile, provider_id)
    if not provider:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")

    weekday_key = DAY_NAME_MAP[selected_date.weekday()]
    provider_days = getattr(provider, "working_days", None) or ["sat", "sun", "mon", "tue", "wed", "thu"]
    
    if weekday_key not in provider_days:
        return {
            "date": date,
            "is_working_day": False,
            "message": "Provider is closed on this day.",
            "slots": []
        }

    start_str = getattr(provider, "start_time", None) or "09:00"
    end_str = getattr(provider, "end_time", None) or "20:00"

    start_h = int(start_str.split(":")[0])
    end_h = int(end_str.split(":")[0])

    booked_times = set()
    try:
        existing = db.execute(
            select(Booking.scheduled_time).where(
                Booking.provider_id == provider_id,
                Booking.scheduled_date == date,
                Booking.status.in_(["pending", "confirmed"])
            )
        ).scalars().all()
        booked_times = {b[:5] for b in existing if b}
    except Exception:
        pass

    slots = []
    for h in range(start_h, end_h):
        time_slot = f"{h:02d}:00"
        period = "PM" if h >= 12 else "AM"
        display_h = 12 if h % 12 == 0 else h % 12
        label = f"{display_h:02d}:00 {period}"
        
        is_booked = time_slot in booked_times
        slots.append({
            "time": time_slot,
            "label": label,
            "available": not is_booked,
            "reason": "Already Booked" if is_booked else "Available"
        })

    return {
        "date": date,
        "is_working_day": True,
        "slots": slots
    }


#Customer Engagement Logs#
@router.get("/bookings/my")
def get_customer_booking_logs(
    customer_id: int | None = Query(None, description="Optional customer ID"),
    db: Session = Depends(get_db)
):
    """Past and active service engagement logs."""
    try:
        stmt = select(Booking).order_by(Booking.created_at.desc())
        if customer_id:
            stmt = stmt.where(Booking.customer_id == customer_id)
        
        bookings = db.scalars(stmt).all()
        
        results = []
        for b in bookings:
            provider = db.get(ProviderProfile, b.provider_id)
            results.append({
                "id": b.id,
                "provider_id": b.provider_id,
                "provider_name": provider.headline if provider else "Professional Specialist",
                "service_name": getattr(b, "service_name", "Home Service"),
                "scheduled_date": str(b.scheduled_date),
                "scheduled_time": str(b.scheduled_time),
                "amount": float(getattr(b, "total_price", 2000)),
                "status": getattr(b, "status", "confirmed"),
                "address": getattr(b, "address", "Dhaka")
            })
        return results
    except Exception:
        return []
