import { api } from './apiClient';

export interface AiCallHistoryListItem {
  _id: string;
  summary: string;
  vehicleId: string | null;
  sessionId: string;
  createdAt: string;
  endedAt?: string | null;
}

export interface AiCallHistoryDetail extends AiCallHistoryListItem {
  messages: { role: 'user' | 'model'; content: string }[];
  continuedFrom?: string | null;
}

export async function listAiCallHistory(vehicleId?: string): Promise<AiCallHistoryListItem[]> {
  const { data } = await api.get<AiCallHistoryListItem[]>('/chat/ai-call-history', {
    params: vehicleId ? { vehicleId } : undefined,
  });
  return data;
}

export async function getAiCallHistory(id: string): Promise<AiCallHistoryDetail> {
  const { data } = await api.get<AiCallHistoryDetail>(`/chat/ai-call-history/${id}`);
  return data;
}
