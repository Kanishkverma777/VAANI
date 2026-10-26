import { apiClient } from './api-client';
import { AnalyticsSummary } from '@/types/session';

export interface AgentAnalytics {
  agent_id: string;
  total_sessions: number;
  completed_sessions: number;
  total_duration_seconds: number;
  average_duration_seconds: number;
  outcomes_breakdown: Record<string, number>;
  average_latency_ms?: number;
  flagged_sessions_count: number;
  calculated_at: string;
}

export async function fetchAgentAnalytics(agentId: string): Promise<AgentAnalytics> {
  return apiClient<AgentAnalytics>(`/api/v1/agents/${agentId}/analytics`);
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsSummary> {
  try {
    return await apiClient<AnalyticsSummary>('/api/v1/analytics/overview');
  } catch (err) {
    console.warn('Failed to load server analytics overview, using fallback:', err);
    return {
      total_conversations: 0,
      average_duration_seconds: 0,
      completion_rate_percent: 0,
      resolution_rate_percent: 0,
      average_latency_ms: 0,
      active_agents_count: 0,
      total_agents_count: 0,
    };
  }
}
