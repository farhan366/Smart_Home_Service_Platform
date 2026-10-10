import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.models import UserRole

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
BD_PHONE = re.compile(r"^(\+?88)?01[3-9]\d{8}$")


def _check_password(v: str) -> str:
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
        raise ValueError("Password must contain at least one letter and one digit")
    return v


def _check_phone(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    v = v.replace(" ", "").replace("-", "")
    if not BD_PHONE.match(v):
        raise ValueError("Enter a valid Bangladeshi mobile number, e.g. 01712345678")
    return v


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Name
    phone: str | None = None
    role: Literal["customer", "provider"] = "customer"  # admins are never self-registered

    _pw = field_validator("password")(_check_password)
    _ph = field_validator("phone")(_check_phone)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

    _pw = field_validator("new_password")(_check_password)


class UserUpdate(BaseModel):
    full_name: Name | None = None
    phone: str | None = None
    avatar_url: str | None = Field(default=None, max_length=500)

    _ph = field_validator("phone")(_check_phone)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    phone: str | None
    role: UserRole
    avatar_url: str | None
    is_active: bool
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(TokenPair):
    user: UserRead
