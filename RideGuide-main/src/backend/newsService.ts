import { api } from './apiClient';

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  link: string;
  imageUrl: string | null;
  source: string;
  /** 'local' = Sri Lankan road/traffic/fuel news; 'world' = international motoring news */
  region: 'local' | 'world';
  publishedAt: string;
};

export async function getVehicleNews(): Promise<NewsItem[]> {
  const { data } = await api.get<{ items: NewsItem[] }>('/news');
  return Array.isArray(data?.items) ? data.items : [];
}
