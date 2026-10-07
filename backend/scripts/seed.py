"""Seed the catalog and an admin account.  Run from backend/:  python -m scripts.seed"""
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import ServiceCategory, User, UserRole
from app.services.catalog_service import slugify

CATALOG = {
    ("Electrical", "zap"): ["AC Servicing", "Wiring & Fittings", "Appliance Repair", "CCTV & Security", "Generator & IPS"],
    ("Plumbing", "droplets"): ["Leak Repair", "Bathroom Fitting", "Water Tank & Pump", "Drain Cleaning"],
    ("Cleaning", "sparkles"): ["Deep Home Cleaning", "Sofa & Carpet", "Kitchen Cleaning", "Water Tank Cleaning"],
    ("Carpentry", "hammer"): ["Furniture Repair", "Door & Window", "Modular Kitchen"],
    ("Painting", "paint-roller"): ["Interior Painting", "Exterior Painting", "Waterproofing"],
    ("Pest Control", "bug"): ["Cockroach & Ant", "Termite Treatment", "Rodent Control"],
}


def run() -> None:
    with SessionLocal() as db:
        for order, ((name, icon), subs) in enumerate(CATALOG.items()):
            parent = db.scalar(select(ServiceCategory).where(ServiceCategory.slug == slugify(name)))
            if parent is None:
                parent = ServiceCategory(name=name, slug=slugify(name), icon=icon, sort_order=order)
                db.add(parent)
                db.flush()
            for i, sub in enumerate(subs):
                slug = slugify(f"{name}-{sub}")
                if not db.scalar(select(ServiceCategory.id).where(ServiceCategory.slug == slug)):
                    db.add(ServiceCategory(name=sub, slug=slug, parent_id=parent.id, sort_order=i))
        if not db.scalar(select(User.id).where(User.email == settings.SEED_ADMIN_EMAIL)):
            db.add(
                User(
                    email=settings.SEED_ADMIN_EMAIL,
                    full_name="Platform Admin",
                    hashed_password=hash_password(settings.SEED_ADMIN_PASSWORD),
                    role=UserRole.ADMIN,
                )
            )
        db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    run()
