from __future__ import annotations
import math
import re

# (latitude, longitude): approximate neighbourhood centres, good enough for ranking, not for navigation.
AREA_CENTROIDS: dict[str, tuple[float, float]] = {
    "dhanmondi": (23.7461, 90.3742),
    "lalmatia": (23.7556, 90.3665),
    "mohammadpur": (23.7662, 90.3589),
    "shyamoli": (23.7742, 90.3654),
    "mirpur": (23.8223, 90.3654),
    "pallabi": (23.8334, 90.3647),
    "uttara": (23.8759, 90.3795),
    "farmgate": (23.7561, 90.3872),
    "tejgaon": (23.7639, 90.3925),
    "karwan bazar": (23.7512, 90.3937),
    "mohakhali": (23.7782, 90.4056),
    "banani": (23.7937, 90.4066),
    "gulshan": (23.7925, 90.4078),
    "baridhara": (23.8007, 90.4219),
    "niketan": (23.7787, 90.4130),
    "badda": (23.7806, 90.4258),
    "bashundhara": (23.8193, 90.4526),
    "rampura": (23.7612, 90.4247),
    "banasree": (23.7632, 90.4338),
    "khilgaon": (23.7510, 90.4285),
    "malibagh": (23.7489, 90.4128),
    "motijheel": (23.7330, 90.4172),
    "wari": (23.7184, 90.4190),
    "old dhaka": (23.7104, 90.4074),
    "jatrabari": (23.7104, 90.4350),
    "kakrail": (23.7367, 90.4093),
    "paltan": (23.7358, 90.4125),
}

_ALIASES = {
    "bashundhara r/a": "bashundhara",
    "bashundhara ra": "bashundhara",
    "bashundhara residential area": "bashundhara",
    "mirpur dohs": "mirpur",
    "old town": "old dhaka",
    "puran dhaka": "old dhaka",
}


def normalize_area(name: str | None) -> str:
    if not name:
        return ""
    n = re.sub(r"\s+", " ", name.strip().lower())
    if n in _ALIASES:
        return _ALIASES[n]
    n = re.sub(r"[-\s]*(?:no\.?\s*)?\d+[a-z]?$", "", n)  # trailing sector / avenue number
    n = re.sub(r"[^a-z/ ]+", " ", n).strip()
    n = re.sub(r"\s+", " ", n)
    return _ALIASES.get(n, n)


def centroid(area: str | None) -> tuple[float, float] | None:
    return AREA_CENTROIDS.get(normalize_area(area))


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def area_distance_km(
    customer_area: str,
    customer_point: tuple[float, float] | None,
    provider_area: str,
) -> float | None:
   
    if normalize_area(customer_area) == normalize_area(provider_area) and normalize_area(customer_area):
        return 0.0
    provider_point = centroid(provider_area)
    origin = customer_point or centroid(customer_area)
    if origin is None or provider_point is None:
        return None
    return haversine_km(origin, provider_point)


def nearest_area(
    customer_area: str,
    customer_point: tuple[float, float] | None,
    provider_areas: list[str],
) -> tuple[str, float] | None:
    best: tuple[str, float] | None = None
    for area in provider_areas:
        d = area_distance_km(customer_area, customer_point, area)
        if d is not None and (best is None or d < best[1]):
            best = (area, d)
    return best
