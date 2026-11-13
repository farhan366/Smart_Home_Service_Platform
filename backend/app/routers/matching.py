from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_customer
from app.db.session import get_db
from app.models import Address, ServiceCategory, ServiceEngagementLog, User
from app.schemas.matching import MatchResponse
from app.services import matching_service

router = APIRouter(prefix="/matching", tags=["Matching"])


@router.get("/recommendations", response_model=MatchResponse)
def recommend_technicians(
    category_id: int = Query(..., description="Service category or sub-service"),
    address_id: int | None = Query(None, description="One of the customer's saved addresses"),
    area: str | None = Query(None, max_length=80, description="Used when no saved address is chosen"),
    city: str | None = Query(None, max_length=80),
    complexity: int = Query(2, ge=1, le=3, description="1 simple, 2 standard, 3 complex"),
    preferred_date: date | None = Query(None, description="Only consider technicians free on this day"),
    limit: int = Query(settings.MATCH_TOP_N, ge=1, le=20),
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    category = db.get(ServiceCategory, category_id)
    if category is None or not category.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")

    point = None
    if address_id is not None:
        address = db.get(Address, address_id)
        if address is None or address.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
        area, city = address.area, address.city
        if address.latitude is not None and address.longitude is not None:
            point = (float(address.latitude), float(address.longitude))
    if not area:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose a saved address or provide an area")

    result = matching_service.recommend(
        db, category_id=category_id, category_name=category.name, customer_area=area, customer_city=city,
        customer_point=point, complexity=complexity, preferred_date=preferred_date, limit=limit,
    )
    # Search signal for the Module 3 recommender.
    db.add(ServiceEngagementLog(
        customer_id=user.id, category_id=category_id, event_type="match_request",
        summary=f"{category.name} in {area}, complexity {complexity}: {len(result.results)} matches",
    ))
    db.commit()
    return result
