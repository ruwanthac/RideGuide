import { api } from './apiClient';

export interface AssistantMsg { role: 'user' | 'model'; content: string }

export async function askAssistant(messages: AssistantMsg[]): Promise<string> {
  const { data } = await api.post<{ reply: string }>('/chat/assistant', { messages });
  return data.reply;
}
