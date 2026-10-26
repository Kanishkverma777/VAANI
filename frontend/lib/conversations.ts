import { apiClient } from './api-client';
import { ConversationSession } from '@/types/session';

export interface PaginatedSessions {
  items: ConversationSession[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchAgentSessions(
  agentId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ConversationSession[]> {
  const data = await apiClient<PaginatedSessions | ConversationSession[]>(
    `/api/v1/agents/${agentId}/sessions?page=${page}&page_size=${pageSize}`
  );
  if (Array.isArray(data)) return data;
  return data.items || [];
}

export async function syncAgentSession(
  agentId: string,
  providerConversationId: string
): Promise<ConversationSession> {
  return apiClient<ConversationSession>(`/api/v1/agents/${agentId}/sessions/sync`, {
    method: 'POST',
    body: JSON.stringify({
      provider_conversation_id: providerConversationId,
    }),
  });
}

export async function fetchUserSessions(
  page: number = 1,
  pageSize: number = 20,
  autoSync: boolean = false
): Promise<ConversationSession[]> {
  try {
    const data = await apiClient<PaginatedSessions | any>(
      `/api/v1/sessions?page=${page}&page_size=${pageSize}${autoSync ? '&auto_sync=true' : ''}`
    );
    const items = Array.isArray(data) ? data : (data?.items || []);
    return items.map(normalizeSession);
  } catch (err) {
    console.warn('fetchUserSessions request failed:', err);
    return [];
  }
}

export async function syncAllSessions(): Promise<{ status: string; synced_count: number }> {
  try {
    return await apiClient<{ status: string; synced_count: number }>('/api/v1/sessions/sync-all', {
      method: 'POST',
    });
  } catch (err) {
    console.warn('syncAllSessions notice:', err);
    return { status: 'failed', synced_count: 0 };
  }
}

export async function fetchSessionDetails(sessionId: string): Promise<ConversationSession> {
  const data = await apiClient<any>(`/api/v1/sessions/${sessionId}`);
  return normalizeSession(data);
}

function normalizeSession(s: any): ConversationSession {
  return {
    session_id: s.id || s.session_id,
    agent_id: s.agent_id,
    agent_name: s.agent_name || 'Voice Agent',
    start_time: s.started_at || s.start_time || new Date().toISOString(),
    end_time: s.ended_at || s.end_time,
    duration_seconds: s.duration_seconds || 0,
    status: s.status || 'completed',
    outcome: s.outcome || 'resolved',
    messages_count: Array.isArray(s.transcript) ? s.transcript.length : 0,
    average_latency_ms: s.latency_metrics?.average_turn_latency_ms || s.average_latency_ms || 0,
    summary: s.summary || '',
    transcript: s.transcript || [],
    flagged_issues: s.flagged ? ['Flagged for review'] : [],
    sentiment: s.sentiment || 'positive',
  };
}
