export interface VoiceSample {
  voice_id: string;
  name: string;
  category: string;
  accent?: string;
  gender?: string;
  preview_url?: string;
  description?: string;
  recommended_for?: string[];
  supported_languages?: string[];
}

export interface VoiceListResponse {
  voices: VoiceSample[];
  total: number;
}
