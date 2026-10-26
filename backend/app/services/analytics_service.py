from typing import Optional

from app.core.cache import default_cache
from app.core.exceptions import NotFoundException
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.repositories.session_repository import (
    SessionRepository,
    default_session_repository,
)
from app.schemas.analytics import AgentAnalyticsResponse, AnalyticsOverviewResponse


class AnalyticsService:
    def __init__(
        self,
        agent_repo: Optional[AgentRepository] = None,
        session_repo: Optional[SessionRepository] = None,
    ):
        self.agent_repo = agent_repo or default_agent_repository
        self.session_repo = session_repo or default_session_repository

    async def get_overview_analytics(self, owner_id: str) -> AnalyticsOverviewResponse:
        """Fetch computed user-wide overview metrics with fast in-memory caching."""
        cache_key = f"analytics:overview:{owner_id}"
        cached_stats = await default_cache.get(cache_key)
        if cached_stats is not None:
            return cached_stats

        agents, total_agents = await self.agent_repo.list_agents(owner_id, skip=0, limit=200)
        active_count = sum(
            1 for a in agents if a.get("status") == "active" or a.get("provider_agent_id")
        )

        stats = await self.session_repo.calculate_overview_analytics(owner_id)
        stats["active_agents_count"] = active_count
        stats["total_agents_count"] = total_agents

        response = AnalyticsOverviewResponse(**stats)
        await default_cache.set(cache_key, response, ttl_seconds=20.0)
        return response

    async def get_agent_analytics(self, agent_id: str, owner_id: str) -> AgentAnalyticsResponse:
        """Fetch computed analytics for an agent with cached latency metrics."""
        cache_key = f"analytics:agent:{agent_id}:{owner_id}"
        cached_metrics = await default_cache.get(cache_key)
        if cached_metrics is not None:
            return cached_metrics

        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        metrics = await self.session_repo.calculate_analytics(agent_id, owner_id)
        response = AgentAnalyticsResponse(**metrics)
        await default_cache.set(cache_key, response, ttl_seconds=20.0)
        return response


default_analytics_service = AnalyticsService()
