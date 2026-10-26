from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.dependencies import get_current_user
from app.schemas.common import SuccessResponse
from app.schemas.knowledge import (
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    KnowledgeSourceResponse,
)
from app.services.knowledge_service import KnowledgeService, default_knowledge_service

router = APIRouter(prefix="/agents", tags=["Knowledge & RAG"])


def get_knowledge_service() -> KnowledgeService:
    return default_knowledge_service


@router.post(
    "/{agent_id}/knowledge",
    response_model=KnowledgeSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a document into the agent's vector knowledge base",
)
async def upload_knowledge_document(
    agent_id: str,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: KnowledgeService = Depends(get_knowledge_service),
) -> KnowledgeSourceResponse:
    """Parse, chunk, embed, and index an uploaded document (PDF, DOCX, TXT) into Qdrant."""
    content = await file.read()
    filename = file.filename or "uploaded_document.txt"
    return await service.ingest_document(
        agent_id=agent_id,
        owner_id=current_user["id"],
        filename=filename,
        content=content,
    )


@router.get(
    "/{agent_id}/knowledge",
    response_model=List[KnowledgeSourceResponse],
    status_code=status.HTTP_200_OK,
    summary="List all indexed knowledge documents for an agent",
)
async def list_knowledge_documents(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: KnowledgeService = Depends(get_knowledge_service),
) -> List[KnowledgeSourceResponse]:
    """Retrieve metadata and indexing statuses for all documents uploaded to this agent."""
    return await service.list_sources(agent_id=agent_id, owner_id=current_user["id"])


@router.delete(
    "/{agent_id}/knowledge/{source_id}",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a knowledge document and its associated vectors",
)
async def delete_knowledge_document(
    agent_id: str,
    source_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: KnowledgeService = Depends(get_knowledge_service),
) -> SuccessResponse:
    """Delete a document and purge all its vectors from the Qdrant index."""
    await service.delete_source(source_id=source_id, agent_id=agent_id, owner_id=current_user["id"])
    return SuccessResponse(
        success=True, message=f"Knowledge source '{source_id}' deleted successfully."
    )


@router.post(
    "/{agent_id}/knowledge/query",
    response_model=KnowledgeQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Perform semantic vector search against agent knowledge base",
)
async def query_agent_knowledge(
    agent_id: str,
    request: KnowledgeQueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: KnowledgeService = Depends(get_knowledge_service),
) -> KnowledgeQueryResponse:
    """Search for relevant document passages using dense vector embeddings."""
    return await service.query_knowledge(
        agent_id=agent_id,
        owner_id=current_user["id"],
        query=request.query,
        top_k=request.top_k,
        threshold=request.confidence_threshold,
    )
