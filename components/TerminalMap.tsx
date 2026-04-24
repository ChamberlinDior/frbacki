import React, { useEffect, useMemo, useRef } from 'react';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import { getGeofenceColors } from '../lib/geofenceUtils';
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
  if (terminal.outsideAuthorizedZone) return UI.bad;
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
      {positioned.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Aucune coordonnee disponible</Text>
          <Text style={s.emptyText}>
            La carte s&apos;affichera des qu&apos;un terminal remontera une position GPS exploitable.
          </Text>
        </View>
      ) : (
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
      )}
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
});
