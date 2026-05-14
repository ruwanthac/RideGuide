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
