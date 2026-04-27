import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { UI } from '../constants/theme';
import { loadLeaflet } from '../lib/leafletLoader';
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
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any[]>([]);
  const autoFitDoneRef = useRef(false);
  const lastTargetKeyRef = useRef<string | null>(null);
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [loading, setLoading] = useState(false);

  const targetKey = useMemo(() => getRouteKey(targetLocation), [targetLocation]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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

  function fitRoute(force = false) {
    if (!mapRef.current || !route || route.coordinates.length === 0) return;
    const targetChanged = lastTargetKeyRef.current !== targetKey;
    if (!force && autoFitDoneRef.current && !targetChanged) return;

    const bounds = window.L.latLngBounds(
      route.coordinates.map((point) => [point.latitude, point.longitude]),
    );
    mapRef.current.fitBounds(bounds.pad(0.2));
    autoFitDoneRef.current = true;
    lastTargetKeyRef.current = targetKey;
  }

  useEffect(() => {
    let cancelled = false;

    async function renderMap() {
      if (!containerRef.current || !adminLocation || !targetLocation) return;

      await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      const L = window.L;
      if (!L) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current as any, {
          zoomControl: true,
          scrollWheelZoom: true,
          dragging: true,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
          detectRetina: true,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(mapRef.current);
      }

      if (!route) return;

      layerRef.current.forEach((layer) => {
        try {
          mapRef.current.removeLayer(layer);
        } catch {}
      });
      layerRef.current = [];

      const adminMarker = L.circleMarker([adminLocation.latitude, adminLocation.longitude], {
        radius: 10,
        color: '#9ad7ff',
        weight: 3,
        fillColor: '#38bdf8',
        fillOpacity: 1,
      })
        .addTo(mapRef.current)
        .bindPopup('Position operateur');

      const targetMarker = L.circleMarker([targetLocation.latitude, targetLocation.longitude], {
        radius: 12,
        color: '#ffd4d4',
        weight: 3,
        fillColor: UI.bad,
        fillOpacity: 1,
      })
        .addTo(mapRef.current)
        .bindPopup(targetLabel);

      const routeLine = L.polyline(
        route.coordinates.map((point) => [point.latitude, point.longitude]),
        {
          color: '#7dd3fc',
          weight: 4,
          opacity: 0.92,
          dashArray: route.source === 'google' ? undefined : '10 10',
        },
      ).addTo(mapRef.current);

      layerRef.current = [adminMarker, targetMarker, routeLine];
      fitRoute(false);
    }

    void renderMap();
    return () => {
      cancelled = true;
    };
  }, [adminLocation, targetLocation, targetLabel, route, targetKey]);

  if (!adminLocation || !targetLocation) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>Suivi indisponible</Text>
        <Text style={s.emptyText}>
          La position operateur ou la position exacte du TPE manque encore.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.mapStats}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Distance route</Text>
          <Text style={s.statValue}>{formatDistanceKm(route?.distanceMeters)}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>ETA route</Text>
          <Text style={s.statValue}>{formatDurationMinutes(route?.durationSeconds)}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Mode</Text>
          <Text style={s.statValueSmall}>
            {route?.source === 'google' ? 'Route calculee' : 'Estimation secours'}
          </Text>
        </View>
      </View>

      <View style={s.mapWrap}>
        <View ref={containerRef as any} style={s.map as any} />

        <Pressable style={s.recenterBtn} onPress={() => fitRoute(true)}>
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
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(5,10,20,0.9)',
  },
  mapStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(7,16,31,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.14)',
  },
  statCard: {
    flexGrow: 1,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  statLabel: {
    color: '#8aa3bb',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    color: '#f8fbff',
    fontSize: 20,
    fontWeight: '800',
  },
  statValueSmall: {
    color: '#f8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  mapWrap: {
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 360,
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
    minHeight: 260,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(10,18,34,0.72)',
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
    lineHeight: 20,
  },
});
