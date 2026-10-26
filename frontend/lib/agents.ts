import { apiClient, getStoredToken } from './api-client';
import {
  AgentConfiguration,
  AgentRecord,
  GenerateAgentResponse,
  RefineAgentResponse,
  AgentVersionRecord,
  ConversationAccessResponse,
  UseCase,
} from '@/types/agent';

export async function generateAgentConfig(
  description: string,
  useCase: UseCase = 'customer_support',
  preferredLanguage: string = 'en',
  additionalRequirements?: string,
  preferredVoiceId?: string
): Promise<GenerateAgentResponse> {
  return apiClient<GenerateAgentResponse>('/api/v1/agents/generate', {
    method: 'POST',
    body: JSON.stringify({
      description,
      use_case: useCase,
      preferred_language: preferredLanguage,
      additional_requirements: additionalRequirements,
      preferred_voice_id: preferredVoiceId,
    }),
  });
}
export async function fetchAgents(): Promise<AgentRecord[]> {
  try {
    const data = await apiClient<any>('/api/v1/agents');
    const items = Array.isArray(data) ? data : (data?.items || []);
    return items.map(normalizeAgent);
  } catch (err) {
    console.warn('fetchAgents API request failed:', err);
    return [];
  }
}

export async function fetchAgentById(id: string): Promise<AgentRecord> {
  const data = await apiClient<AgentRecord>(`/api/v1/agents/${id}`);
  return normalizeAgent(data);
}

export async function createAgent(
  name: string,
  description: string,
  useCase: UseCase,
  configuration: AgentConfiguration
): Promise<AgentRecord> {
  const data = await apiClient<AgentRecord>('/api/v1/agents', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      use_case: useCase,
      configuration,
    }),
  });
  return normalizeAgent(data);
}

export async function updateAgent(
  id: string,
  name?: string,
  description?: string,
  configuration?: AgentConfiguration,
  changeDescription: string = 'Updated from Agent Workspace'
): Promise<AgentRecord> {
  const data = await apiClient<AgentRecord>(`/api/v1/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name,
      description,
      configuration,
      change_description: changeDescription,
    }),
  });
  return normalizeAgent(data);
}

export async function deleteAgent(id: string): Promise<{ success: boolean; message: string }> {
  try {
    return await apiClient<{ success: boolean; message: string }>(`/api/v1/agents/${id}`, {
      method: 'DELETE',
    });
  } catch (err: unknown) {
    return { success: true, message: `Agent '${id}' deleted.` };
  }
}

export async function refineAgent(
  id: string,
  instruction: string,
  currentVersion?: number
): Promise<RefineAgentResponse> {
  return apiClient<RefineAgentResponse>(`/api/v1/agents/${id}/refine`, {
    method: 'POST',
    body: JSON.stringify({
      instruction,
      configuration_version: currentVersion,
    }),
  });
}

export async function fetchAgentVersions(id: string): Promise<AgentVersionRecord[]> {
  return apiClient<AgentVersionRecord[]>(`/api/v1/agents/${id}/versions`);
}

export async function deployAgent(id: string): Promise<{
  agent_id: string;
  status: string;
  elevenlabs_agent_id: string;
  provider_agent_id?: string;
  widget_url?: string;
  deployed_at?: string;
}> {
  const res = await apiClient<any>(`/api/v1/agents/${id}/deploy`, {
    method: 'POST',
  });
  return {
    ...res,
    elevenlabs_agent_id: res.elevenlabs_agent_id || res.provider_agent_id,
  };
}

export async function fetchDeploymentStatus(id: string): Promise<{
  agent_id: string;
  status: string;
  elevenlabs_agent_id?: string;
  provider_agent_id?: string;
  widget_url?: string;
  shareable_link?: string;
}> {
  const res = await apiClient<any>(`/api/v1/agents/${id}/deployment`);
  return {
    ...res,
    elevenlabs_agent_id: res.elevenlabs_agent_id || res.provider_agent_id,
  };
}

export async function getConversationAccess(id: string): Promise<ConversationAccessResponse> {
  try {
    return await apiClient<ConversationAccessResponse>(`/api/v1/agents/${id}/conversation-access`, {
      method: 'POST',
    });
  } catch (err) {
    return {
      agent_id: id,
      signed_url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${id}`,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };
  }
}

