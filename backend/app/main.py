import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.config import settings
from app.core.exceptions import AppException
from app.core.logging import logger
from app.database import close_database, init_database


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager to handle startup and shutdown events."""
    logger.info("Starting %s (%s environment)", settings.app_name, settings.app_env)
    # Attempt DB connection
    await init_database()
    yield
    logger.info("Shutting down %s", settings.app_name)
    await close_database()


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title=settings.app_name,
        description="Backend API for VAANI - No-Code Conversational Voice AI Agent Platform",
        version="0.1.0",
        docs_url="/docs" if settings.debug or settings.app_env != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID and logging middleware
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            response.headers["X-Request-ID"] = request_id

            logger.info(
                "%s %s - %d (%.2fms) [req_id=%s]",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                request_id,
            )
            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Unhandled error processing %s %s (%.2fms) [req_id=%s]: %s",
                request.method,
                request.url.path,
                duration_ms,
                request_id,
                str(exc),
            )
            raise exc

    # Exception Handlers
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        req_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "request_id": req_id,
                    "details": exc.details,
                }
            },
            headers={"X-Request-ID": req_id} if req_id else {},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        req_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "The request payload failed schema validation.",
                    "request_id": req_id,
                    "details": exc.errors(),
                }
            },
            headers={"X-Request-ID": req_id} if req_id else {},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        req_id = getattr(request.state, "request_id", None)
        code_map = {
            404: "NOT_FOUND",
            401: "AUTH_REQUIRED",
            403: "FORBIDDEN",
            405: "METHOD_NOT_ALLOWED",
        }
        code = code_map.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": str(exc.detail),
                    "request_id": req_id,
                }
            },
            headers={"X-Request-ID": req_id} if req_id else {},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        req_id = getattr(request.state, "request_id", None)
        logger.exception("Internal server error [req_id=%s]: %s", req_id, str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred while processing the request.",
                    "request_id": req_id,
                }
            },
            headers={"X-Request-ID": req_id} if req_id else {},
        )

    # Route registrations
    app.include_router(health_router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    # Web UI Studio
    index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "index.html")

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    @app.get("/login", response_class=HTMLResponse, include_in_schema=False)
    @app.get("/signup", response_class=HTMLResponse, include_in_schema=False)
    @app.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
    @app.get("/dashboard/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        return HTMLResponse("<h1>VAANI</h1><p>Frontend static files not found.</p>")

    return app


app = create_app()
