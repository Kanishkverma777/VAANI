from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient):
    """Test liveness probe returns 200 OK and valid health metadata."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "timestamp" in data
    assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_readiness_check_when_db_connected(async_client: AsyncClient):
    """Test readiness check when database ping succeeds."""
    with patch("app.api.routes.health.ping_database", return_value=True):
        response = await async_client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["ready"] is True
        assert data["status"] == "ready"
        assert data["dependencies"]["mongodb"] == "connected"


@pytest.mark.asyncio
async def test_readiness_check_when_db_down(async_client: AsyncClient):
    """Test readiness check returns 503 degraded when database ping fails."""
    with patch("app.api.routes.health.ping_database", return_value=False):
        response = await async_client.get("/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["ready"] is False
        assert data["status"] == "degraded"
        assert data["dependencies"]["mongodb"] == "unreachable"


@pytest.mark.asyncio
async def test_standardized_error_response_for_404(async_client: AsyncClient):
    """Test 404 endpoint returns standardized error envelope."""
    response = await async_client.get("/nonexistent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "request_id" in data["error"]
