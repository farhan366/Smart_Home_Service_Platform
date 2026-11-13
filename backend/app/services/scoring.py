from __future__ import annotations

from dataclasses import dataclass

COMPLEXITY_PROFILES: dict[int, dict] = {
    1: {"label": "Simple", "hours": 1.0,
        "weights": {"proximity": 0.35, "rating": 0.25, "capability": 0.10, "price": 0.20, "availability": 0.10}},
    2: {"label": "Standard", "hours": 2.0,
        "weights": {"proximity": 0.30, "rating": 0.28, "capability": 0.22, "price": 0.10, "availability": 0.10}},
    3: {"label": "Complex", "hours": 4.0,
        "weights": {"proximity": 0.22, "rating": 0.28, "capability": 0.35, "price": 0.05, "availability": 0.10}},
}

PRIOR_RATING = 3.5      # what an unrated technician is assumed to be worth
PRIOR_WEIGHT = 5        # ...as if they already had this many reviews at the prior rating
LOOKAHEAD_HOURS = 24 * 7


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def profile_for(complexity: int) -> dict:
    return COMPLEXITY_PROFILES.get(complexity, COMPLEXITY_PROFILES[2])


def proximity_index(distance_km: float, max_radius_km: float) -> float:
    """1.0 in the same area, falling linearly to 0 at the service radius."""
    if distance_km <= 0:
        return 1.0
    return clamp01(1.0 - distance_km / max_radius_km)


def rating_index(avg_rating: float, rating_count: int) -> float:
    """Bayesian-smoothed rating on 0..1: one lucky 5-star review must not beat a long record of 4.8s."""
    smoothed = (avg_rating * rating_count + PRIOR_RATING * PRIOR_WEIGHT) / (rating_count + PRIOR_WEIGHT)
    return clamp01(smoothed / 5.0)


def capability_index(years_experience: int, credential_verified: bool, completed_jobs: int) -> float:
    """How safe is it to hand this technician a hard job?"""
    return clamp01(
        0.5 * clamp01(years_experience / 15)
        + 0.3 * (1.0 if credential_verified else 0.0)
        + 0.2 * clamp01(completed_jobs / 100)
    )


def price_index(rate: float, lowest: float, highest: float) -> float:
    """1.0 for the cheapest candidate, 0.0 for the dearest (min-max across the candidate pool)."""
    if highest <= lowest:
        return 1.0
    return clamp01(1.0 - (rate - lowest) / (highest - lowest))


def availability_index(hours_until_first_slot: float) -> float:
    return clamp01(1.0 - hours_until_first_slot / LOOKAHEAD_HOURS)


@dataclass(frozen=True)
class Breakdown:
    proximity: float
    rating: float
    capability: float
    price: float
    availability: float


def final_score(b: Breakdown, complexity: int) -> float:
    """0..100."""
    w = profile_for(complexity)["weights"]
    total = (
        w["proximity"] * b.proximity
        + w["rating"] * b.rating
        + w["capability"] * b.capability
        + w["price"] * b.price
        + w["availability"] * b.availability
    )
    return round(total * 100, 1)


def estimate_price(hourly_rate: float, min_fixed_rate: float, complexity: int) -> tuple[float, float]:
    """(estimated hours, indicative price). Never below the provider's minimum visit charge."""
    hours = profile_for(complexity)["hours"]
    return hours, max(float(min_fixed_rate), round(float(hourly_rate) * hours, 2))
