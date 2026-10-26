from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token
from app.main import app
from tests.mock_mongo import MockAsyncDatabase

mock_db = MockAsyncDatabase()


@pytest.fixture(autouse=True)
def reset_mock_db(monkeypatch):
    """Automatically reset in-memory database between tests and patch get_collection."""
    mock_db.clear()
    monkeypatch.setattr("app.database.get_collection", lambda name: mock_db[name])
    monkeypatch.setattr(
        "app.repositories.user_repository.get_collection", lambda name: mock_db[name]
    )
    monkeypatch.setattr(
        "app.repositories.agent_repository.get_collection", lambda name: mock_db[name]
    )
    monkeypatch.setattr(
        "app.repositories.session_repository.get_collection", lambda name: mock_db[name]
    )
    monkeypatch.setattr(
        "app.repositories.knowledge_repository.get_collection", lambda name: mock_db[name]
    )
    monkeypatch.setattr(
        "app.repositories.test_repository.get_collection", lambda name: mock_db[name]
    )
    yield


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for testing FastAPI endpoints without a network server."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers() -> dict:
    """Generate authenticated user headers for test user."""
    token = create_access_token(
        subject="test_user_id_123",
        claims={"email": "developer@voiceforge.ai", "name": "Test User"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_user_auth_headers() -> dict:
    """Generate authenticated user headers for a second user to test ownership boundaries."""
    token = create_access_token(
        subject="other_user_id_999",
        claims={"email": "other@voiceforge.ai", "name": "Other User"},
    )
    return {"Authorization": f"Bearer {token}"}
