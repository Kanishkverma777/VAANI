from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.core.exceptions import NotFoundException, ProviderException
from app.core.logging import logger
from app.integrations.elevenlabs_client import (
    ElevenLabsClient,
    default_elevenlabs_client,
)
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.schemas.agent import AgentConfiguration, AgentStatusEnum
from app.schemas.deployment import (
    DeployAgentResponse,
    DeploymentStateEnum,
    DeploymentStatusResponse,
    PhoneDeploymentInfo,
)


class DeploymentService:
    def __init__(
        self,
        elevenlabs_client: Optional[ElevenLabsClient] = None,
        agent_repo: Optional[AgentRepository] = None,
    ):
        self.client = elevenlabs_client or default_elevenlabs_client
        self.agent_repo = agent_repo or default_agent_repository

    async def deploy_agent(self, agent_id: str, owner_id: str) -> DeployAgentResponse:
        """Synchronize internal agent configuration with ElevenLabs and activate remote conversational agent."""
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        target_owner_id = agent.get("owner_id", owner_id)

        # Mark provisioning state locally
        await self.agent_repo.update_agent(
            agent_id=agent_id,
            owner_id=target_owner_id,
            update_fields={"status": AgentStatusEnum.PROVISIONING.value},
        )

        config = AgentConfiguration.model_validate(agent["configuration"])
        provider_agent_id = agent.get("provider_agent_id")
        now = datetime.now(timezone.utc).isoformat()

        try:
            if provider_agent_id:
                logger.info(
                    "Updating existing ElevenLabs conversational agent %s for agent %s...",
                    provider_agent_id,
                    agent_id,
                )
                try:
                    await self.client.update_agent(
                        provider_agent_id=provider_agent_id,
                        name=agent["name"],
                        config=config,
                    )
                except NotFoundException:
                    logger.warning(
                        "Remote agent %s no longer exists on ElevenLabs (404). Re-provisioning new agent...",
                        provider_agent_id,
                    )
                    provider_agent_id = await self.client.create_agent(
                        name=agent["name"],
                        config=config,
                    )
            else:
                logger.info(
                    "Provisioning new ElevenLabs conversational agent for agent %s...",
                    agent_id,
                )
                provider_agent_id = await self.client.create_agent(
                    name=agent["name"],
                    config=config,
                )

            # Successfully deployed: update state to active
            await self.agent_repo.update_agent(
                agent_id=agent_id,
                owner_id=target_owner_id,
                update_fields={
                    "status": AgentStatusEnum.ACTIVE.value,
                    "provider_agent_id": provider_agent_id,
                    "elevenlabs_agent_id": provider_agent_id,
                    "published_at": now,
                    "last_deployment_error": None,
                },
            )

            frontend_base = (
                settings.allowed_origins[0] if settings.allowed_origins else "http://localhost:3000"
            )
            shareable_url = f"{frontend_base}/experience/{agent_id}"

            return DeployAgentResponse(
                agent_id=agent_id,
                status=DeploymentStateEnum.ACTIVE,
                provider="elevenlabs",
                provider_agent_id=provider_agent_id,
                elevenlabs_agent_id=provider_agent_id,
                version_deployed=agent.get("current_version", 1),
                shareable_url=shareable_url,
                phone_deployment=PhoneDeploymentInfo(),
                deployed_at=now,
            )

        except Exception as exc:
            logger.exception("Deployment failed for agent %s: %s", agent_id, str(exc))
            # Mark deployment failed but preserve local configuration
            await self.agent_repo.update_agent(
                agent_id=agent_id,
                owner_id=target_owner_id,
                update_fields={
                    "status": AgentStatusEnum.DEPLOYMENT_FAILED.value,
                    "last_deployment_error": str(exc),
                },
            )
            raise ProviderException(
                f"Deployment to ElevenLabs failed: {str(exc)}. Your local configuration is preserved.",
                code="DEPLOYMENT_FAILED",
                details={"agent_id": agent_id, "provider_agent_id": provider_agent_id},
            )

    async def get_deployment_status(self, agent_id: str, owner_id: str) -> DeploymentStatusResponse:
        """Fetch current deployment status and public web experience configuration."""
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        raw_status = agent.get("status", AgentStatusEnum.DRAFT.value)
        status_map = {
            AgentStatusEnum.ACTIVE.value: DeploymentStateEnum.ACTIVE,
            AgentStatusEnum.PROVISIONING.value: DeploymentStateEnum.PROVISIONING,
            AgentStatusEnum.DEPLOYMENT_FAILED.value: DeploymentStateEnum.FAILED,
            AgentStatusEnum.CONFIGURED.value: DeploymentStateEnum.PENDING,
            AgentStatusEnum.DRAFT.value: DeploymentStateEnum.PENDING,
        }
        state = status_map.get(raw_status, DeploymentStateEnum.PENDING)

        frontend_base = (
            settings.allowed_origins[0] if settings.allowed_origins else "http://localhost:3000"
        )
        shareable_url = (
            f"{frontend_base}/experience/{agent_id}"
            if state == DeploymentStateEnum.ACTIVE
            else None
        )

        p_id = agent.get("provider_agent_id") or agent.get("elevenlabs_agent_id")
        return DeploymentStatusResponse(
            agent_id=agent_id,
            status=state,
            provider=agent.get("provider", "elevenlabs"),
            provider_agent_id=p_id,
            elevenlabs_agent_id=p_id,
            version_deployed=agent.get("current_version", 1),
            shareable_url=shareable_url,
            phone_deployment=PhoneDeploymentInfo(),
            last_deployed_at=agent.get("published_at"),
            error_message=agent.get("last_deployment_error"),
        )


default_deployment_service = DeploymentService()
