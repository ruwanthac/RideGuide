import { XMLParser } from 'fast-xml-parser';

/**
 * Vehicle news for the app's home screen, from free public RSS feeds (no API key, no cost).
 * Headlines are fetched at most every few hours and kept in memory; users only ever hit the cache.
 * The app shows the headline, a short summary and the picture, and links out to the publisher.
 */

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  link: string;
  imageUrl: string | null;
  source: string;
  /** 'local' = Sri Lankan source (road/traffic/fuel news); 'world' = international motoring news */
  region: 'local' | 'world';
  publishedAt: string;
};

type FeedConfig = {
  url: string;
  source: string;
  region: NewsItem['region'];
  /** General-news feeds: keep only items that mention vehicles, roads, fuel, etc. */
  vehicleTopicsOnly?: boolean;
};

export const NEWS_FEEDS: FeedConfig[] = [
  { url: 'https://www.adaderana.lk/rss.php', source: 'Ada Derana', region: 'local', vehicleTopicsOnly: true },
  { url: 'https://economynext.com/feed/', source: 'EconomyNext', region: 'local', vehicleTopicsOnly: true },
  { url: 'https://www.motor1.com/rss/news/all/', source: 'Motor1', region: 'world' },
  { url: 'https://www.carscoops.com/feed/', source: 'Carscoops', region: 'world' },
  { url: 'https://www.caranddriver.com/rss/all.xml/', source: 'Car and Driver', region: 'world' },
  { url: 'https://www.thedrive.com/feed', source: 'The Drive', region: 'world' },
  { url: 'https://electrek.co/feed/', source: 'Electrek', region: 'world' },
];

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_ITEMS = 20;
const MAX_PER_SOURCE = 4;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOCAL = 3;
/** Road closures and fuel news go stale fast */
const MAX_LOCAL_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SUMMARY_MAX = 160;

const VEHICLE_TOPICS =
  /\b(vehicles?|cars?|motor(ists?|cycles?|ing)?|fuel|petrol|diesel|tyres?|tires?|traffic|roads?|highways?|expressway|accidents?|crash|buses|bus|lorry|lorries|three-wheelers?|tuk-?tuks?|EVs?|electric vehicles?|driving|drivers?|licen[cs]es?|vehicle imports?|toll)\b/i;

/** Shopping deals and sponsored posts that some motoring feeds mix in with the news */
const NOT_NEWS = /(\d+% off|\$\d[\d,]* off\b|\bblack friday\b|\bcyber monday\b|\bcoupon|\bsponsored\b|\bgiveaway\b|\bdeal of the day\b)/i;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item' || name === 'media:content' || name === 'media:thumbnail',
});

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function textOf(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in (value as object)) return String((value as any)['#text']);
  return '';
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}

/** Only links the app can safely open, and only https images (iOS blocks plain http). */
function safeUrl(value: string, httpsOnly = false): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' || (!httpsOnly && url.protocol === 'http:')) return url.toString();
  } catch {
    // not a URL
  }
  return null;
}

function imageOf(item: any): string | null {
  const candidates: string[] = [];
  const enclosure = item.enclosure;
  if (enclosure?.['@_url'] && String(enclosure['@_type'] ?? 'image').startsWith('image')) {
    candidates.push(enclosure['@_url']);
  }
  for (const m of item['media:content'] ?? []) {
    if (m?.['@_url'] && String(m['@_medium'] ?? m['@_type'] ?? 'image').startsWith('image')) candidates.push(m['@_url']);
  }
  for (const m of item['media:thumbnail'] ?? []) if (m?.['@_url']) candidates.push(m['@_url']);
  const html = `${textOf(item['content:encoded'])} ${textOf(item.description)}`;
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) candidates.push(decodeEntities(img[1]));
  for (const c of candidates) {
    const url = safeUrl(c, true);
    if (url) return url;
  }
  return null;
}

/** Parses one RSS document into news items (unsorted, unfiltered by age). */
export function parseFeed(xml: string, feed: FeedConfig): NewsItem[] {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  const items: any[] = channel?.item ?? [];
  // Some feeds (e.g. Ada Derana) give items no date; their channel's build time is the best we have.
  const channelDate = textOf(channel?.lastBuildDate) || textOf(channel?.pubDate);
  const out: NewsItem[] = [];
  for (const item of items) {
    const title = shorten(plainText(textOf(item.title)), 140);
    const link = safeUrl(textOf(item.link));
    const published = new Date(textOf(item.pubDate) || textOf(item['dc:date']) || channelDate);
    if (!title || !link || Number.isNaN(published.getTime())) continue;
    const summary = shorten(plainText(textOf(item.description) || textOf(item['content:encoded'])), SUMMARY_MAX);
    if (feed.vehicleTopicsOnly && !VEHICLE_TOPICS.test(`${title} ${summary}`)) continue;
    if (NOT_NEWS.test(title)) continue;
    out.push({
      id: link,
      title,
      summary,
      link,
      imageUrl: imageOf(item),
      source: feed.source,
      region: feed.region,
      publishedAt: published.toISOString(),
    });
  }
  return out;
}

/**
 * Newest first, recent only, no duplicate headlines, and a few per source so one site can't fill the list.
 * Up to MAX_LOCAL recent Sri Lankan items go first: there are few of them and they're the most useful locally.
 */
export function selectItems(all: NewsItem[], now = Date.now()): NewsItem[] {
  const seenTitles = new Set<string>();
  const perSource = new Map<string, number>();
  const sorted = [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const take = (item: NewsItem, maxAge: number): boolean => {
    const age = now - Date.parse(item.publishedAt);
    if (age > maxAge || age < -60 * 60 * 1000) return false;
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seenTitles.has(key)) return false;
    const count = perSource.get(item.source) ?? 0;
    if (count >= MAX_PER_SOURCE) return false;
    seenTitles.add(key);
    perSource.set(item.source, count + 1);
    return true;
  };

  const local = sorted.filter((i) => i.region === 'local' && take(i, MAX_LOCAL_AGE_MS)).slice(0, MAX_LOCAL);
  const world: NewsItem[] = [];
  for (const item of sorted) {
    if (local.length + world.length >= MAX_ITEMS) break;
    if (item.region === 'world' && take(item, MAX_AGE_MS)) world.push(item);
  }
  return [...local, ...world];
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'RideGuide/1.0 (vehicle news reader)', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${feed.source} feed returned ${res.status}`);
  return parseFeed(await res.text(), feed);
}

let cache: { items: NewsItem[]; fetchedAt: number } | null = null;
let refreshing: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const results = await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));
  const items: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else console.warn('[news] feed failed', { source: NEWS_FEEDS[i].source, error: String(r.reason) });
  });
  const selected = selectItems(items);
  // If every feed failed, keep showing the last good headlines rather than an empty list.
  if (selected.length > 0 || !cache) cache = { items: selected, fetchedAt: Date.now() };
}

/** Cached headlines; refreshes in the background-safe way (one fetch at a time) when older than the TTL. */
export async function getVehicleNews(): Promise<{ items: NewsItem[]; updatedAt: string | null }> {
  const stale = !cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS;
  if (stale) {
    refreshing ??= refresh()
      .catch((e) => console.warn('[news] refresh failed', e))
      .finally(() => {
        refreshing = null;
      });
    // First request ever has to wait; later ones get the previous list while a refresh runs.
    if (!cache) await refreshing;
  }
  return {
    items: cache?.items ?? [],
    updatedAt: cache ? new Date(cache.fetchedAt).toISOString() : null,
  };
}

/** For tests */
export function resetNewsCache() {
  cache = null;
  refreshing = null;
}
