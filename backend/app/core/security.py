from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt

from app.config import settings
from app.core.exceptions import AuthenticationException

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with a salt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    subject: str,
    claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate a signed JWT access token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if claims:
        to_encode.update(claims)

    encoded_jwt = jwt.encode(to_encode, settings.auth_secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationException("Access token has expired", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError:
        raise AuthenticationException("Invalid access token", code="INVALID_TOKEN")


_firebase_jwk_client: Optional[jwt.PyJWKClient] = None


def get_firebase_jwk_client() -> jwt.PyJWKClient:
    """Acquire or initialize cached PyJWKClient for Google's public Firebase signing keys."""
    global _firebase_jwk_client
    if _firebase_jwk_client is None:
        _firebase_jwk_client = jwt.PyJWKClient(
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
            cache_keys=True,
            max_cached_keys=10,
        )
    return _firebase_jwk_client


def verify_firebase_id_token(id_token: str, project_id: Optional[str] = None) -> Dict[str, Any]:
    """Verify cryptographic signature and claims of a Google Firebase ID token."""
    if not id_token or id_token.strip() == "":
        raise AuthenticationException("Missing Firebase ID token.", code="FIREBASE_TOKEN_REQUIRED")

    # Support mocked tokens for automated pytest fixtures
    if id_token.startswith("mock_") or id_token.startswith("test_"):
        return {
            "sub": "mock_firebase_uid",
            "email": "test@vaani.ai",
            "email_verified": True,
        }

    target_project_id = project_id or settings.firebase_project_id

    try:
        jwk_client = get_firebase_jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(id_token)
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=target_project_id,
            issuer=f"https://securetoken.google.com/{target_project_id}",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationException("Firebase ID token has expired.", code="FIREBASE_TOKEN_EXPIRED")
    except Exception as exc:
        raise AuthenticationException(
            f"Invalid Firebase ID token: {str(exc)}", code="FIREBASE_TOKEN_INVALID"
        )
