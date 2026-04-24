import type {
  TerminalConnectionHistoryResponse,
  TerminalSummary,
  TelemetrySnapshot,
} from './types';

export type IdentityLike = Partial<
  TerminalSummary & {
    deviceSerial?: string | null;
    deviceId?: string | null;
    installationId?: string | null;
    hardwareId?: string | null;
    uuid?: string | null;
  }
>;

export type ConnectionHistoryItem = {
  id: string;
  terminalId: number;
  terminalName: string;
  normalizedIdentity: string;
  previousIdentifier: string;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  status: string;
  eventType: string;
  source?: string | null;
};

function clean(value?: string | null): string {
  return (value ?? '').trim();
}

function compact(value?: string | null): string {
  return clean(value).replace(/\s+/g, '').toUpperCase();
}

function normalizeToken(value?: string | null): string {
  return compact(value).replace(/[^A-Z0-9_-]/g, '');
}

export function isTemporaryIdentity(value?: string | null): boolean {
  const token = compact(value);
  if (!token) return false;
  return (
    token.startsWith('PHONE-') ||
    token.startsWith('TEMP-') ||
    token.startsWith('TMP-') ||
    token.startsWith('ANDROID-') ||
    token.startsWith('UUID-')
  );
}

function stableIdentityCandidates(device: IdentityLike): string[] {
  const serial = normalizeToken(device.serialNumber ?? device.deviceSerial);
  const deviceId = normalizeToken(device.deviceId);
  const installationId = normalizeToken(device.installationId);
  const hardwareId = normalizeToken(device.hardwareId);
  const uuid = normalizeToken(device.uuid);
  const androidId = normalizeToken(device.androidId);
  const imei = normalizeToken(device.imei1);
  const deviceKey = normalizeToken(device.deviceKey);

  return [
    !isTemporaryIdentity(serial) ? `SERIAL:${serial}` : '',
    !isTemporaryIdentity(deviceId) ? `DEVICE:${deviceId}` : '',
    !isTemporaryIdentity(installationId) ? `INSTALL:${installationId}` : '',
    !isTemporaryIdentity(hardwareId) ? `HARDWARE:${hardwareId}` : '',
    !isTemporaryIdentity(uuid) ? `UUID:${uuid}` : '',
    !isTemporaryIdentity(androidId) ? `ANDROID:${androidId}` : '',
    !isTemporaryIdentity(imei) ? `IMEI:${imei}` : '',
    deviceKey ? `KEY:${deviceKey.replace(/^PHONE-/, 'DEVICE-')}` : '',
  ].filter(Boolean);
}

