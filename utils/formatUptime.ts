/**
 * Convertit un uptime en secondes en chaîne lisible.
 * Ex : 90061 → "1 j 1 h 01 min"
 */
export function formatUptime(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '—';
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  parts.push(`${String(mins).padStart(2, '0')} min`);

  return parts.join(' ');
}

/**
 * Convertit un uptime en secondes en objet structuré.
 */
export function parseUptime(seconds?: number | null): {
  days: number; hours: number; minutes: number; seconds: number;
} {
  if (seconds == null || seconds < 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const s = Math.floor(seconds);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/**
 * Formate des bytes en Mo/Go lisible.
 * Ex : 1_073_741_824 → "1.0 Go"
 */
export function formatBytes(bytes?: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
}
