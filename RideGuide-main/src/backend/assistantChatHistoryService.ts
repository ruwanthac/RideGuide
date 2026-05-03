import { api } from './apiClient';

export interface AssistantChatListItem {
  _id: string;
  previewTitle: string;
  vehicleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantChatDetail {
  _id: string;
  previewTitle: string;
  vehicleId: string | null;
  messages: { role: 'user' | 'model'; content: string }[];
  createdAt: string;
  updatedAt: string;
}

export async function listAssistantChatSessions(vehicleId?: string): Promise<AssistantChatListItem[]> {
  const { data } = await api.get<AssistantChatListItem[]>('/chat/assistant/sessions', {
    params: vehicleId ? { vehicleId } : undefined,
  });
  return data;
}

export async function getAssistantChatSession(id: string): Promise<AssistantChatDetail> {
  const { data } = await api.get<AssistantChatDetail>(`/chat/assistant/sessions/${id}`);
  return data;
}
