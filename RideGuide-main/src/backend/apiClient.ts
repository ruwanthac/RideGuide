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

  if (Platform.OS === 'web') {
    try {
      const parsed = new URL(envBaseURL);
      const loopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (typeof window !== 'undefined' && loopback) {
        const { hostname } = window.location;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
          parsed.hostname = hostname;
          return parsed.toString().replace(/\/$/, '');
        }
      }
      return envBaseURL.replace(/\/$/, '');
    } catch {
      return envBaseURL.replace(/\/$/, '');
    }
  }

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
    return envBaseURL.replace(/\/$/, '');
  } catch {
    return envBaseURL.replace(/\/$/, '');
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

type ApiErrorBody = {
  error?: string;
  details?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] };
};

function messageFromValidationDetails(details: ApiErrorBody['details']): string | null {
  if (!details) return null;
  const parts: string[] = [...(details.formErrors ?? [])];
  for (const [field, msgs] of Object.entries(details.fieldErrors ?? {})) {
    if (Array.isArray(msgs) && msgs.length) parts.push(`${field}: ${msgs.join(', ')}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export function extractApiError(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiErrorBody | undefined;
    if (data?.error === 'validation failed' || !data?.error) {
      const fromDetails = data?.details ? messageFromValidationDetails(data.details) : null;
      if (fromDetails) return fromDetails;
    }
    return data?.error ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
