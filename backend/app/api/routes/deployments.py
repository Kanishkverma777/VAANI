from typing import Any, Dict

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user
from app.schemas.deployment import DeployAgentResponse, DeploymentStatusResponse
from app.schemas.refinement import RefineAgentRequest, RefineAgentResponse
from app.schemas.telephony import (
    OutboundCallRequest,
    OutboundCallResponse,
    TelephonyStatusResponse,
)
from app.services.deployment_service import DeploymentService, default_deployment_service
from app.services.refinement_service import RefinementService, default_refinement_service
from app.services.telephony_service import TelephonyService, default_telephony_service

router = APIRouter(prefix="/agents", tags=["Refinement & Deployment"])


def get_refinement_service() -> RefinementService:
    return default_refinement_service


def get_deployment_service() -> DeploymentService:
    return default_deployment_service


def get_telephony_service() -> TelephonyService:
    return default_telephony_service


@router.post(
    "/{agent_id}/refine",
    response_model=RefineAgentResponse,
    status_code=status.HTTP_200_OK,
    summary="Refine agent configuration using natural language instructions",
)
async def refine_agent(
    agent_id: str,
    request: RefineAgentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: RefinementService = Depends(get_refinement_service),
) -> RefineAgentResponse:
    """Apply conversational edits to an agent configuration and create a new version."""
    return await service.refine_agent(
        agent_id=agent_id, owner_id=current_user["id"], request=request
    )


@router.post(
    "/{agent_id}/deploy",
    response_model=DeployAgentResponse,
    status_code=status.HTTP_200_OK,
    summary="Deploy or update agent on ElevenLabs",
)
async def deploy_agent(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: DeploymentService = Depends(get_deployment_service),
) -> DeployAgentResponse:
    """Synchronize agent configuration with ElevenLabs and activate remote conversational AI agent."""
    return await service.deploy_agent(agent_id=agent_id, owner_id=current_user["id"])


@router.get(
    "/{agent_id}/deployment",
    response_model=DeploymentStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get deployment status and public web experience link",
)
async def get_deployment_status(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentStatusResponse:
    """Retrieve current remote deployment status and shareable web link."""
    return await service.get_deployment_status(agent_id=agent_id, owner_id=current_user["id"])


@router.post(
    "/{agent_id}/telephony/call",
    response_model=OutboundCallResponse,
    status_code=status.HTTP_200_OK,
    summary="Dispatch outbound call to a real destination phone number",
)
async def trigger_outbound_call(
    agent_id: str,
    request: OutboundCallRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: TelephonyService = Depends(get_telephony_service),
) -> OutboundCallResponse:
    """Trigger a live phone call to any real phone number using Twilio or ElevenLabs Telephony."""
    result = await service.trigger_outbound_call(
        agent_id=agent_id,
        owner_id=current_user["id"],
        to_number=request.to_number,
        from_number=request.from_number,
    )
    return OutboundCallResponse(**result)


@router.get(
    "/{agent_id}/telephony/status",
    response_model=TelephonyStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get telephony provider readiness and configuration status",
)
async def get_telephony_status(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: TelephonyService = Depends(get_telephony_service),
) -> TelephonyStatusResponse:
    """Check whether Twilio or ElevenLabs carrier phone lines are configured."""
    status_data = await service.get_telephony_status()
    return TelephonyStatusResponse(**status_data)

