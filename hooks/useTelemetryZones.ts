import { useMemo } from 'react';
import { GEOFENCE_RADIUS_PRESETS, ZONE_PRESETS } from '../lib/zonesCatalog';
import type { UpdateTerminalSettingsRequest } from '../lib/types';

export function useTelemetryZones() {
  const presets = useMemo(
    () => [
      ...ZONE_PRESETS,
      {
        id: 'custom',
        name: 'Zone personnalisee',
        defaultRadiusMeters: 100,
        preset: false as const,
      },
    ],
    [],
  );

  function toSettingsPayload(
    zoneId: string,
    center: { latitude: number; longitude: number },
    radius?: number | null,
    customName?: string | null,
  ): UpdateTerminalSettingsRequest | null {
    const zone = presets.find((item) => item.id === zoneId);
    if (!zone) return null;

    return {
      authorizedZoneName:
        zone.id === 'custom' ? customName?.trim() || 'Zone personnalisee' : zone.name,
      baseLatitude: center.latitude,
      baseLongitude: center.longitude,
      alertRadiusMeters: radius && radius > 0 ? radius : zone.defaultRadiusMeters,
    };
  }

  return {
    presets,
    radiusPresets: [...GEOFENCE_RADIUS_PRESETS],
    toSettingsPayload,
  };
}
