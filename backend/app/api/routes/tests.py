from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user
from app.schemas.testing import TestRunResponse
from app.services.testing_service import TestingService, default_testing_service

router = APIRouter(prefix="/agents", tags=["Testing & Evaluation"])


def get_testing_service() -> TestingService:
    return default_testing_service


@router.post(
    "/{agent_id}/tests",
    response_model=TestRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute automated test scenarios against the agent configuration",
)
async def run_agent_tests(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: TestingService = Depends(get_testing_service),
) -> TestRunResponse:
    """Run 7 categories of automated checks (normal, ambiguous, unsupported, language, guardrails, escalation, flow) and record explainable score."""
    return await service.run_agent_tests(agent_id=agent_id, owner_id=current_user["id"])


@router.get(
    "/{agent_id}/tests",
    response_model=List[TestRunResponse],
    status_code=status.HTTP_200_OK,
    summary="List previous automated test runs for an agent",
)
async def list_agent_tests(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: TestingService = Depends(get_testing_service),
) -> List[TestRunResponse]:
    """Retrieve historical evaluation runs for the specified agent."""
    return await service.list_agent_tests(agent_id=agent_id, owner_id=current_user["id"])


@router.get(
    "/{agent_id}/tests/{test_run_id}",
    response_model=TestRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Get details and explanation for a specific test run",
)
async def get_test_run(
    agent_id: str,
    test_run_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: TestingService = Depends(get_testing_service),
) -> TestRunResponse:
    """Fetch individual scenario results, pass/fail explanations, and score breakdown for a specific evaluation."""
    return await service.get_test_run(test_run_id=test_run_id, owner_id=current_user["id"])
