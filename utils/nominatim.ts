/**
 * utils/nominatim.ts — Reverse geocoding via Nominatim OpenStreetMap
 * Cache mémoire + rate limiting 1.5 s entre appels
 */

export interface NominatimResult {
  addressLine: string;
  city?: string;
  district?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

// ── Cache mémoire ────────────────────────────────────────────────────────────
const cache = new Map<string, NominatimResult | null>();

// ── Contrôle du débit : 1 appel max toutes les 1.5 s ──────────────────────
let lastCallAt = 0;
const RATE_LIMIT_MS = 1500;

function cacheKey(lat: number, lng: number): string {
  // Arrondi à 4 décimales (~11 m de précision) pour grouper les requêtes voisines
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Reverse geocode une position GPS.
 * Retourne null si l'API est inaccessible ou si aucune adresse n'est trouvée.
 * Ne lance jamais d'erreur — failure silencieuse.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<NominatimResult | null> {
  const key = cacheKey(lat, lng);

  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  // Rate limiting : attendre si le dernier appel est trop récent
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastCallAt = Date.now();

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'fr', 'User-Agent': 'TPE-Monitoring/2.0' },
    });

    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const json: any = await res.json();
    const addr = json?.address ?? {};

    const road      = addr.road ?? addr.pedestrian ?? addr.footway ?? '';
    const houseNum  = addr.house_number ?? '';
    const suburb    = addr.suburb ?? addr.neighbourhood ?? '';
    const city      = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? '';
    const state     = addr.state ?? addr.county ?? '';
    const country   = addr.country ?? '';
    const postcode  = addr.postcode ?? '';

    const parts = [houseNum, road].filter(Boolean).join(' ');
    const addressLine = json.display_name
      ? (parts || json.display_name.split(',').slice(0, 2).join(',').trim())
      : '—';

    const result: NominatimResult = {
      addressLine,
      city:       city   || undefined,
      district:   suburb || undefined,
      region:     state  || undefined,
      country:    country || undefined,
      postalCode: postcode || undefined,
    };

    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
