export const UI = {
  bgTop: '#F3F7FC',
  bgMid: '#EAF1FA',
  bgBot: '#DCE8F7',
  page: '#EDF3FB',

  card: 'rgba(255,255,255,0.88)',
  card2: '#F4F7FB',
  stroke: '#CCD9EA',
  stroke2: '#DEE7F2',

  ink: '#0F2940',
  ink2: '#214766',
  muted: '#5C738A',
  muted2: '#76879A',
  faint: '#9AAABD',

  ok: '#16895B',
  warn: '#C98B14',
  bad: '#C94444',
  info: '#165FCD',
  accent: '#C9A227',

  okBg: '#E6F5EE',
  warnBg: '#FFF4D9',
  badBg: '#FBEAEA',
  infoBg: '#E8F0FD',
  accentBg: '#FBF3D7',

  black: '#0F2940',
  white: '#FFFFFF',
} as const;

export type Tone = 'ok' | 'warn' | 'bad' | 'info';

export function toneColor(t: Tone): string {
  return UI[t];
}

export function toneBg(t: Tone): string {
  const map: Record<Tone, string> = {
    ok: UI.okBg,
    warn: UI.warnBg,
    bad: UI.badBg,
    info: UI.infoBg,
  };
  return map[t];
}

export function batteryTone(pct?: number | null): Tone {
  if (pct == null) return 'info';
  if (pct <= 15) return 'bad';
  if (pct <= 30) return 'warn';
  return 'ok';
}

export function onlineTone(online?: boolean): Tone {
  return online ? 'ok' : 'bad';
}

export function batteryIcon(pct?: number | null, charging?: boolean | null): string {
  if (charging) return 'battery-charging-outline';
  if (pct == null) return 'battery-dead-outline';
  if (pct >= 95) return 'battery-full-outline';
  if (pct >= 50) return 'battery-half-outline';
  return 'battery-dead-outline';
}
