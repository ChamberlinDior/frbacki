import React from 'react';
import { View } from 'react-native';
import type { TerminalSummary } from '../lib/types';
import { TerminalMap } from './TerminalMap';

interface Props {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  zoneName?: string;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  alertRadiusMeters?: number | null;
  outsideAuthorizedZone?: boolean | null;
}

export function MapEmbed({
  lat,
  lng,
  label,
  height = 220,
  zoneName,
  baseLatitude,
  baseLongitude,
  alertRadiusMeters,
  outsideAuthorizedZone,
}: Props) {
  const terminal: TerminalSummary = {
    id: 0,
    deviceKey: label ?? 'map',
    displayName: label ?? 'Position TPE',
    lastGpsLat: lat,
    lastGpsLng: lng,
    authorizedZoneName: zoneName,
    baseLatitude,
    baseLongitude,
    alertRadiusMeters,
    outsideAuthorizedZone,
    connectivityStatus: 'ONLINE',
  };

  return (
    <View>
      <TerminalMap terminals={[terminal]} height={height} />
    </View>
  );
}
