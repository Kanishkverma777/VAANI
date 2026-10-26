import { apiClient, getStoredToken } from './api-client';

export interface KnowledgeSource {
  id: string;
  agent_id: string;
  filename: string;
  chunk_count: number;
  status: 'indexed' | 'failed' | 'processing';
  created_at: string;
}

export interface KnowledgeQueryResult {
  text: string;
  score: number;
  source_id?: string;
  metadata?: Record<string, unknown>;
}

export async function uploadKnowledgeDocument(
  agentId: string,
  file: File
): Promise<KnowledgeSource> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getStoredToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/agents/${agentId}/knowledge`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }
  );

  if (!res.ok) {
    let err = 'Upload failed';
    try {
      const d = await res.json();
      err = d?.error?.message || d?.detail || err;
    } catch {}
    throw new Error(err);
  }

  return res.json();
}

export async function listKnowledgeDocuments(agentId: string): Promise<KnowledgeSource[]> {
  return apiClient<KnowledgeSource[]>(`/api/v1/agents/${agentId}/knowledge`);
}

export async function deleteKnowledgeDocument(
  agentId: string,
  sourceId: string
): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(
    `/api/v1/agents/${agentId}/knowledge/${sourceId}`,
    {
      method: 'DELETE',
    }
  );
}

export async function queryAgentKnowledge(
  agentId: string,
  query: string,
  topK: number = 1,
  confidenceThreshold: number = 0.25
): Promise<{ results: KnowledgeQueryResult[]; total_matches: number; answer?: string }> {
  return apiClient<{ results: KnowledgeQueryResult[]; total_matches: number; answer?: string }>(
    `/api/v1/agents/${agentId}/knowledge/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        query,
        top_k: topK,
        confidence_threshold: confidenceThreshold,
      }),
    }
  );
}
