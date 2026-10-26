from fastapi import APIRouter, Depends, status

from app.schemas.generation import GenerateAgentRequest, GenerateAgentResponse
from app.services.generation_service import GenerationService, default_generation_service

router = APIRouter(prefix="/agents", tags=["Generation"])


def get_generation_service() -> GenerationService:
    return default_generation_service


@router.post(
    "/generate",
    response_model=GenerateAgentResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate an Agent Configuration from Natural Language",
)
async def generate_agent(
    request: GenerateAgentRequest,
    service: GenerationService = Depends(get_generation_service),
) -> GenerateAgentResponse:
    """Analyze a natural-language description and generate a typed voice AI agent configuration."""
    return await service.generate_agent_config(request)
