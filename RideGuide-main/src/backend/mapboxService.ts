export interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

export const hasMapboxToken = MAPBOX_TOKEN.length > 0;

const MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

function toSuggestion(feature: any): LocationSuggestion | null {
  const coords = feature?.center;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [longitude, latitude] = coords;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return {
    id: String(feature.id ?? `${latitude},${longitude}`),
    name: String(feature.text ?? feature.place_name ?? 'Selected location'),
    address: String(feature.place_name ?? feature.text ?? ''),
    latitude,
    longitude,
  };
}

export async function searchMapboxPlaces(
  query: string,
  options?: { limit?: number; country?: string; proximity?: { latitude: number; longitude: number } }
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || !hasMapboxToken) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    language: 'en',
    limit: String(options?.limit ?? 6),
  });
  if (options?.country) params.set('country', options.country);
  if (options?.proximity) {
    params.set('proximity', `${options.proximity.longitude},${options.proximity.latitude}`);
  }

  const response = await fetch(`${MAPBOX_BASE_URL}/${encodeURIComponent(trimmed)}.json?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Mapbox search failed (${response.status})`);
  }
  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map(toSuggestion).filter((item): item is LocationSuggestion => item !== null);
}

export async function reverseGeocodeMapbox(latitude: number, longitude: number): Promise<LocationSuggestion | null> {
  if (!hasMapboxToken) return null;
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    limit: '1',
    language: 'en',
  });
  const response = await fetch(`${MAPBOX_BASE_URL}/${longitude},${latitude}.json?${params.toString()}`);
  if (!response.ok) return null;
  const data = await response.json();
  const first = Array.isArray(data?.features) ? data.features[0] : null;
  return toSuggestion(first);
}

