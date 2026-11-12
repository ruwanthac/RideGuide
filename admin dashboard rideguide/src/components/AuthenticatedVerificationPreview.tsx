import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { adminUrl, authHeaderBearerOnly } from '../lib/api';

type Props = {
  userId: string;
  field: string;
  label: string;
};

/** A provider's uploaded document, fetched with the admin token. Shows a preview tile with "Open full size". */
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
        if (!res.ok) throw new Error(res.status === 404 ? 'not found' : `HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setBlobUrl(objectUrl);
          setMime(blob.type || null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error && e.message === 'not found' ? 'This file is missing.' : 'We couldn’t load this file.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  const isPdf = mime === 'application/pdf';

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-gray-700 dark:bg-gray-800">
        {loading && <div className="h-full w-full animate-pulse bg-slate-200/80 dark:bg-gray-700/80" />}
        {!loading && err && <p className="px-4 text-center text-sm text-red-600 dark:text-red-400">{err}</p>}
        {!loading && !err && blobUrl && isPdf && (
          <span className="flex flex-col items-center gap-2 text-slate-500 dark:text-gray-400">
            <FileText className="h-10 w-10" />
            <span className="text-xs font-semibold">PDF document</span>
          </span>
        )}
        {!loading && !err && blobUrl && !isPdf && <img src={blobUrl} alt={label} className="h-full w-full object-contain" />}
      </div>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">{label}</span>
        {blobUrl && (
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-accent-500 hover:text-accent-600"
          >
            Open full size <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}