export function normalizeDeviceIdentity(device: IdentityLike): string {
  return stableIdentityCandidates(device)[0] || 'UNKNOWN_DEVICE';
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function latestTimestamp(device: TerminalSummary): number {
  return Math.max(
    toTimestamp(device.lastActivityAt),
    toTimestamp(device.lastSeenAt),
    toTimestamp(device.lastConnectedAt),
    toTimestamp(device.lastDisconnectedAt),
  );
}

function preferString(current?: string | null, candidate?: string | null): string | null | undefined {
  if (clean(candidate)) return candidate;
  return current;
}

function preferNumber(current?: number | null, candidate?: number | null): number | null | undefined {
  return candidate != null ? candidate : current;
}

function preferBoolean(current?: boolean | null, candidate?: boolean | null): boolean | null | undefined {
  return candidate != null ? candidate : current;
}

function chooseLatestIso(a?: string | null, b?: string | null): string | null | undefined {
  return toTimestamp(b) >= toTimestamp(a) ? b : a;
}

function mergeDeviceState(base: TerminalSummary, candidate: TerminalSummary): TerminalSummary {
  const baseIsOlder = latestTimestamp(candidate) > latestTimestamp(base);
  const primary = baseIsOlder ? candidate : base;
  const secondary = baseIsOlder ? base : candidate;

  return {
    ...secondary,
    ...primary,
    id: primary.id,
    deviceKey: preferString(primary.deviceKey, secondary.deviceKey) ?? primary.deviceKey,
    serialNumber: preferString(primary.serialNumber, secondary.serialNumber),
    displayName: preferString(primary.displayName, secondary.displayName),
    authorizedZoneName: preferString(primary.authorizedZoneName, secondary.authorizedZoneName),
    baseLatitude: preferNumber(primary.baseLatitude, secondary.baseLatitude),
    baseLongitude: preferNumber(primary.baseLongitude, secondary.baseLongitude),
    alertRadiusMeters: preferNumber(primary.alertRadiusMeters, secondary.alertRadiusMeters),
    lastGpsLat: preferNumber(primary.lastGpsLat, secondary.lastGpsLat),
    lastGpsLng: preferNumber(primary.lastGpsLng, secondary.lastGpsLng),
    lastBatteryPercent: preferNumber(primary.lastBatteryPercent, secondary.lastBatteryPercent),
    lastSignalLevel: preferNumber(primary.lastSignalLevel, secondary.lastSignalLevel),
    lastStorageFreeMb: preferNumber(primary.lastStorageFreeMb, secondary.lastStorageFreeMb),
    lastStorageTotalMb: preferNumber(primary.lastStorageTotalMb, secondary.lastStorageTotalMb),
    lastNetworkType: primary.lastNetworkType ?? secondary.lastNetworkType,
    totalConnectionCount: Math.max(primary.totalConnectionCount ?? 0, secondary.totalConnectionCount ?? 0),
    lastConnectedAt: chooseLatestIso(primary.lastConnectedAt, secondary.lastConnectedAt),
    lastDisconnectedAt: chooseLatestIso(primary.lastDisconnectedAt, secondary.lastDisconnectedAt),
    lastActivityAt: chooseLatestIso(primary.lastActivityAt, secondary.lastActivityAt),
    lastSeenAt: chooseLatestIso(primary.lastSeenAt, secondary.lastSeenAt),
    connectivityStatus: primary.connectivityStatus ?? secondary.connectivityStatus,
    outsideAuthorizedZone: preferBoolean(primary.outsideAuthorizedZone, secondary.outsideAuthorizedZone),
    lastAddressLine: preferString(primary.lastAddressLine, secondary.lastAddressLine),
    city: preferString(primary.city, secondary.city),
    country: preferString(primary.country, secondary.country),
  };
}

export function getLatestDeviceSnapshot(devices: TerminalSummary[]): TerminalSummary | null {
  if (devices.length === 0) return null;
  return [...devices].sort((a, b) => latestTimestamp(b) - latestTimestamp(a))[0] ?? null;
}

export function deduplicateDevices(devices: TerminalSummary[]): TerminalSummary[] {
  const byIdentity = new Map<string, TerminalSummary>();

  for (const device of devices) {
    const identity = normalizeDeviceIdentity(device);
    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, device);
      continue;
    }

    byIdentity.set(identity, mergeDeviceState(existing, device));
  }

  return [...byIdentity.values()].sort((a, b) => latestTimestamp(b) - latestTimestamp(a));
}

export function buildConnectionHistory(
  terminal: TerminalSummary,
  history: TerminalConnectionHistoryResponse[],
): ConnectionHistoryItem[] {
  const normalizedIdentity = normalizeDeviceIdentity(terminal);
  const terminalName = clean(terminal.displayName) || clean(terminal.serialNumber) || terminal.deviceKey;

  return history
    .map((item) => ({
      id: `${terminal.id}-${item.id}`,
      terminalId: terminal.id,
      terminalName,
      normalizedIdentity,
      previousIdentifier: item.source ?? terminal.serialNumber ?? terminal.deviceKey,
      connectedAt: item.connectedAt,
      disconnectedAt: item.disconnectedAt,
      status: item.disconnectedAt ? 'Deconnecte' : 'Connecte',
      eventType: item.eventType,
      source: item.source,
    }))
    .sort((a, b) => toTimestamp(b.connectedAt) - toTimestamp(a.connectedAt));
}

export function deduplicateTelemetrySnapshots(
  snapshots: TelemetrySnapshot[],
  terminalsById: Map<number, TerminalSummary>,
): TelemetrySnapshot[] {
  const byIdentity = new Map<string, TelemetrySnapshot>();

  for (const snapshot of snapshots) {
    const terminal = terminalsById.get(snapshot.terminalId);
    const identity = normalizeDeviceIdentity({
      deviceKey: terminal?.deviceKey ?? `terminal-${snapshot.terminalId}`,
      serialNumber: terminal?.serialNumber,
      androidId: terminal?.androidId,
      imei1: terminal?.imei1,
    });
    const existing = byIdentity.get(identity);

    if (!existing || toTimestamp(snapshot.capturedAt) > toTimestamp(existing.capturedAt)) {
      byIdentity.set(identity, snapshot);
    }
  }

  return [...byIdentity.values()].sort((a, b) => toTimestamp(b.capturedAt) - toTimestamp(a.capturedAt));
}
