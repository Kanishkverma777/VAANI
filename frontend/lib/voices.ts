import { apiClient } from './api-client';
import { VoiceSample } from '@/types/voice';

export async function fetchVoices(): Promise<VoiceSample[]> {
  const data = await apiClient<{ voices: VoiceSample[] } | VoiceSample[]>('/api/v1/voices');
  return Array.isArray(data) ? data : (data.voices || []);
}

export async function cloneVoice(formData: FormData): Promise<VoiceSample> {
  return await apiClient<VoiceSample>('/api/v1/voices/clone', {
    method: 'POST',
    body: formData,
  });
}

