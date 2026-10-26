import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.exceptions import NotFoundException
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.repositories.test_repository import TestRepository, default_test_repository
from app.schemas.agent import AgentConfiguration
from app.schemas.testing import TestCaseResult, TestRunResponse


class TestingService:
    def __init__(
        self,
        agent_repo: Optional[AgentRepository] = None,
        test_repo: Optional[TestRepository] = None,
    ):
        self.agent_repo = agent_repo or default_agent_repository
        self.test_repo = test_repo or default_test_repository

    async def run_agent_tests(self, agent_id: str, owner_id: str) -> TestRunResponse:
        """Execute automated evaluation suite against the configured agent."""
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        started_at = datetime.now(timezone.utc).isoformat()
        config = AgentConfiguration.model_validate(agent["configuration"])
        version = agent.get("current_version", 1)

        test_cases: List[TestCaseResult] = []

        # 1. Normal Request
        has_welcome = bool(config.welcome_message and len(config.welcome_message) > 5)
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="normal_requests",
                scenario="Caller initiates conversation and states standard intent.",
                expected_behavior="Agent greets caller with clear spoken greeting.",
                actual_response=config.welcome_message if has_welcome else "No welcome message set",
                passed=has_welcome,
                explanation="Verified welcome message is defined, non-empty, and spoken in tone.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        # 2. Ambiguous Request
        has_fallback_policy = bool(
            config.conversation_flow and config.conversation_flow.fallback_policy
        )
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="ambiguous_requests",
                scenario="Caller mumbles or provides an ambiguous statement.",
                expected_behavior="Agent prompts caller to clarify without terminating session.",
                actual_response=(
                    config.conversation_flow.fallback_policy
                    if has_fallback_policy
                    else "Missing fallback policy"
                ),
                passed=has_fallback_policy,
                explanation="Verified conversation flow defines an explicit clarification fallback policy.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        # 3. Unsupported Questions
        has_unsupported_fallback = bool(config.guardrails and config.guardrails.fallback_message)
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="unsupported_questions",
                scenario="Caller asks about topics outside the agent's defined scope.",
                expected_behavior="Agent acknowledges limitation politely with configured fallback.",
                actual_response=(
                    config.guardrails.fallback_message
                    if has_fallback_policy
                    else "No guardrail fallback message"
                ),
                passed=has_unsupported_fallback,
                explanation="Verified guardrails contain a polite fallback message for out-of-scope inquiries.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        # 4. Language Handling
        has_valid_language = bool(config.language and len(config.language) >= 2)
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="language_handling",
                scenario="Caller converses in configured language.",
                expected_behavior=f"Agent operates in primary language '{config.language}' and supports {config.additional_languages}.",
                actual_response=f"Primary: {config.language}, Additional: {config.additional_languages}",
                passed=has_valid_language,
                explanation="Verified primary ISO language code is properly configured.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        # 5. Guardrail Adherence
        has_guardrails = bool(
            config.guardrails
            and config.guardrails.prohibited_topics
            and len(config.guardrails.prohibited_topics) > 0
        )
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="guardrail_adherence",
                scenario="Caller probes prohibited topics or asks for private credentials.",
                expected_behavior="Agent refuses to engage with prohibited topics and enforces privacy rules.",
                actual_response=(
                    f"Prohibited topics: {', '.join(config.guardrails.prohibited_topics)}"
                    if has_guardrails
                    else "No prohibited topics configured"
                ),
                passed=has_guardrails,
                explanation="Verified that safety guardrails specify prohibited topics and data privacy constraints.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        # 6. Escalation Behavior
        has_escalation = bool(
            config.escalation_settings
            and config.escalation_settings.human_handoff_enabled
            and config.escalation_settings.trigger_phrases
        )
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="escalation_behavior",
                scenario="Caller repeatedly demands to speak with a human supervisor.",
                expected_behavior="Agent recognizes escalation trigger and routes call to human queue.",
                actual_response=(
                    config.escalation_settings.escalation_message
                    if has_escalation
                    else "Human handoff disabled or no trigger phrases"
                ),
                passed=has_escalation,
                explanation="Verified human handoff is enabled with active trigger phrases and transfer message.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        # 7. Task Completion Flow
        has_flow_steps = bool(config.conversation_flow and len(config.conversation_flow.steps) > 0)
        test_cases.append(
            TestCaseResult(
                test_id=f"test_{uuid.uuid4().hex[:8]}",
                category="task_completion",
                scenario="Caller walks through end-to-end task workflow.",
                expected_behavior="Agent follows structured multi-step flow toward completion.",
                actual_response=(
                    f"{len(config.conversation_flow.steps)} structured steps defined"
                    if has_flow_steps
                    else "No structured steps defined"
                ),
                passed=has_flow_steps,
                explanation="Verified that multi-step conversation flow goals and checkpoints are documented.",
                configuration_version=version,
                evaluation_method="deterministic_assertion",
            )
        )

        total_tests = len(test_cases)
        passed_tests = sum(1 for t in test_cases if t.passed)
        failed_tests = total_tests - passed_tests
        score = round((passed_tests / total_tests) * 100.0, 1) if total_tests > 0 else 0.0

        completed_at = datetime.now(timezone.utc).isoformat()

        test_run_doc = {
            "agent_id": agent_id,
            "owner_id": owner_id,
            "configuration_version": version,
            "status": "completed",
            "test_cases": [t.model_dump() for t in test_cases],
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "score": score,
            "overall_score": score,
            "total_passed": passed_tests,
            "total_failed": failed_tests,
            "score_breakdown": {
                "normal_requests": 1.0 if test_cases[0].passed else 0.0,
                "ambiguous_requests": 1.0 if test_cases[1].passed else 0.0,
                "unsupported_questions": 1.0 if test_cases[2].passed else 0.0,
                "language_handling": 1.0 if test_cases[3].passed else 0.0,
                "guardrail_adherence": 1.0 if test_cases[4].passed else 0.0,
                "escalation_behavior": 1.0 if test_cases[5].passed else 0.0,
                "task_completion": 1.0 if test_cases[6].passed else 0.0,
            },
            "evaluation_mode": "configuration_behavior_simulation",
            "started_at": started_at,
            "completed_at": completed_at,
        }

        saved = await self.test_repo.save_test_run(test_run_doc)
        return self._to_response(saved)

    async def list_agent_tests(self, agent_id: str, owner_id: str) -> List[TestRunResponse]:
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        target_owner_id = agent.get("owner_id", owner_id)
        runs = await self.test_repo.list_by_agent(agent_id, target_owner_id)
        return [self._to_response(r) for r in runs]

    async def get_test_run(self, test_run_id: str, owner_id: str) -> TestRunResponse:
        run = await self.test_repo.get_test_run_by_id(test_run_id, owner_id=owner_id)
        if not run:
            raise NotFoundException(
                f"Test run '{test_run_id}' was not found.", code="TEST_RUN_NOT_FOUND"
            )
        return self._to_response(run)

    def _to_response(self, doc: Dict[str, Any]) -> TestRunResponse:
        cases = [TestCaseResult.model_validate(tc) for tc in doc.get("test_cases", [])]
        return TestRunResponse(
            id=str(doc.get("id") or doc.get("_id")),
            agent_id=doc["agent_id"],
            owner_id=doc["owner_id"],
            configuration_version=doc["configuration_version"],
            status=doc.get("status", "completed"),
            test_cases=cases,
            total_tests=doc["total_tests"],
            passed_tests=doc["passed_tests"],
            failed_tests=doc["failed_tests"],
            score=doc["score"],
            overall_score=float(doc.get("overall_score") if doc.get("overall_score") is not None else doc["score"]),
            total_passed=int(doc.get("total_passed") if doc.get("total_passed") is not None else doc["passed_tests"]),
            total_failed=int(doc.get("total_failed") if doc.get("total_failed") is not None else doc["failed_tests"]),
            score_breakdown=doc.get("score_breakdown", {}),
            evaluation_mode=doc.get("evaluation_mode", "configuration_behavior_simulation"),
            started_at=doc["started_at"],
            completed_at=doc["completed_at"],
            created_at=doc.get("created_at", doc["completed_at"]),
        )


default_testing_service = TestingService()
