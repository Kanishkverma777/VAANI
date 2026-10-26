export type UseCase =
  | 'appointments'
  | 'customer_support'
  | 'lead_generation'
  | 'education'
  | 'restaurant'
  | 'recruitment'
  | 'collections'
  | 'negotiation'
  | 'custom';

export type AgentStatus =
  | 'draft'
  | 'configured'
  | 'provisioning'
  | 'active'
  | 'deployment_failed'
  | 'archived';

export interface Personality {
  tone?: string;
  speaking_style?: string;
  pace?: string;
  traits?: string[];
}

export interface ConversationFlowStep {
  step_id: string;
  title: string;
  goal: string;
  example_phrases?: string[];
  fallback?: string;
}

export interface ConversationFlow {
  steps: ConversationFlowStep[];
  fallback_policy?: string;
}

export interface Guardrails {
  prohibited_topics?: string[];
  max_turn_count?: number;
  fallback_message?: string;
  data_privacy_rules?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  enabled?: boolean;
}

export interface KnowledgeSettings {
  rag_enabled?: boolean;
  top_k?: number;
  confidence_threshold?: number;
  source_identifiers?: string[];
}

export interface EscalationSettings {
  human_handoff_enabled?: boolean;
  escalation_contact?: string;
  trigger_phrases?: string[];
  escalation_message?: string;
}

export interface AgentConfiguration {
  name: string;
  description: string;
  purpose: string;
  use_case: UseCase;
  personality: Personality;
  instructions: string;
  welcome_message: string;
  language: string;
  additional_languages: string[];
  voice_id: string;
  conversation_flow: ConversationFlow;
  guardrails: Guardrails;
  tools: ToolDefinition[];
  knowledge_settings: KnowledgeSettings;
  escalation_settings: EscalationSettings;
}

export interface AgentRecord {
  id: string;
  owner_id?: string;
  name: string;
  description: string;
  use_case?: UseCase;
  status: AgentStatus;
  version: number;
  configuration: AgentConfiguration;
  // convenience alias for components expecting .config:
  config?: AgentConfiguration;
  elevenlabs_agent_id?: string | null;
  provider_agent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateAgentResponse {
  configuration: AgentConfiguration;
  generation_summary: string;
  warnings: string[];
}

export interface RefineAgentResponse {
  agent_id: string;
  previous_version: number;
  current_version: number;
  configuration: AgentConfiguration;
  change_summary: string;
  diff: Record<string, unknown>;
}

export interface AgentVersionRecord {
  version: number;
  configuration: AgentConfiguration;
  change_description: string;
  created_at: string;
  created_by?: string;
}

export interface ConversationAccessResponse {
  agent_id: string;
  signed_url: string;
  expires_at: string;
}
