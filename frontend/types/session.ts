export interface TranscriptMessage {
  role: 'user' | 'agent' | 'system';
  message: string;
  time_in_call_secs?: number;
  timestamp?: string;
  latency_ms?: number;
}

export interface ConversationSession {
  session_id: string;
  agent_id: string;
  agent_name?: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  status: 'active' | 'completed' | 'failed';
  outcome: 'resolved' | 'escalated' | 'abandoned' | 'unknown';
  messages_count: number;
  average_latency_ms?: number;
  summary?: string;
  transcript: TranscriptMessage[];
  flagged_issues?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface AnalyticsSummary {
  total_conversations: number;
  average_duration_seconds: number;
  total_duration_seconds?: number;
  completion_rate_percent: number;
  resolution_rate_percent: number;
  average_latency_ms: number;
  active_agents_count: number;
  total_agents_count: number;
}
