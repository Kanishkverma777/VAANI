from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    is_active: bool
    created_at: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    display_name: Optional[str] = None
    full_name: Optional[str] = None

    @model_validator(mode="after")
    def validate_name(self) -> "UserRegister":
        name = self.display_name or self.full_name or self.email.split("@")[0]
        self.display_name = name.strip() or "User"
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: Optional[UserResponse] = None
    id: Optional[str] = None
    email: Optional[EmailStr] = None


class FirebaseAuthRequest(BaseModel):
    uid: str
    email: EmailStr
    id_token: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


