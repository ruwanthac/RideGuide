/**
 * Driving distance in km between two WGS84 points (roads), Mapbox first then OSRM public demo.
 */
export async function fetchDrivingDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mapboxToken?: string | null,
): Promise<number | null> {
  const tryMapbox = async (): Promise<number | null> => {
    const t = mapboxToken?.trim();
    if (!t) return null;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=false&access_token=${encodeURIComponent(t)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { distance?: number }[] };
    const m = data?.routes?.[0]?.distance;
    return typeof m === 'number' && Number.isFinite(m) ? m / 1000 : null;
  };

  const tryOsrm = async (): Promise<number | null> => {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { distance?: number }[] };
    const m = data?.routes?.[0]?.distance;
    return typeof m === 'number' && Number.isFinite(m) ? m / 1000 : null;
  };

  try {
    const k = await tryMapbox();
    if (k != null) return k;
  } catch {
    /* ignore */
  }
  try {
    const k = await tryOsrm();
    if (k != null) return k;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Driving distance (km) and time (minutes) between two points, Mapbox first then OSRM.
 * Used for "12 min · 4.1 km away" while a mechanic or tow truck is on the way.
 */
export async function fetchDrivingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mapboxToken?: string | null,
): Promise<{ km: number; minutes: number } | null> {
  const parse = (data: { routes?: { distance?: number; duration?: number }[] }) => {
    const r = data?.routes?.[0];
    if (typeof r?.distance !== 'number' || typeof r?.duration !== 'number') return null;
    return { km: r.distance / 1000, minutes: Math.max(1, Math.round(r.duration / 60)) };
  };
  const urls: string[] = [];
  const t = mapboxToken?.trim();
  if (t) {
    urls.push(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
        `?overview=false&access_token=${encodeURIComponent(t)}`
    );
  }
  urls.push(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const route = parse(await res.json());
      if (route) return route;
    } catch {
      /* try the next provider */
    }
  }
  return null;
}
