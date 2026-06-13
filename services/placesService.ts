import * as Location from 'expo-location';
import { logger } from '../utils/logger';

// Place search for the in-app location picker.
//
// Provider chain (first available wins):
//   1. Google Places Text Search — only when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
//      is set. Explicit `language` (Arabic queries return Arabic-labelled
//      results) and Saudi region bias.
//   2. OpenStreetMap Nominatim — free, keyless, supports accept-language=ar
//      and country filtering. Usage policy: max 1 req/s and NO autocomplete,
//      so keyless search must stay submit-driven (isGooglePlacesEnabled()
//      gates search-as-you-type in the UI for exactly this reason).
//   3. expo-location's platform geocoder — last resort, same behavior the
//      picker had before this service existed.
// Callers never need to know which provider answered.

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SEARCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;

export interface PlaceResult {
  /** Short display name (POI/neighborhood name, or the query itself for geocoder hits). */
  name: string;
  /** Longer formatted address line; may be empty for geocoder fallback hits. */
  address: string;
  latitude: number;
  longitude: number;
}

/** True when Google Places is configured (enables search-as-you-type in the UI). */
export const isGooglePlacesEnabled = (): boolean => !!GOOGLE_KEY;

const searchWithGoogle = async (
  query: string,
  language: 'ar' | 'en'
): Promise<PlaceResult[]> => {
  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json' +
    `?query=${encodeURIComponent(query)}` +
    `&language=${language}` +
    '&region=sa' +
    `&key=${GOOGLE_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
    const json = await res.json();
    if (json.status === 'ZERO_RESULTS') return [];
    if (json.status !== 'OK') throw new Error(`Places status ${json.status}`);
    return (json.results as any[]).slice(0, MAX_RESULTS).map((r) => ({
      name: r.name ?? r.formatted_address ?? query,
      address: r.formatted_address ?? '',
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
    }));
  } finally {
    clearTimeout(timer);
  }
};

const searchWithNominatim = async (
  query: string,
  language: 'ar' | 'en'
): Promise<PlaceResult[]> => {
  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(query)}` +
    '&format=jsonv2' +
    `&limit=${MAX_RESULTS}` +
    '&countrycodes=sa' +
    `&accept-language=${language}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim's usage policy requires an identifying User-Agent.
        'User-Agent': 'fixate-mobile/1.0 (location picker)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const json = (await res.json()) as any[];
    return (json ?? []).slice(0, MAX_RESULTS).map((r) => {
      // display_name is a full comma-separated chain ("النرجس, الرياض, …");
      // use the leading segment as the short name and the rest as address.
      const display = String(r.display_name ?? query);
      const commaAt = display.indexOf(',');
      return {
        name: r.name?.trim() || (commaAt > 0 ? display.slice(0, commaAt) : display),
        address: commaAt > 0 ? display.slice(commaAt + 1).trim() : '',
        latitude: Number(r.lat),
        longitude: Number(r.lon),
      };
    }).filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  } finally {
    clearTimeout(timer);
  }
};

const searchWithGeocoder = async (query: string): Promise<PlaceResult[]> => {
  let results = await Location.geocodeAsync(query);
  // Bare neighborhood/landmark queries (especially Arabic ones like
  // "النرجس") often miss without a country qualifier — retry biased
  // to Saudi Arabia before reporting no results.
  if (!results?.length && !/saudi|السعودية/i.test(query)) {
    results = await Location.geocodeAsync(`${query}, Saudi Arabia`);
  }
  return (results ?? []).slice(0, MAX_RESULTS).map((r) => ({
    name: query,
    address: '',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
};

/**
 * Search for places by free-text query in the requested language.
 * Throws only when every available provider failed; an empty array
 * means the query genuinely had no matches.
 */
export const searchPlaces = async (
  query: string,
  language: 'ar' | 'en'
): Promise<PlaceResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (GOOGLE_KEY) {
    try {
      return await searchWithGoogle(trimmed, language);
    } catch (error) {
      // Key misconfigured / quota / network — degrade to the free chain
      // instead of surfacing a hard failure to the customer.
      logger.warn('Google Places search failed, falling back to Nominatim', error);
    }
  }
  try {
    const results = await searchWithNominatim(trimmed, language);
    // Bare neighborhood queries sometimes miss in Nominatim too — only fall
    // through to the platform geocoder when Nominatim found nothing.
    if (results.length > 0) return results;
  } catch (error) {
    logger.warn('Nominatim search failed, falling back to platform geocoder', error);
  }
  return searchWithGeocoder(trimmed);
};
