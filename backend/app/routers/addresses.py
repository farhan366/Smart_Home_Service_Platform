from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.deps import require_customer
from app.db.session import get_db
from app.models import Address, User
from app.schemas.address import AddressCreate, AddressRead, AddressUpdate

router = APIRouter(prefix="/addresses", tags=["Addresses"])

MAX_ADDRESSES = 10


def _get_owned(db: Session, user: User, address_id: int) -> Address:
    address = db.scalar(select(Address).where(Address.id == address_id, Address.user_id == user.id))
    if address is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
    return address


def _clear_default(db: Session, user_id: int) -> None:
    db.execute(update(Address).where(Address.user_id == user_id, Address.is_default.is_(True)).values(is_default=False))


@router.get("", response_model=list[AddressRead])
def list_addresses(user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return db.scalars(
        select(Address).where(Address.user_id == user.id).order_by(Address.is_default.desc(), Address.id)
    ).all()


@router.post("", response_model=AddressRead, status_code=status.HTTP_201_CREATED)
def create_address(payload: AddressCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    existing = db.scalars(select(Address.id).where(Address.user_id == user.id)).all()
    if len(existing) >= MAX_ADDRESSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can save up to {MAX_ADDRESSES} addresses")
    make_default = payload.is_default or not existing  # first address is always the default
    if make_default:
        _clear_default(db, user.id)
    address = Address(**payload.model_dump(exclude={"is_default"}), user_id=user.id, is_default=make_default)
    db.add(address)
    db.commit()
    return address


@router.get("/{address_id}", response_model=AddressRead)
def get_address(address_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return _get_owned(db, user, address_id)


@router.patch("/{address_id}", response_model=AddressRead)
def update_address(
    address_id: int, payload: AddressUpdate, user: User = Depends(require_customer), db: Session = Depends(get_db)
):
    address = _get_owned(db, user, address_id)
    data = payload.model_dump(exclude_unset=True)
    is_default = data.pop("is_default", None)
    for key, value in data.items():
        if value is not None or key in ("latitude", "longitude"):
            setattr(address, key, value)
    if is_default is True and not address.is_default:
        _clear_default(db, user.id)
        db.flush()
        address.is_default = True
    elif is_default is False and address.is_default:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose another address as default instead")
    db.commit()
    return address


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(address_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    address = _get_owned(db, user, address_id)
    was_default = address.is_default
    db.delete(address)
    db.flush()
    if was_default:  # promote the most recent remaining address
        successor = db.scalar(select(Address).where(Address.user_id == user.id).order_by(Address.id.desc()))
        if successor:
            successor.is_default = True
    db.commit()
