from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import ProviderProfile, User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _issue_tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if payload.phone and db.scalar(select(User.id).where(User.phone == payload.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This phone number is already registered")

    user = User(
        email=email,
        phone=payload.phone,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=UserRole(payload.role),
    )
    if user.role == UserRole.PROVIDER:
        user.provider_profile = ProviderProfile()  # empty shell; completed in the onboarding screen
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or phone already registered")
    db.refresh(user)
    return LoginResponse(**_issue_tokens(user).model_dump(), user=UserRead.model_validate(user))


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return LoginResponse(**_issue_tokens(user).model_dump(), user=UserRead.model_validate(user))


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token, REFRESH)
        user = db.get(User, int(claims["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or disabled")
    return _issue_tokens(user)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    if data.get("phone") and data["phone"] != user.phone:
        if db.scalar(select(User.id).where(User.phone == data["phone"], User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "This phone number is already registered")
    for key, value in data.items():
        if key == "full_name" and value is None:
            continue
        setattr(user, key, value)
    db.commit()
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
