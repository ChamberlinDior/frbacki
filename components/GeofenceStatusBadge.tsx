import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import type { Terminal, TerminalSummary } from '../lib/types';
import { getGeofenceLabel, getGeofenceTone } from '../lib/geofenceUtils';

export function GeofenceStatusBadge({
  terminal,
  compact,
}: {
  terminal: TerminalSummary | Terminal;
  compact?: boolean;
}) {
  const tone = getGeofenceTone(terminal);
  const label = getGeofenceLabel(terminal);
  const color = tone === 'bad' ? UI.bad : tone === 'ok' ? UI.ok : UI.info;
  const backgroundColor = tone === 'bad' ? UI.badBg : tone === 'ok' ? UI.okBg : UI.infoBg;
  const icon = tone === 'bad' ? 'alert-circle-outline' : tone === 'ok' ? 'checkmark-circle-outline' : 'help-circle-outline';

  return (
    <View style={[s.badge, compact && s.badgeCompact, { backgroundColor }]}>
      <Ionicons name={icon} size={compact ? 12 : 14} color={color} />
      <Text style={[s.text, compact && s.textCompact, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '900',
  },
  textCompact: {
    fontSize: 11,
  },
});
