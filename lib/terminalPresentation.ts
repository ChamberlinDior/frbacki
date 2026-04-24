import type { Terminal, TerminalConnectivityStatus, TerminalSummary } from './types';

export type TerminalLike = TerminalSummary | Terminal;

export function getTerminalName(terminal: TerminalLike): string {
  return (
    terminal.displayName?.trim() ||
    terminal.serialNumber?.trim() ||
    terminal.deviceKey ||
    `TPE #${terminal.id}`
  );
}

export function getConnectivityStatus(terminal: TerminalLike): TerminalConnectivityStatus {
  return terminal.connectivityStatus === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
}

export function getFreshnessMinutes(terminal: TerminalLike): number | null {
  const iso = terminal.lastActivityAt ?? terminal.lastSeenAt;
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

export function formatFreshness(terminal: TerminalLike): string {
  const mins = getFreshnessMinutes(terminal);
  if (mins == null) return 'Inconnue';
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBattery(value?: number | null): string {
  return value == null ? '—' : `${value}%`;
}

export function formatNetwork(value?: string | null): string {
  if (!value) return '—';
  return value.replace('CELL_', '').replace('_', ' ');
}

export function formatSignal(value?: number | null): string {
  return value == null ? '—' : `${value}/4`;
}

export function formatStorageFree(free?: number | null, total?: number | null): string {
  if (free == null) return '—';
  if (total == null || total <= 0) return `${free} Mo`;
  const pct = Math.round((free / total) * 100);
  return `${pct}% libre`;
}

export function terminalHasPosition(terminal: TerminalLike): boolean {
  return terminal.lastGpsLat != null && terminal.lastGpsLng != null;
}

export function terminalHasGeofence(terminal: TerminalLike): boolean {
  return (
    terminal.baseLatitude != null &&
    terminal.baseLongitude != null &&
    terminal.alertRadiusMeters != null
  );
}
