from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TestCaseResult(BaseModel):
    test_id: str
    category: str = Field(
        ...,
        description="One of: normal_request, ambiguous_request, unsupported_question, language_handling, guardrail_adherence, escalation_behavior, task_completion",
    )
    scenario: str
    expected_behavior: str
    actual_response: str
    passed: bool
    explanation: str
    configuration_version: int
    evaluation_method: str = Field(
        default="deterministic_assertion",
        description="Method used for evaluation: 'deterministic_assertion' or 'llm_semantic_evaluation'.",
    )


class TestRunResponse(BaseModel):
    id: str
    agent_id: str
    owner_id: str
    configuration_version: int
    status: str = "completed"
    test_cases: List[TestCaseResult]
    total_tests: int
    passed_tests: int
    failed_tests: int
    score: float = Field(
        ...,
        description="Score calculated strictly from percentage of passed test scenarios (0 to 100).",
    )
    overall_score: Optional[float] = None
    total_passed: Optional[int] = None
    total_failed: Optional[int] = None
    score_breakdown: Dict[str, Any] = Field(default_factory=dict)
    evaluation_mode: str = Field(
        default="configuration_behavior_simulation",
        description="Evaluates configuration completeness, guardrail rules, and simulated conversation handling.",
    )
    started_at: str
    completed_at: str
    created_at: str
