export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RoadRoute = {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  source: 'google' | 'fallback';
};

const GOOGLE_ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

function toFallbackRoute(origin: RoutePoint, destination: RoutePoint): RoadRoute {
  const distanceMeters = haversineDistanceMeters(origin, destination);
  const durationSeconds = Math.max(60, Math.round((distanceMeters / 1000 / 35) * 3600));

  return {
    coordinates: [origin, destination],
    distanceMeters,
    durationSeconds,
    source: 'fallback',
  };
}

function haversineDistanceMeters(a: RoutePoint, b: RoutePoint): number {
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function parseDurationSeconds(value?: string | null): number {
  if (!value) return 0;
  if (!value.endsWith('s')) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value.slice(0, -1));
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeEncodedPolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

export function formatDurationMinutes(durationSeconds?: number): string {
  if (!durationSeconds || durationSeconds <= 0) return '—';
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${minutes} min`;
}

export function formatDistanceKm(distanceMeters?: number): string {
  if (!distanceMeters || distanceMeters <= 0) return '—';
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(2)} km`;
  return `${Math.round(distanceMeters)} m`;
}

export function getRouteKey(point: RoutePoint | null | undefined): string {
  if (!point) return 'none';
  return `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
}

export async function fetchRoadRoute(
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<RoadRoute> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    return toFallbackRoute(origin, destination);
  }

  try {
    const response = await fetch(GOOGLE_ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        polylineQuality: 'HIGH_QUALITY',
        computeAlternativeRoutes: false,
        languageCode: 'fr-FR',
        units: 'METRIC',
      }),
    });

    if (!response.ok) {
      return toFallbackRoute(origin, destination);
    }

    const payload = await response.json();
    const route = payload?.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;

    if (!encodedPolyline) {
      return toFallbackRoute(origin, destination);
    }

    const coordinates = decodeEncodedPolyline(encodedPolyline);

    return {
      coordinates: coordinates.length > 1 ? coordinates : [origin, destination],
      distanceMeters: Number(route?.distanceMeters) || haversineDistanceMeters(origin, destination),
      durationSeconds: parseDurationSeconds(route?.duration),
      source: 'google',
    };
  } catch {
    return toFallbackRoute(origin, destination);
  }
}
