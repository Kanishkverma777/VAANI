from typing import Any, Optional


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class NotFoundException(AppException):
    def __init__(
        self,
        message: str = "Resource not found",
        code: str = "NOT_FOUND",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=404, details=details)


class AuthenticationException(AppException):
    def __init__(
        self,
        message: str = "Authentication required",
        code: str = "AUTH_REQUIRED",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=401, details=details)


class PermissionDeniedException(AppException):
    def __init__(
        self,
        message: str = "Permission denied",
        code: str = "FORBIDDEN",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=403, details=details)


class ValidationException(AppException):
    def __init__(
        self,
        message: str = "Validation failed",
        code: str = "VALIDATION_ERROR",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=422, details=details)


class ConflictException(AppException):
    def __init__(
        self,
        message: str = "Resource conflict",
        code: str = "CONFLICT",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=409, details=details)


class ProviderException(AppException):
    def __init__(
        self,
        message: str = "External provider error",
        code: str = "PROVIDER_ERROR",
        status_code: int = 502,
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=status_code, details=details)


class RateLimitException(AppException):
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        code: str = "RATE_LIMIT_EXCEEDED",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=429, details=details)


class ConfigurationException(AppException):
    def __init__(
        self,
        message: str = "Service configuration error",
        code: str = "CONFIGURATION_ERROR",
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=503, details=details)
