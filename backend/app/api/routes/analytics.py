from typing import Any, Dict

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user
from app.schemas.analytics import AgentAnalyticsResponse, AnalyticsOverviewResponse
from app.services.analytics_service import AnalyticsService, default_analytics_service

router = APIRouter(tags=["Analytics"])


def get_analytics_service() -> AnalyticsService:
    return default_analytics_service


@router.get(
    "/analytics/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated conversation analytics across all agents for current user",
)
@router.get(
    "/agents/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated conversation analytics across all agents for current user (alias)",
)
async def get_overview_analytics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsOverviewResponse:
    """Retrieve measured conversation metrics across all user agents."""
    return await service.get_overview_analytics(owner_id=current_user["id"])


@router.get(
    "/agents/{agent_id}/analytics",
    response_model=AgentAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get conversation analytics and metrics for an agent",
)
async def get_agent_analytics(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service),
) -> AgentAnalyticsResponse:
    """Retrieve measured conversation metrics, turn latency, durations, and outcomes."""
    return await service.get_agent_analytics(agent_id=agent_id, owner_id=current_user["id"])

