from typing import List, Optional

from app.config import settings
from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import logger
from app.knowledge.chunker import chunk_text
from app.knowledge.document_parser import (
    detect_and_validate_file_type,
    extract_text_from_document,
)
from app.knowledge.retriever import QdrantRetriever, default_qdrant_retriever
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.integrations.llm_client import LLMClient, default_llm_client
from app.repositories.knowledge_repository import (
    KnowledgeRepository,
    default_knowledge_repository,
)
from app.schemas.knowledge import (
    KnowledgeChunkResult,
    KnowledgeQueryResponse,
    KnowledgeSourceResponse,
)


class KnowledgeService:
    def __init__(
        self,
        retriever: Optional[QdrantRetriever] = None,
        agent_repo: Optional[AgentRepository] = None,
        knowledge_repo: Optional[KnowledgeRepository] = None,
        llm_client: Optional[LLMClient] = None,
    ):
        self.retriever = retriever or default_qdrant_retriever
        self.agent_repo = agent_repo or default_agent_repository
        self.knowledge_repo = knowledge_repo or default_knowledge_repository
        self.llm_client = llm_client or default_llm_client

    async def ingest_document(
        self,
        agent_id: str,
        owner_id: str,
        filename: str,
        content: bytes,
    ) -> KnowledgeSourceResponse:
        """Process an uploaded document through validation, extraction, chunking, and embedding."""
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise ValidationException(
                f"File size exceeds maximum allowed limit of {settings.max_upload_size_mb}MB.",
                code="FILE_TOO_LARGE",
            )

        # Validate file type using magic bytes
        file_type = detect_and_validate_file_type(content, filename)

        # Extract text
        extracted_text = extract_text_from_document(content, file_type)

        # Chunk text
        chunks = chunk_text(extracted_text, chunk_size=500, chunk_overlap=50)

        # Create record in DB
        source_dict = {
            "agent_id": agent_id,
            "owner_id": owner_id,
            "filename": filename,
            "content_type": file_type,
            "storage_reference": f"internal://knowledge/{agent_id}/{filename}",
            "processing_status": "processing",
            "chunk_count": len(chunks),
            "error_message": None,
        }
        created = await self.knowledge_repo.create_source(source_dict)
        source_id = created["id"]

        try:
            # Store in vector index
            upserted_count = await self.retriever.upsert_chunks(
                owner_id=owner_id,
                agent_id=agent_id,
                source_id=source_id,
                filename=filename,
                chunks=chunks,
            )
            await self.knowledge_repo.update_status(
                source_id=source_id,
                owner_id=owner_id,
                status="completed",
                chunk_count=upserted_count,
            )
            created["processing_status"] = "completed"
            created["chunk_count"] = upserted_count
            logger.info(
                "Successfully ingested document '%s' with %d chunks.", filename, upserted_count
            )
            return self._to_response(created)

        except Exception as exc:
            logger.exception(
                "Failed to index vector embeddings for document %s: %s", filename, str(exc)
            )
            await self.knowledge_repo.update_status(
                source_id=source_id,
                owner_id=owner_id,
                status="failed",
                error_message=str(exc),
            )
            created["processing_status"] = "failed"
            created["error_message"] = str(exc)
            return self._to_response(created)

    async def list_sources(self, agent_id: str, owner_id: str) -> List[KnowledgeSourceResponse]:
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        target_owner_id = agent.get("owner_id", owner_id)
        docs = await self.knowledge_repo.list_by_agent(agent_id, target_owner_id)
        return [self._to_response(d) for d in docs]

    async def delete_source(self, source_id: str, agent_id: str, owner_id: str) -> bool:
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        target_owner_id = agent.get("owner_id", owner_id)
        source = await self.knowledge_repo.get_by_id(source_id, target_owner_id)
        if not source:
            raise NotFoundException(
                f"Knowledge source '{source_id}' was not found.", code="SOURCE_NOT_FOUND"
            )

        # Delete vectors in Qdrant
        await self.retriever.delete_source_vectors(
            source_id=source_id, owner_id=target_owner_id, agent_id=agent_id
        )
        # Delete DB metadata
        return await self.knowledge_repo.delete_source(source_id, target_owner_id)

    async def query_knowledge(
        self, agent_id: str, owner_id: str, query: str, top_k: int = 1, threshold: float = 0.25
    ) -> KnowledgeQueryResponse:
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        target_owner_id = agent.get("owner_id", owner_id)
        raw_results = await self.retriever.query_knowledge(
            owner_id=target_owner_id,
            agent_id=agent_id,
            query=query,
            top_k=top_k,
            threshold=threshold,
        )

        results = [
            KnowledgeChunkResult(
                chunk_id=r["chunk_id"],
                score=r["score"],
                text=r["text"],
                filename=r["filename"],
                source_id=r["source_id"],
            )
            for r in raw_results
        ]

        concise_answer: Optional[str] = None
        if results:
            context_text = "\n---\n".join([f"[{r.filename}]: {r.text}" for r in results])
            system_prompt = (
                f"You are the AI Knowledge Engine for Voice AI Agent '{agent.get('name', 'Assistant')}'.\n"
                "Your objective is to provide an ultra-concise, direct, spoken-style answer to the user's question using ONLY the provided documentation.\n\n"
                "RULES:\n"
                "1. Answer in 1 to 2 spoken sentences maximum.\n"
                "2. Be concise, direct, polite, and natural.\n"
                "3. Do NOT use markdown, bullet points, asterisks, citations like '[document.txt]', or preamble like 'Based on the provided text'.\n"
                "4. If the documentation does not contain enough information to answer the question, state: 'I don\\'t have specific information regarding that in my knowledge documentation.'"
            )
            user_prompt = f"DOCUMENTATION CONTEXT:\n{context_text}\n\nUSER QUESTION:\n{query}"
            concise_answer = await self.llm_client.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=150,
            )
        elif raw_results:
            concise_answer = "I found related information, but it did not meet the confidence threshold."
        else:
            concise_answer = "No matching documentation was found for this inquiry."

        return KnowledgeQueryResponse(
            agent_id=agent_id,
            query=query,
            answer=concise_answer,
            results=results,
            total_matches=len(results),
        )

    def _to_response(self, doc: dict) -> KnowledgeSourceResponse:
        return KnowledgeSourceResponse(
            id=str(doc.get("id") or doc.get("_id")),
            agent_id=doc["agent_id"],
            owner_id=doc["owner_id"],
            filename=doc["filename"],
            content_type=doc["content_type"],
            storage_reference=doc.get("storage_reference", ""),
            processing_status=doc.get("processing_status", "pending"),
            chunk_count=doc.get("chunk_count", 0),
            error_message=doc.get("error_message"),
            created_at=doc.get("created_at", ""),
            updated_at=doc.get("updated_at", ""),
        )


default_knowledge_service = KnowledgeService()
