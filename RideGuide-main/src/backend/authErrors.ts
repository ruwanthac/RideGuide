import { friendlyErrorMessage } from './apiClient';

export function formatAuthError(err: unknown, fallback = "We couldn't sign you in. Please try again."): string {
  return friendlyErrorMessage(err, fallback);
}
