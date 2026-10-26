from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user
from app.config import settings
from app.core.exceptions import AuthenticationException, ConflictException
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.user_repository import UserRepository, default_user_repository
from app.schemas.auth import FirebaseAuthRequest, TokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new developer account",
)
async def register(
    data: UserRegister,
    user_repo: UserRepository = Depends(lambda: default_user_repository),
) -> TokenResponse:
    existing = await user_repo.get_by_email(data.email)
    if existing:
        raise ConflictException(
            "An account with this email address already exists.",
            code="EMAIL_ALREADY_REGISTERED",
        )

    pwd_hash = hash_password(data.password)
    user = await user_repo.create(
        email=data.email,
        password_hash=pwd_hash,
        display_name=data.display_name or "User",
    )
    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        display_name=user["display_name"],
        is_active=user["is_active"],
        created_at=user["created_at"],
    )
    token = create_access_token(
        subject=user["id"],
        claims={"email": user["email"], "name": user["display_name"]},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
        user=user_resp,
        id=user["id"],
        email=user["email"],
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and obtain JWT access token",
)
async def login(
    data: UserLogin,
    user_repo: UserRepository = Depends(lambda: default_user_repository),
) -> TokenResponse:
    user = await user_repo.get_by_email(data.email)
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise AuthenticationException(
            "Invalid email or password credentials.",
            code="INVALID_CREDENTIALS",
        )

    if not user.get("is_active", True):
        raise AuthenticationException("Account is currently deactivated.", code="ACCOUNT_DISABLED")

    token = create_access_token(
        subject=user["id"],
        claims={"email": user["email"], "name": user["display_name"]},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        display_name=user["display_name"],
        is_active=user.get("is_active", True),
        created_at=user.get("created_at", ""),
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
        user=user_resp,
        id=user["id"],
        email=user["email"],
    )


@router.post(
    "/firebase",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate or register user via Firebase Auth",
)
async def firebase_auth(
    data: FirebaseAuthRequest,
    user_repo: UserRepository = Depends(lambda: default_user_repository),
) -> TokenResponse:
    """Synchronize Firebase user with MongoDB and issue access token."""
    user = await user_repo.get_by_email(data.email)
    if not user:
        # Create user record in MongoDB
        user = await user_repo.create(
            email=data.email,
            password_hash="firebase_oauth",
            display_name=data.display_name or data.email.split("@")[0],
        )

    token = create_access_token(
        subject=user["id"],
        claims={"email": user["email"], "name": user["display_name"], "firebase_uid": data.uid},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        display_name=user["display_name"],
        is_active=user.get("is_active", True),
        created_at=str(user.get("created_at", "")),
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
        user=user_resp,
        id=user["id"],
        email=user["email"],
    )



@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
async def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserResponse:
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        display_name=current_user["display_name"],
        is_active=current_user["is_active"],
        created_at=current_user.get("created_at", ""),
    )
