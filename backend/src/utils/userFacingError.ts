/**
 * Plain-language messages for failures the user can't act on technically
 * (AI provider outages, quota limits, network blips). The raw error is always logged by the caller;
 * only these strings go to the app.
 */

export const GENERIC_ERROR_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';
export const AI_BUSY_MESSAGE =
  'Our AI assistant is very busy right now. Please try again in a few minutes.';
export const AI_UNREACHABLE_MESSAGE =
  "We couldn't reach our AI assistant. Please check your connection and try again.";
export const AI_RECONNECTING_MESSAGE = 'Connection is a little unstable. Reconnecting…';
export const AI_FAILED_MESSAGE = "The AI assistant couldn't answer that. Please try again.";

export function isAiQuotaError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted')
  );
}

export function isNetworkError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('epipe') ||
    message.includes('socket disconnected') ||
    message.includes('socket hang up') ||
    message.includes('tls') ||
    message.includes('network')
  );
}

/** True when the error comes from the AI provider (Gemini) rather than our own code */
export function isAiProviderError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    message.includes('googlegenerativeai') ||
    message.includes('generativelanguage.googleapis') ||
    message.includes('gemini') ||
    message.includes('generatecontent')
  );
}

/**
 * Message for an error during a live AI call. `transient` tells the app the call is still usable
 * (show a passing notice) rather than broken (end the call). Returns null when there is nothing worth telling the user.
 */
export function toLiveCallError(err: unknown): { message: string; transient: boolean } | null {
  if (isAiQuotaError(err)) return { message: AI_BUSY_MESSAGE, transient: true };
  const raw = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  // Internal mode switches (live voice -> standard requests) don't affect the user: show nothing.
  if (raw.includes('using fallback') || raw.includes('switching to text fallback')) return null;
  if (raw.includes('reconnect') || raw.includes('disconnected') || isNetworkError(err)) {
    return { message: AI_RECONNECTING_MESSAGE, transient: true };
  }
  if (raw.includes('gemini_api_key') || raw.includes('not configured')) {
    return { message: 'The AI assistant is not available right now. Please try again later.', transient: false };
  }
  return { message: AI_FAILED_MESSAGE, transient: true };
}
