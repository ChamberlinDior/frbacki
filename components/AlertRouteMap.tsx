import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { UI } from '../constants/theme';
import {
  fetchRoadRoute,
  formatDistanceKm,
  formatDurationMinutes,
  getRouteKey,
  type RoadRoute,
} from '../lib/roadRoute';

type Point = { latitude: number; longitude: number };

export function AlertRouteMap({
  adminLocation,
  targetLocation,
  targetLabel,
}: {
  adminLocation: Point | null;
  targetLocation: Point | null;
  targetLabel: string;
}) {
  const mapRef = useRef<MapView | null>(null);
  const hasAutoFramedRef = useRef(false);
  const lastTargetKeyRef = useRef<string | null>(null);
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [loading, setLoading] = useState(false);

  const targetKey = useMemo(() => getRouteKey(targetLocation), [targetLocation]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      if (!adminLocation || !targetLocation) {
        setRoute(null);
        return;
      }

      setLoading(true);
      const result = await fetchRoadRoute(adminLocation, targetLocation);
      if (!cancelled) {
        setRoute(result);
        setLoading(false);
      }
    }

    void loadRoute();
    return () => {
      cancelled = true;
    };
  }, [adminLocation, targetLocation]);

  useEffect(() => {
    if (!mapRef.current || !route || route.coordinates.length === 0) return;

    const targetChanged = lastTargetKeyRef.current !== targetKey;
    if (!hasAutoFramedRef.current || targetChanged) {
      mapRef.current.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
        animated: true,
      });
      hasAutoFramedRef.current = true;
      lastTargetKeyRef.current = targetKey;
    }
  }, [route, targetKey]);

  function recenter() {
    if (!mapRef.current || !route || route.coordinates.length === 0) return;
    mapRef.current.fitToCoordinates(route.coordinates, {
      edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
      animated: true,
    });
  }

  if (!adminLocation || !targetLocation) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>Itineraire indisponible</Text>
        <Text style={s.emptyText}>La position admin ou celle du TPE est absente.</Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.topBar}>
        <View style={s.metricCard}>
          <Text style={s.metricLabel}>Distance route</Text>
          <Text style={s.metricValue}>{formatDistanceKm(route?.distanceMeters)}</Text>
        </View>
        <View style={s.metricCard}>
          <Text style={s.metricLabel}>ETA route</Text>
          <Text style={s.metricValue}>{formatDurationMinutes(route?.durationSeconds)}</Text>
        </View>
        <View style={s.metricCard}>
          <Text style={s.metricLabel}>Mode</Text>
          <Text style={s.metricValueSmall}>
            {route?.source === 'google' ? 'Route calculee' : 'Estimation secours'}
          </Text>
        </View>
      </View>

      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: adminLocation.latitude,
            longitude: adminLocation.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          showsCompass
          toolbarEnabled={false}
          moveOnMarkerPress={false}
        >
          <Marker coordinate={adminLocation} title="Admin" pinColor={UI.info} />
          <Marker coordinate={targetLocation} title={targetLabel} pinColor={UI.bad} />
          {route && route.coordinates.length > 1 ? (
            <Polyline
              coordinates={route.coordinates}
              strokeColor="#7dd3fc"
              strokeWidth={5}
              lineDashPattern={route.source === 'google' ? undefined : [8, 8]}
            />
          ) : null}
        </MapView>

        <Pressable style={s.recenterBtn} onPress={recenter}>
          <Text style={s.recenterBtnText}>Recentrer</Text>
        </Pressable>

        {loading ? (
          <View style={s.loadingPill}>
            <ActivityIndicator color={UI.info} size="small" />
            <Text style={s.loadingText}>Calcul de l'itineraire...</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 360,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card,
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(7,16,31,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.14)',
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  metricLabel: {
    color: '#8aa3bb',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  metricValue: {
    color: '#f8fbff',
    fontSize: 18,
    fontWeight: '800',
  },
  metricValueSmall: {
    color: '#f8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  mapWrap: {
    flex: 1,
  },
  recenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(7,16,31,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  recenterBtnText: {
    color: '#e8f3ff',
    fontWeight: '900',
    fontSize: 12,
  },
  loadingPill: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: UI.stroke,
  },
  loadingText: {
    color: UI.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  empty: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
  },
});
