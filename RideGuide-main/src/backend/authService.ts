import { api, setAuthToken, extractApiError } from './apiClient';
import { AuthUser } from './types';

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export async function registerWithApi(input: {
  email: string;
  password: string;
  displayName: string;
  role?: 'owner' | 'mechanic' | 'tow';
}): Promise<AuthUser> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/register', input);
    await setAuthToken(data.token);
    return data.user;
  } catch (e) {
    throw new Error(extractApiError(e, 'Registration failed'));
  }
}

export async function loginWithApi(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/login', input);
    await setAuthToken(data.token);
    return data.user;
  } catch (e) {
    throw new Error(extractApiError(e, 'Login failed'));
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<AuthUser>('/auth/me');
    return data;
  } catch {
    return null;
  }
}

export async function logoutWithApi(): Promise<void> {
  await setAuthToken(null);
}
