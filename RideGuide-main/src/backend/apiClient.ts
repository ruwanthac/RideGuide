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
};

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
const OFFLINE_ERROR = "Can't connect right now. Please check your internet connection and try again.";
const TIMEOUT_ERROR = 'This is taking longer than usual. Please check your connection and try again.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again in a moment.';

/**
 * True for messages meant for developers (stack-ish text, URLs, error codes, JS runtime errors),
 * which should never be shown to people using the app.
 */
function looksTechnical(message: string): boolean {
  const m = message.trim();
  if (!m || m.length > 220) return true;
  // Our own user-facing messages start with a capital letter; old/raw ones are lower-case codes.
  if (/^[a-z]/.test(m)) return true;
  // Node-style error codes (ECONNRESET, ETIMEDOUT) must be upper-case, or "email" would match.
  if (/\bE[A-Z]{3,}\b/.test(m)) return true;
  return /https?:\/\/|\[[^\]]*error\]|\b\w*Error\b|\bexception\b|status code|fetch failed|network request failed|undefined|null is not|cannot read prop|is not a function|unexpected token|\bjson\b|timeout of \d+ms|socket|websocket|\bstack\b|gemini|api key|quota/i.test(
    m
  );
}

/**
 * Turns any error into a short, plain sentence that is safe to show to the user.
 * Network problems, timeouts and server crashes get standard wording; technical text falls back to `fallback`.
 */
export function friendlyErrorMessage(err: unknown, fallback = GENERIC_ERROR): string {
  const safeFallback = looksTechnical(fallback) ? GENERIC_ERROR : fallback;
  if (err instanceof AxiosError) {
    if (!err.response) {
      if (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ETIMEDOUT) return TIMEOUT_ERROR;
      return OFFLINE_ERROR;
    }
    const status = err.response.status;
    const serverMessage = (err.response.data as ApiErrorBody | undefined)?.error;
    if (typeof serverMessage === 'string' && !looksTechnical(serverMessage)) return serverMessage;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "We couldn't find what you were looking for.";
    if (status === 413) return 'That file is too large. Please choose a smaller one.';
    if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (status >= 500) return SERVER_ERROR;
    return safeFallback;
  }
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/network request failed|failed to fetch|network error/i.test(message)) return OFFLINE_ERROR;
  if (message && !looksTechnical(message)) return message;
  return safeFallback;
}

/** Kept for existing callers; same as friendlyErrorMessage. */
export function extractApiError(err: unknown, fallback = GENERIC_ERROR): string {
  return friendlyErrorMessage(err, fallback);
}
