import json
from typing import Any, Dict, Optional

from pydantic import ValidationError

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.core.logging import logger
from app.integrations.llm_client import LLMClient, default_llm_client
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.schemas.agent import AgentConfiguration
from app.schemas.refinement import RefineAgentRequest, RefineAgentResponse

REFINEMENT_SYSTEM_PROMPT = """You are an expert Voice AI Architect for VAANI.
Your task is to refine an EXISTING voice agent configuration based on the user's natural language instructions.

STRICT RULES:
1. Output MUST be a complete, valid JSON object matching the AgentConfiguration schema.
2. Preserve all existing valid fields, steps, and guardrails UNLESS the user explicitly asks to modify, add, or remove them.
3. Keep instructions spoken, concise, and natural for a voice agent.
4. Do not invent fake phone numbers, credit card data, or unconfigured APIs.
5. Apply the requested changes faithfully (e.g. tone adjustments, shorter greetings, language switching, added steps).
6. Return JSON only without markdown formatting.
"""


def _compute_config_diff(old_dict: Dict[str, Any], new_dict: Dict[str, Any]) -> Dict[str, Any]:
    diff: Dict[str, Any] = {}
    all_keys = set(old_dict.keys()).union(new_dict.keys())
    for key in all_keys:
        old_val = old_dict.get(key)
        new_val = new_dict.get(key)
        if old_val != new_val:
            diff[key] = {"old": old_val, "new": new_val}
    return diff


class RefinementService:
    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        agent_repo: Optional[AgentRepository] = None,
    ):
        self.llm_client = llm_client or default_llm_client
        self.agent_repo = agent_repo or default_agent_repository

    async def refine_agent(
        self, agent_id: str, owner_id: str, request: RefineAgentRequest
    ) -> RefineAgentResponse:
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        current_version = agent.get("current_version", 1)

        # Check version conflict if client provided a version expectation
        if (
            request.configuration_version is not None
            and request.configuration_version != current_version
        ):
            raise ConflictException(
                f"Version conflict: agent is at version {current_version}, but requested edit was based on version {request.configuration_version}.",
                code="VERSION_CONFLICT",
                details={
                    "current_version": current_version,
                    "expected_version": request.configuration_version,
                },
            )

        current_config = agent["configuration"]

        user_prompt = (
            "CURRENT AGENT CONFIGURATION:\n"
            f"{json.dumps(current_config, indent=2)}\n\n"
            "USER REFINEMENT INSTRUCTION:\n"
            f"{request.instruction}\n\n"
            "Please provide the complete updated JSON configuration reflecting these requested edits."
        )

        raw_json = await self.llm_client.generate_structured_json(
            system_prompt=REFINEMENT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        try:
            refined_config = AgentConfiguration.model_validate(raw_json)
        except ValidationError as err:
            logger.error("Refined configuration failed schema validation: %s", str(err))
            raise ValidationException(
                "Refinement produced an invalid configuration. Please rephrase your instruction.",
                code="INVALID_REFINED_SCHEMA",
                details=err.errors(),
            )

        new_config_dict = refined_config.model_dump()
        diff = _compute_config_diff(current_config, new_config_dict)

        # Save updated configuration as a new version
        change_desc = f"Prompt refinement: {request.instruction[:100]}"
        updated = await self.agent_repo.update_agent(
            agent_id=agent_id,
            owner_id=owner_id,
            update_fields={"configuration": new_config_dict, "name": refined_config.name},
            new_version_config=new_config_dict,
            change_description=change_desc,
        )

        new_version_num = updated.get("current_version", current_version + 1)
        summary = f"Agent '{refined_config.name}' refined to version {new_version_num}. Changed fields: {', '.join(diff.keys()) if diff else 'no visible changes'}."

        return RefineAgentResponse(
            agent_id=agent_id,
            previous_version=current_version,
            current_version=new_version_num,
            configuration=refined_config,
            change_summary=summary,
            diff=diff,
        )


default_refinement_service = RefinementService()
