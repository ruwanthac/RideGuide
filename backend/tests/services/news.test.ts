import { parseFeed, selectItems, NewsItem } from '../../src/services/news.service';

const world = { url: 'https://example.com/feed', source: 'Example Motors', region: 'world' as const };
const local = { url: 'https://example.lk/rss', source: 'Example LK', region: 'local' as const, vehicleTopicsOnly: true };

const worldXml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Example</title>
  <item><title><![CDATA[Toyota &amp; Honda recall 1M cars]]></title><link>https://example.com/a</link>
    <pubDate>Wed, 11 Nov 2026 10:00:00 +0000</pubDate>
    <description><![CDATA[<p>Both makers are recalling cars over a fuel pump fault that can stall the engine &#8211; check your VIN.</p>]]></description>
    <enclosure url="https://cdn.example.com/a.jpg" type="image/jpeg" length="1"/></item>
  <item><title>Image only in the body</title><link>https://example.com/b</link>
    <pubDate>Wed, 11 Nov 2026 09:00:00 +0000</pubDate>
    <content:encoded><![CDATA[Text <img src="https://cdn.example.com/b.jpg" />]]></content:encoded></item>
  <item><title>Plain http image is dropped</title><link>https://example.com/c</link>
    <pubDate>Wed, 11 Nov 2026 08:00:00 +0000</pubDate><media:thumbnail url="http://cdn.example.com/c.jpg"/></item>
  <item><title>New Corolla goes on sale in March</title><link>https://example.com/onsale</link><pubDate>Wed, 11 Nov 2026 07:00:00 +0000</pubDate></item>
  <item><title>E-bike $200 off in Black Friday sale</title><link>https://example.com/deal</link><pubDate>Wed, 11 Nov 2026 08:00:00 +0000</pubDate></item>
  <item><title>Unsafe link is skipped</title><link>javascript:alert(1)</link><pubDate>Wed, 11 Nov 2026 08:00:00 +0000</pubDate></item>
</channel></rss>`;

const localXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>LK</title>
  <lastBuildDate>Wed, 11 Nov 2026 12:00:00 GMT</lastBuildDate>
  <item><title>Kandy road closed due to landslide</title><link>https://example.lk/1</link></item>
  <item><title>Cricket team wins series</title><link>https://example.lk/2</link></item>
</channel></rss>`;

describe('news feeds', () => {
  it('parses titles, summaries and pictures; skips deals, unsafe links and plain-http images', () => {
    const items = parseFeed(worldXml, world);
    expect(items.map((i) => i.title)).toEqual([
      'Toyota & Honda recall 1M cars',
      'Image only in the body',
      'Plain http image is dropped',
      'New Corolla goes on sale in March',
    ]);
    expect(items[0].summary).toBe('Both makers are recalling cars over a fuel pump fault that can stall the engine – check your VIN.');
    expect(items[0].imageUrl).toBe('https://cdn.example.com/a.jpg');
    expect(items[1].imageUrl).toBe('https://cdn.example.com/b.jpg');
    expect(items[2].imageUrl).toBeNull();
  });

  it('keeps only vehicle topics from general news feeds, dated by the feed when items have no date', () => {
    const items = parseFeed(localXml, local);
    expect(items.map((i) => i.title)).toEqual(['Kandy road closed due to landslide']);
    expect(items[0].publishedAt).toBe('2026-11-11T12:00:00.000Z');
  });

  it('puts recent local news first, drops old items and duplicates, and caps each source', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const mk = (n: number, over: Partial<NewsItem> = {}): NewsItem => ({
      id: `id${n}`, title: `World story ${n}`, summary: '', link: `https://x/${n}`, imageUrl: null,
      source: 'A', region: 'world', publishedAt: new Date(now - n * 3600_000).toISOString(), ...over,
    });
    const items = selectItems(
      [
        ...Array.from({ length: 6 }, (_, n) => mk(n)),
        mk(1, { id: 'dup', source: 'B', title: 'World Story 1!' }),
        mk(2, { id: 'b2', source: 'B', title: 'Other' }),
        mk(10 * 24, { id: 'old', source: 'C', title: 'Ten days old' }),
        mk(5, { id: 'lk', source: 'LK', region: 'local', title: 'Road closed' }),
      ],
      now
    );
    expect(items[0].id).toBe('lk');
    expect(items.filter((i) => i.source === 'A')).toHaveLength(4);
    expect(items.map((i) => i.id)).not.toContain('dup');
    expect(items.map((i) => i.id)).not.toContain('old');
    expect(items.map((i) => i.id)).toContain('b2');
  });
});
