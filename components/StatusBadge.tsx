import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UI } from '../constants/theme';

type BadgeVariant = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

interface Props {
  label: string;
  variant?: BadgeVariant;
  /** Taille du texte (default 11) */
  size?: number;
}

const COLORS: Record<BadgeVariant, { text: string; bg: string }> = {
  ok:    { text: UI.ok,   bg: UI.okBg   },
  warn:  { text: UI.warn, bg: UI.warnBg },
  bad:   { text: UI.bad,  bg: UI.badBg  },
  info:  { text: UI.info, bg: UI.infoBg },
  muted: { text: UI.muted, bg: 'rgba(243,246,255,0.08)' },
};

export function StatusBadge({ label, variant = 'muted', size = 11 }: Props) {
  const { text, bg } = COLORS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text, fontSize: size }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
