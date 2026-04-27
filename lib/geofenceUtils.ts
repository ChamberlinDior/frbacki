import { UI } from '../constants/theme';
import { getLiveMovementSnapshot } from './liveMovementState';
import type { Terminal, TerminalSummary } from './types';

export type TerminalGeoLike = TerminalSummary | Terminal;

export function hasValidTerminalPosition(terminal?: TerminalGeoLike | null): boolean {
  const live = getLiveMovementSnapshot(terminal?.id);
  const lat = live?.currentLat ?? terminal?.lastGpsLat;
  const lng = live?.currentLng ?? terminal?.lastGpsLng;
  return lat != null && lng != null;
}

export function hasValidGeofence(terminal?: TerminalGeoLike | null): boolean {
  return (
    terminal?.baseLatitude != null &&
    terminal?.baseLongitude != null &&
    terminal?.alertRadiusMeters != null &&
    terminal.alertRadiusMeters > 0
  );
}

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;

  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

export function getGeofenceDistance(terminal?: TerminalGeoLike | null): number | null {
  if (!terminal) return null;
  const live = getLiveMovementSnapshot(terminal.id);
  return getDistanceMeters(
    live?.currentLat ?? terminal.lastGpsLat,
    live?.currentLng ?? terminal.lastGpsLng,
    terminal.baseLatitude,
    terminal.baseLongitude,
  );
}

export function getGeofenceStatus(terminal?: TerminalGeoLike | null): 'inside' | 'outside' | 'unknown' {
  if (!terminal) return 'unknown';

  const hasGeofence = hasValidGeofence(terminal);
  const hasPosition = hasValidTerminalPosition(terminal);

  if (hasGeofence && hasPosition) {
    const distance = getGeofenceDistance(terminal);
    if (distance != null && terminal.alertRadiusMeters != null) {
      return distance > terminal.alertRadiusMeters ? 'outside' : 'inside';
    }
  }

  const live = getLiveMovementSnapshot(terminal.id);
  if (live) {
    return live.outside ? 'outside' : 'inside';
  }

  if (terminal.outsideAuthorizedZone === true) return 'outside';
  if (terminal.outsideAuthorizedZone === false && hasGeofence) return 'inside';

  return 'unknown';
}

export function getGeofenceLabel(terminal?: TerminalGeoLike | null): string {
  const status = getGeofenceStatus(terminal);
  if (status === 'inside') return 'Dans la zone';
  if (status === 'outside') return 'Hors zone';
  return 'Zone indisponible';
}

export function getGeofenceTone(terminal?: TerminalGeoLike | null): 'info' | 'ok' | 'bad' {
  const status = getGeofenceStatus(terminal);
  if (status === 'outside') return 'bad';
  if (status === 'inside') return 'ok';
  return 'info';
}

export function getGeofenceColors(terminal?: TerminalGeoLike | null) {
  const status = getGeofenceStatus(terminal);
  if (status === 'outside') {
    return {
      stroke: UI.bad,
      fill: 'rgba(214,69,69,0.16)',
      marker: UI.bad,
      badgeBg: UI.badBg,
    };
  }

  return {
    stroke: UI.info,
    fill: 'rgba(31,111,229,0.12)',
    marker: UI.info,
    badgeBg: UI.infoBg,
  };
}

export function formatDistanceMeters(value?: number | null): string {
  if (value == null) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${value} m`;
}

export function getGeofenceAlertMessage(terminal: TerminalGeoLike): string | null {
  if (getGeofenceStatus(terminal) !== 'outside') return null;
  const distance = formatDistanceMeters(getGeofenceDistance(terminal));
  const zoneName = terminal.authorizedZoneName ?? 'Zone personnalisee';
  const terminalName = terminal.displayName?.trim() || terminal.serialNumber?.trim() || terminal.deviceKey;
  return `${terminalName} a depasse ${zoneName} (${distance}).`;
}
