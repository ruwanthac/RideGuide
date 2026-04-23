import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const TOKEN_KEY = 'rideguide.token';

function inferDevHost(): string | null {
  const hostFromExpoConfig = Constants.expoConfig?.hostUri?.split(':')[0];
  if (hostFromExpoConfig) return hostFromExpoConfig;

  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) return null;
  try {
    return new URL(scriptURL).hostname;
  } catch {
    return null;
  }
}

function resolveBaseURL(): string {
  const envBaseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  if (Platform.OS === 'web') return envBaseURL;

  try {
    const parsed = new URL(envBaseURL);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const devHost = inferDevHost();
      if (devHost) {
        parsed.hostname = devHost;
        return parsed.toString().replace(/\/$/, '');
      }
    }
    return envBaseURL;
  } catch {
    return envBaseURL;
  }
}

const baseURL = resolveBaseURL();

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
