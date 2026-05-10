import { useEffect, useState } from 'react';
import { adminUrl, authHeaderBearerOnly } from '../lib/api';

type Props = {
  userId: string;
  field: string;
  label: string;
};

export function AuthenticatedVerificationPreview({ userId, field, label }: Props) {
  const url = adminUrl(`users/${userId}/verification-file/${field}`);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      setLoading(true);
      setErr(null);
      setBlobUrl(null);
      setMime(null);
      try {
        const res = await fetch(url, { headers: authHeaderBearerOnly() });
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'File not found' : `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setBlobUrl(objectUrl);
          setMime(blob.type || null);
        }
      } catch {
        if (!cancelled) setErr('Could not load document');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      {loading && <div className="h-36 animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/80" />}
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      {!loading && !err && blobUrl && mime === 'application/pdf' && (
        <a
          href={blobUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-accent-600 dark:text-accent-400 hover:underline"
        >
          Open PDF — {label}
        </a>
      )}
      {!loading && !err && blobUrl && mime !== 'application/pdf' && (
        <img src={blobUrl} alt={label} className="max-h-56 w-auto rounded-md border border-gray-200 dark:border-gray-600" />
      )}
    </div>
  );
}
