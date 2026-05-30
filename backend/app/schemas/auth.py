from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool
    is_admin: bool
    is_organizer: bool = False

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture: Optional[str] = None
    bio: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: str
