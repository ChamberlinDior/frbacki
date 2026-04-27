import React, { useEffect, useMemo, useRef } from 'react';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import { getGeofenceColors, getGeofenceStatus } from '../lib/geofenceUtils';
import type { TerminalSummary } from '../lib/types';
import {
  getConnectivityStatus,
  getTerminalName,
  terminalHasGeofence,
  terminalHasPosition,
} from '../lib/terminalPresentation';

type Props = {
  terminals: TerminalSummary[];
  selectedTerminalId?: number | null;
  onSelectTerminal?: (terminal: TerminalSummary) => void;
  height?: number;
};

function calcRegion(terminals: TerminalSummary[]) {
  const positioned = terminals.filter(terminalHasPosition);
  if (positioned.length === 0) {
    return {
      latitude: 0.3901,
      longitude: 9.4544,
      latitudeDelta: 0.25,
      longitudeDelta: 0.25,
    };
  }

  const lats = positioned.map((t) => t.lastGpsLat as number);
  const lngs = positioned.map((t) => t.lastGpsLng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.8),
  };
}

function markerColor(terminal: TerminalSummary): string {
  if (getGeofenceStatus(terminal) === 'outside') return UI.bad;
  if (getConnectivityStatus(terminal) === 'OFFLINE') return UI.bad;
  return UI.info;
}

export function TerminalMap({
  terminals,
  selectedTerminalId,
  onSelectTerminal,
  height = 320,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const initialFocusDoneRef = useRef(false);
  const selectedFocusRef = useRef<number | null>(null);
  const positioned = useMemo(() => terminals.filter(terminalHasPosition), [terminals]);
  const region = useMemo(() => calcRegion(terminals), [terminals]);
  const stats = useMemo(() => {
    const online = positioned.filter((terminal) => getConnectivityStatus(terminal) === 'ONLINE').length;
    const outside = positioned.filter((terminal) => getGeofenceStatus(terminal) === 'outside').length;
    return { online, outside };
  }, [positioned]);

  useEffect(() => {
    if (!mapRef.current || positioned.length === 0) return;

    if (selectedTerminalId != null) {
      if (selectedFocusRef.current === selectedTerminalId) return;
      const selected = positioned.find((terminal) => terminal.id === selectedTerminalId);
      if (!selected) return;

      mapRef.current.animateToRegion(
        {
          latitude: selected.lastGpsLat as number,
          longitude: selected.lastGpsLng as number,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        380,
      );
      selectedFocusRef.current = selectedTerminalId;
      return;
    }

    if (!initialFocusDoneRef.current) {
      mapRef.current.animateToRegion(region, 380);
      initialFocusDoneRef.current = true;
    }
  }, [positioned, region, selectedTerminalId]);

  useEffect(() => {
    if (selectedTerminalId == null) {
      selectedFocusRef.current = null;
    }
  }, [selectedTerminalId]);

  return (
    <View style={[s.wrap, { height }]}>
      <View style={s.topBar}>
        <View>
          <Text style={s.eyebrow}>Surveillance GPS</Text>
          <Text style={s.title}>Carte tactique des terminaux</Text>
        </View>
        <View style={s.pills}>
          <Pill label={`${positioned.length} visibles`} tone="info" />
          <Pill label={`${stats.online} en ligne`} tone="ok" />
          <Pill label={`${stats.outside} hors zone`} tone={stats.outside > 0 ? 'bad' : 'ok'} />
        </View>
      </View>

      {positioned.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Aucune coordonnee disponible</Text>
          <Text style={s.emptyText}>
            La carte s&apos;affichera des qu&apos;un terminal remontera une position GPS exploitable.
          </Text>
        </View>
      ) : (
        <View style={s.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            onPanDrag={() => {
              initialFocusDoneRef.current = true;
            }}
            onRegionChangeComplete={() => {
              initialFocusDoneRef.current = true;
            }}
            showsCompass
            showsTraffic={false}
            toolbarEnabled={false}
          >
            {positioned.map((terminal) => (
              <React.Fragment key={terminal.id}>
                <Marker
                  coordinate={{
                    latitude: terminal.lastGpsLat as number,
                    longitude: terminal.lastGpsLng as number,
                  }}
                  title={getTerminalName(terminal)}
                  description={terminal.lastAddressLine ?? terminal.city ?? 'Terminal'}
                  pinColor={markerColor(terminal)}
                  opacity={selectedTerminalId && selectedTerminalId !== terminal.id ? 0.7 : 1}
                  onPress={() => onSelectTerminal?.(terminal)}
                />
                {terminalHasGeofence(terminal) ? (
                  <Circle
                    center={{
                      latitude: terminal.baseLatitude as number,
                      longitude: terminal.baseLongitude as number,
                    }}
                    radius={terminal.alertRadiusMeters as number}
                    strokeWidth={2}
                    strokeColor={getGeofenceColors(terminal).stroke}
                    fillColor={getGeofenceColors(terminal).fill}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </MapView>

          <View pointerEvents="none" style={s.legend}>
            <LegendDot color={UI.info} label="Actif" />
            <LegendDot color={UI.bad} label="Alerte / hors ligne" />
            <LegendDot color={UI.ok} label="Zone conforme" />
          </View>
        </View>
      )}
    </View>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'ok' | 'bad' | 'info';
}) {
  const palette = {
    ok: { bg: 'rgba(22,137,91,0.12)', fg: UI.ok },
    bad: { bg: 'rgba(201,68,68,0.12)', fg: UI.bad },
    info: { bg: 'rgba(22,95,205,0.12)', fg: UI.info },
  }[tone];

  return (
    <View style={[s.pill, { backgroundColor: palette.bg }]}>
      <Text style={[s.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI.stroke2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 10,
  },
  eyebrow: {
    color: UI.info,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    color: UI.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: UI.card2,
  },
  emptyTitle: {
    color: UI.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 8,
    color: UI.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: UI.stroke,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: UI.ink2,
    fontSize: 11,
    fontWeight: '700',
  },
});
