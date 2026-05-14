import { api } from './apiClient';

export interface AssistantMsg {
  role: 'user' | 'model';
  content: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export async function askAssistant(
  messages: AssistantMsg[],
  opts?: { sessionId?: string; vehicleId?: string }
): Promise<{ reply: string; sessionId?: string }> {
  const { data } = await api.post<{ reply: string; sessionId?: string }>('/chat/assistant', {
    messages,
    sessionId: opts?.sessionId,
    vehicleId: opts?.vehicleId,
  });
  return { reply: data.reply, sessionId: data.sessionId };
}
