import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'rideguide.token';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api: AxiosInstance = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function setAuthToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export function extractApiError(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
