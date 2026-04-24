import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import type { Terminal, TerminalSummary } from '../lib/types';
import {
  formatDistanceMeters,
  getGeofenceDistance,
  getGeofenceLabel,
} from '../lib/geofenceUtils';
import { formatDateTime } from '../lib/terminalPresentation';
import { GeofenceStatusBadge } from './GeofenceStatusBadge';

export function GeofenceDetailsCard({
  terminal,
  title = 'Geofence',
}: {
  terminal: TerminalSummary | Terminal;
  title?: string;
}) {
  const distance = getGeofenceDistance(terminal);

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>
            Le centre de la geofence est base sur la derniere position connue du TPE.
          </Text>
        </View>
        <GeofenceStatusBadge terminal={terminal} />
      </View>

      <View style={s.grid}>
        <Item label="Nom de la zone" value={terminal.authorizedZoneName ?? 'Zone personnalisee'} />
        <Item label="Latitude du centre" value={terminal.baseLatitude != null ? terminal.baseLatitude.toFixed(6) : '—'} />
        <Item label="Longitude du centre" value={terminal.baseLongitude != null ? terminal.baseLongitude.toFixed(6) : '—'} />
        <Item label="Rayon" value={terminal.alertRadiusMeters != null ? `${terminal.alertRadiusMeters} m` : '—'} />
        <Item label="Statut" value={getGeofenceLabel(terminal)} />
        <Item label="Distance actuelle" value={formatDistanceMeters(distance)} />
        <Item label="Derniere position" value={formatDateTime(terminal.lastActivityAt ?? terminal.lastSeenAt)} />
        <Item label="Derniere mise a jour" value={formatDateTime(terminal.updatedAt ?? terminal.lastSeenAt)} />
      </View>
    </View>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.item}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: UI.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 16,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: UI.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  sub: {
    marginTop: 4,
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 540,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  item: {
    width: '48%',
    backgroundColor: UI.card2,
    borderRadius: 16,
    padding: 12,
  },
  label: {
    color: UI.muted2,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    marginTop: 6,
    color: UI.ink2,
    fontSize: 14,
    fontWeight: '800',
  },
});
