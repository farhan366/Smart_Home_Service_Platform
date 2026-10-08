import re
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ServiceCategory
from app.schemas.service import CategoryTree


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def unique_slug(db: Session, name: str, parent_slug: str | None = None) -> str:
    base = slugify(f"{parent_slug}-{name}" if parent_slug else name)
    slug, n = base, 2
    while db.scalar(select(ServiceCategory.id).where(ServiceCategory.slug == slug)):
        slug, n = f"{base}-{n}", n + 1
    return slug


def build_tree(categories: list[ServiceCategory]) -> list[CategoryTree]:
    by_parent: dict[int | None, list[ServiceCategory]] = defaultdict(list)
    for c in categories:
        by_parent[c.parent_id].append(c)

    def node(c: ServiceCategory) -> CategoryTree:
        kids = sorted(by_parent.get(c.id, []), key=lambda k: (k.sort_order, k.name))
        return CategoryTree(
            id=c.id, name=c.name, slug=c.slug, description=c.description, icon=c.icon,
            children=[node(k) for k in kids],
        )

    roots = sorted(by_parent.get(None, []), key=lambda k: (k.sort_order, k.name))
    return [node(r) for r in roots]


def descendant_ids(db: Session, category_id: int) -> list[int]:
    """The category itself plus every active descendant (any depth)."""
    rows = db.execute(
        select(ServiceCategory.id, ServiceCategory.parent_id).where(ServiceCategory.is_active.is_(True))
    ).all()
    children: dict[int, list[int]] = defaultdict(list)
    for cid, pid in rows:
        if pid is not None:
            children[pid].append(cid)
    result, stack = [], [category_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children.get(current, []))
    return result
