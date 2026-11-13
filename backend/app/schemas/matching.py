from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class ScoreBreakdown(BaseModel):
    proximity: float
    rating: float
    capability: float
    price: float
    availability: float


class MatchResult(BaseModel):
    rank: int
    provider_id: int
    full_name: str
    headline: str | None = None
    avatar_url: str | None = None
    avg_rating: Decimal
    rating_count: int
    years_experience: int
    completed_jobs: int
    is_credential_verified: bool
    is_contact_verified: bool
    hourly_rate: Decimal
    estimated_hours: float
    estimated_price: Decimal
    areas: list[str]
    matched_area: str
    distance_km: float
    next_available: datetime
    open_slots: int
    score: float  # 0..100
    breakdown: ScoreBreakdown
    reasons: list[str]


class MatchResponse(BaseModel):
    category_id: int
    category_name: str
    customer_area: str
    complexity: int
    complexity_label: str
    weights: ScoreBreakdown
    window_start: date
    window_days: int
    total_candidates: int
    results: list[MatchResult]
