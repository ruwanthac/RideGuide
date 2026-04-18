export function formatAuthError(err: unknown, fallback = 'Authentication failed'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
