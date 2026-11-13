"""Technician matching engine.

Pipeline: eligibility (specialty + served area within radius + currently bookable) -> five 0..1 indices
(proximity, rating, capability, price, availability) -> complexity-weighted score -> ranked top-N with
human-readable reasons. The maths lives in services/scoring.py and services/geo.py.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import ProviderProfile, ProviderSpecialty, User
from app.schemas.matching import MatchResponse, MatchResult, ScoreBreakdown
from app.services import geo, scoring
from app.services.booking_service import aware, local_tz, utcnow
from app.services.catalog_service import related_category_ids
from app.services.provider_service import profile_loader
from app.services.quotation_service import effective_hourly_rate
from app.services.slot_service import generate_slots


def _first_slot(db: Session, provider_id: int, start_day: date, days: int) -> tuple[datetime, int] | None:
    first, count = None, 0
    for entry in generate_slots(db, provider_id, start_day, days):
        for slot in entry["slots"]:
            count += 1
            if first is None or slot["start"] < first:
                first = slot["start"]
    return (first, count) if first else None


def _reasons(c: dict) -> list[str]:
    out = []
    if c["distance"] == 0:
        out.append(f"Serves your area ({c['matched_area']})")
    else:
        out.append(f"{c['distance']:.1f} km from you (covers {c['matched_area']})")
    if c["rating_count"] > 0:
        out.append(f"{float(c['avg_rating']):.1f}★ from {c['rating_count']} review{'s' if c['rating_count'] != 1 else ''}")
    else:
        out.append("New on the platform, no reviews yet")
    cap = []
    if c["years"]:
        cap.append(f"{c['years']} yrs experience")
    if c["verified"]:
        cap.append("credentials verified")
    if c["completed"]:
        cap.append(f"{c['completed']} jobs done")
    if cap:
        out.append(", ".join(cap).capitalize())
    hours_away = (c["next"] - utcnow()).total_seconds() / 3600
    out.append("Can start within a day" if hours_away <= 24 else f"Next free slot in {max(1, round(hours_away / 24))} days")
    return out


def recommend(
    db: Session,
    *,
    category_id: int,
    category_name: str,
    customer_area: str,
    customer_city: str | None,
    customer_point: tuple[float, float] | None,
    complexity: int,
    preferred_date: date | None,
    limit: int,
) -> MatchResponse:
    profile = scoring.profile_for(complexity)
    related = set(related_category_ids(db, category_id))
    radius = settings.MATCH_MAX_RADIUS_KM

    providers = db.scalars(
        select(ProviderProfile)
        .join(User, User.id == ProviderProfile.user_id)
        .where(
            User.is_active.is_(True),
            ProviderProfile.is_accepting_jobs.is_(True),
            ProviderProfile.base_hourly_rate > 0,
            ProviderProfile.specialties.any(ProviderSpecialty.category_id.in_(related)),
        )
        .options(*profile_loader())
    ).all()

    today = datetime.now(local_tz()).date()
    window_start = max(preferred_date or today, today)
    window_days = 1 if preferred_date else settings.MATCH_LOOKAHEAD_DAYS

    # 1) eligibility + the cheap indices
    pool: list[dict] = []
    for p in providers:
        areas = [a.area for a in p.service_areas if not customer_city or a.city.lower() == customer_city.lower()]
        nearest = geo.nearest_area(customer_area, customer_point, areas)
        if nearest is None or nearest[1] > radius:
            continue
        slot = _first_slot(db, p.id, window_start, window_days)
        if slot is None:
            continue  # "available" is a hard requirement
        rate = effective_hourly_rate(p, category_id, related)
        pool.append(
            {
                "p": p, "areas": [a.area for a in p.service_areas], "matched_area": nearest[0], "distance": nearest[1],
                "rate": rate, "next": aware(slot[0]), "open": slot[1],
                "avg_rating": p.avg_rating, "rating_count": p.rating_count, "years": p.years_experience,
                "verified": p.is_credential_verified, "completed": p.completed_jobs,
            }
        )

    # 2) pool-relative price index + final score
    rates = [float(c["rate"]) for c in pool]
    lo, hi = (min(rates), max(rates)) if rates else (0.0, 0.0)
    now = utcnow()
    for c in pool:
        b = scoring.Breakdown(
            proximity=scoring.proximity_index(c["distance"], radius),
            rating=scoring.rating_index(float(c["avg_rating"]), c["rating_count"]),
            capability=scoring.capability_index(c["years"], c["verified"], c["completed"]),
            price=scoring.price_index(float(c["rate"]), lo, hi),
            availability=scoring.availability_index((c["next"] - now).total_seconds() / 3600),
        )
        c["b"], c["score"] = b, scoring.final_score(b, complexity)

    # Ties: nearer first, then better rated.
    pool.sort(key=lambda c: (-c["score"], c["distance"], -float(c["avg_rating"])))

    results = []
    for rank, c in enumerate(pool[:limit], start=1):
        p = c["p"]
        hours, price = scoring.estimate_price(float(c["rate"]), float(p.min_fixed_rate), complexity)
        results.append(
            MatchResult(
                rank=rank, provider_id=p.id, full_name=p.user.full_name, headline=p.headline, avatar_url=p.user.avatar_url,
                avg_rating=p.avg_rating, rating_count=p.rating_count, years_experience=p.years_experience,
                completed_jobs=p.completed_jobs, is_credential_verified=p.is_credential_verified,
                is_contact_verified=p.is_contact_verified, hourly_rate=c["rate"], estimated_hours=hours,
                estimated_price=price, areas=c["areas"], matched_area=c["matched_area"], distance_km=round(c["distance"], 2),
                next_available=c["next"], open_slots=c["open"], score=c["score"],
                breakdown=ScoreBreakdown(**{k: round(v, 3) for k, v in vars(c["b"]).items()}),
                reasons=_reasons(c),
            )
        )

    return MatchResponse(
        category_id=category_id, category_name=category_name, customer_area=customer_area,
        complexity=complexity, complexity_label=profile["label"], weights=ScoreBreakdown(**profile["weights"]),
        window_start=window_start, window_days=window_days, total_candidates=len(pool), results=results,
    )
