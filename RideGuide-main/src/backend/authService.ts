import { api, setAuthToken, extractApiError } from './apiClient';
import { AuthUser } from './types';

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export type RegisterProviderPayload = {
  businessName: string;
  businessAddress?: string;
  truckName?: string;
  plateNumber?: string;
  /** Field name → local file URI (e.g. from ImagePicker) */
  files: Record<string, string>;
};

export type RegisterWithApiInput = {
  email: string;
  password?: string;
  displayName: string;
  role?: 'owner' | 'mechanic' | 'tow';
  phoneNumber?: string;
  /** Required when role is mechanic or tow */
  provider?: RegisterProviderPayload;
};

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png') || lower.includes('.png')) return 'image/png';
  if (lower.endsWith('.webp') || lower.includes('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf') || lower.includes('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

function appendFileField(form: FormData, field: string, uri: string) {
  const name = uri.split('/').pop()?.split('?')[0] || `${field}.jpg`;
  const type = guessMime(uri);
  form.append(field, { uri, name, type } as unknown as Blob);
}

export async function registerWithApi(
  input: RegisterWithApiInput
): Promise<{ user: AuthUser; pendingVerification: boolean }> {
  const role = input.role ?? 'owner';
  if (role === 'mechanic' || role === 'tow') {
    if (!input.provider) {
      throw new Error('Verification documents are required for mechanic and tow registration.');
    }
    try {
      const form = new FormData();
      form.append('email', input.email);
      form.append('displayName', input.displayName);
      form.append('role', role);
      form.append('businessName', input.provider.businessName);
      if (input.phoneNumber?.trim()) {
        form.append('phoneNumber', input.phoneNumber.trim());
      }
      if (role === 'mechanic') {
        if (input.provider.businessAddress?.trim()) {
          form.append('businessAddress', input.provider.businessAddress.trim());
        }
      } else {
        if (input.provider.truckName?.trim()) {
          form.append('truckName', input.provider.truckName.trim());
        }
        if (input.provider.plateNumber?.trim()) {
          form.append('plateNumber', input.provider.plateNumber.trim());
        }
      }
      for (const [field, uri] of Object.entries(input.provider.files)) {
        if (uri) appendFileField(form, field, uri);
      }
      const { data } = await api.post<{ user: AuthUser; pendingVerification: boolean }>(
        '/auth/register-provider',
        form,
        { timeout: 120_000 }
      );
      return { user: data.user, pendingVerification: true };
    } catch (e) {
      throw new Error(extractApiError(e, 'Registration failed'));
    }
  }

  if (!input.password) {
    throw new Error('Password is required for vehicle owner registration.');
  }

  try {
    const { data } = await api.post<AuthResponse>('/auth/register', {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      role: 'owner',
      ...(input.phoneNumber?.trim() ? { phoneNumber: input.phoneNumber.trim() } : {}),
    });
    await setAuthToken(data.token);
    return { user: data.user, pendingVerification: false };
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

export async function changePasswordWithApi(password: string): Promise<void> {
  try {
    await api.post('/auth/change-password', { password });
  } catch (e) {
    throw new Error(extractApiError(e, 'Could not change password'));
  }
}
