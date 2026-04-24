/**
 * components/GaugeBar.tsx — Jauge horizontale avec couleur et label
 * Utilisée pour batterie, stockage, CPU, RAM.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UI, type Tone } from '../constants/theme';

interface Props {
  /** Valeur affichée (0-100 ou valeur absolue selon mode) */
  value: number;
  /** Valeur max pour le calcul du %, default 100 */
  max?: number;
  /** Ton coloré de la barre */
  tone?: Tone;
  /** Label gauche */
  label: string;
  /** Texte affiché à droite (ex: "85 %" ou "1.2 Go") */
  valueLabel?: string;
  /** Hauteur de la barre (default 6) */
  barHeight?: number;
}

const TONE_COLORS: Record<Tone, string> = {
  ok:   UI.ok,
  warn: UI.warn,
  bad:  UI.bad,
  info: UI.info,
};

/**
 * Détermine automatiquement le ton selon un pourcentage.
 * Utile pour batterie (bas = mauvais) et stockage (bas = mauvais).
 */
export function pctTone(pct: number, invertScale = false): Tone {
  if (invertScale) {
    // Usage CPU/mémoire : haut = mauvais
    if (pct >= 85) return 'bad';
    if (pct >= 65) return 'warn';
    return 'ok';
  }
  // Batterie / stockage : bas = mauvais
  if (pct <= 15) return 'bad';
  if (pct <= 30) return 'warn';
  return 'ok';
}

export function GaugeBar({
  value,
  max = 100,
  tone = 'ok',
  label,
  valueLabel,
  barHeight = 6,
}: Props) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const color = TONE_COLORS[tone];

  return (
    <View style={s.container}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.valueLabel, { color }]}>
          {valueLabel ?? `${Math.round(pct)} %`}
        </Text>
      </View>
      <View style={[s.track, { height: barHeight }]}>
        <View
          style={[
            s.fill,
            {
              width: `${pct}%` as any,
              height: barHeight,
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  label: {
    fontSize: 13,
    color: UI.muted2,
  },
  valueLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});
