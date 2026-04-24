export const UI = {
  bgTop: '#F8FBFF',
  bgMid: '#F4F8FD',
  bgBot: '#EEF5FF',
  page: '#F6FAFF',

  card: '#FFFFFF',
  card2: '#F5F8FC',
  stroke: '#D7E3F2',
  stroke2: '#E6EEF8',

  ink: '#12324A',
  ink2: '#214A6A',
  muted: '#58748D',
  muted2: '#72879A',
  faint: '#9AB0C4',

  ok: '#1F9D61',
  warn: '#E2A100',
  bad: '#D64545',
  info: '#1F6FE5',
  accent: '#FFCB3D',

  okBg: '#E8F7EF',
  warnBg: '#FFF5D7',
  badBg: '#FCE7E7',
  infoBg: '#E8F1FF',
  accentBg: '#FFF8DB',

  black: '#12324A',
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