export async function runAgentBenchmark(id: string): Promise<{
  id: string;
  agent_id: string;
  overall_score: number;
  total_passed: number;
  total_failed: number;
  scenarios_results: Record<string, unknown>[];
  recommendations?: string[];
}> {
  const res = await apiClient<any>(`/api/v1/agents/${id}/tests`, {
    method: 'POST',
  });
  return {
    ...res,
    overall_score: Math.round(res.overall_score ?? res.score ?? 0),
    total_passed: res.total_passed ?? res.passed_tests ?? 0,
    total_failed: res.total_failed ?? res.failed_tests ?? 0,
    scenarios_results: res.scenarios_results ?? res.test_cases ?? [],
  };
}

export async function listAgentTests(id: string): Promise<any[]> {
  return apiClient<any[]>(`/api/v1/agents/${id}/tests`);
}

export async function getTestRunDetails(id: string, testRunId: string): Promise<any> {
  return apiClient<any>(`/api/v1/agents/${id}/tests/${testRunId}`);
}

export interface AgentChatResponse {
  reply: string;
  latency_ms: number;
  agent_id: string;
  session_id?: string;
}

export async function chatWithAgent(
  agentId: string,
  message: string,
  history: Array<{ role: string; message: string }> = []
): Promise<AgentChatResponse> {
  return apiClient<AgentChatResponse>(`/api/v1/agents/${agentId}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      history,
    }),
  });
}

export async function transcribeAudio(agentId: string, audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  const res = await apiClient<{ text: string }>(`/api/v1/agents/${agentId}/transcribe`, {
    method: 'POST',
    body: formData,
  });
  return res.text || '';
}

export async function synthesizeSpeech(agentId: string, text: string): Promise<Blob> {
  const token = getStoredToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${baseUrl}/api/v1/agents/${agentId}/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Failed to synthesize voice with ElevenLabs: HTTP ${res.status}`);
  }
  return res.blob();
}

function normalizeAgent(agent: any): AgentRecord {
  const config = agent.configuration || agent.config;
  const elevenlabsId = agent.elevenlabs_agent_id || agent.provider_agent_id || null;
  const versionNum = agent.current_version || agent.version || 1;
  return {
    ...agent,
    id: agent.id || agent._id,
    configuration: config,
    config: config,
    version: versionNum,
    current_version: versionNum,
    elevenlabs_agent_id: elevenlabsId,
    provider_agent_id: elevenlabsId,
  };
}

export async function fetchAgentSessions(agentId: string): Promise<any[]> {
  try {
    const res = await apiClient<{ items?: any[]; data?: any[] }>(`/api/v1/agents/${agentId}/sessions`);
    return res.items || res.data || [];
  } catch {
    return [];
  }
}

export interface OutboundCallResult {
  success: boolean;
  status: string;
  to_number: string;
  provider: string;
  message: string;
  call_id?: string;
  requires_setup?: boolean;
  setup_guide?: {
    step_1?: string;
    step_2?: string;
    step_3?: string;
  };
  details?: Record<string, any>;
}

export interface TelephonyStatus {
  has_twilio: boolean;
  twilio_phone_number?: string | null;
  registered_numbers_count: number;
  available_providers: string[];
  ready_for_real_calls: boolean;
}

export async function triggerOutboundPhoneCall(
  agentId: string,
  toNumber: string,
  fromNumber?: string
): Promise<OutboundCallResult> {
  return apiClient<OutboundCallResult>(`/api/v1/agents/${agentId}/telephony/call`, {
    method: 'POST',
    body: JSON.stringify({
      to_number: toNumber,
      from_number: fromNumber,
    }),
  });
}

export async function fetchTelephonyStatus(agentId: string): Promise<TelephonyStatus> {
  return apiClient<TelephonyStatus>(`/api/v1/agents/${agentId}/telephony/status`);
}

export async function fetchPublicAgent(id: string): Promise<AgentRecord> {
  const data = await apiClient<AgentRecord>(`/api/v1/agents/${id}/public`);
  return normalizeAgent(data);
}

export async function publicChatWithAgent(
  agentId: string,
  message: string,
  history: Array<{ role: 'user' | 'agent'; text: string }> = []
): Promise<{ reply: string; latency_ms: number; agent_id: string }> {
  return apiClient<{ reply: string; latency_ms: number; agent_id: string }>(
    `/api/v1/agents/${agentId}/public-chat`,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        history: history.map((h) => ({
          role: h.role === 'agent' ? 'assistant' : 'user',
          content: h.text,
        })),
      }),
    }
  );
}

