import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import { loadLeaflet } from '../lib/leafletLoader';

type RouteInfo = {
  distanceM: number;
  durationS: number;
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createAdminIcon(L: any): any {
  return L.divIcon({
    html: `<div style="
      width:38px;height:38px;
      background:#1F6FE5;
      border:3px solid #ffffff;
      border-radius:50%;
      box-shadow:0 3px 14px rgba(31,111,229,0.55),0 0 0 4px rgba(31,111,229,0.18);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="width:12px;height:12px;background:#ffffff;border-radius:50%;"></div>
    </div>`,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -24],
  });
}

function createTargetIcon(L: any): any {
  return L.divIcon({
    html: `<div style="position:relative;width:38px;height:52px;display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:38px;height:38px;
        background:#D64545;
        border:3px solid #ffffff;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 14px rgba(214,69,69,0.55),0 0 0 4px rgba(214,69,69,0.18);
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
      ">
        <div style="
          width:12px;height:12px;
          background:#ffffff;
          border-radius:50%;
          transform:rotate(45deg);
        "></div>
      </div>
    </div>`,
    className: '',
    iconSize: [38, 52],
    iconAnchor: [19, 52],
    popupAnchor: [0, -56],
  });
}

export function AlertRouteMap({
  adminLocation,
  targetLocation,
  targetLabel,
}: {
  adminLocation: { latitude: number; longitude: number } | null;
  targetLocation: { latitude: number; longitude: number } | null;
  targetLabel: string;
}) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);
  const routeHaloRef = useRef<any>(null);
  const routeRequestSeqRef = useRef(0);
  const userInteractedRef = useRef(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

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

    async function initIfNeeded() {
      if (!adminLocation || !targetLocation || mapRef.current || !containerRef.current) return;

      await loadLeaflet();
      if (cancelled || mapRef.current || !containerRef.current) return;

      const L = window.L;
      if (!L) return;

      const map = L.map(containerRef.current as any, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        preferCanvas: false,
      });

      // CartoDB Positron — propre, professionnel, lisible
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        detectRetina: true,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      map.on('dragstart zoomstart movestart', () => {
        userInteractedRef.current = true;
      });

      mapRef.current = map;
      redraw();
    }

    initIfNeeded().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [adminLocation, targetLocation]);

  useEffect(() => {
    if (adminLocation && targetLocation) return;
    if (!mapRef.current) return;

    mapRef.current.remove();
    mapRef.current = null;
    layersRef.current = [];
    routeLayerRef.current = null;
    routeHaloRef.current = null;
    routeRequestSeqRef.current += 1;
    userInteractedRef.current = false;
    setRouteInfo(null);
  }, [adminLocation, targetLocation]);

  useEffect(() => {
    if (!mapRef.current) return;
    redraw();
  }, [adminLocation, targetLocation, targetLabel]);

  function clearLayers() {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((layer) => {
      try { map.removeLayer(layer); } catch { /* noop */ }
    });
    layersRef.current = [];
    routeLayerRef.current = null;
    routeHaloRef.current = null;
  }

  function redraw() {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !adminLocation || !targetLocation) return;

    clearLayers();

    const adminPoint: [number, number] = [adminLocation.latitude, adminLocation.longitude];
    const targetPoint: [number, number] = [targetLocation.latitude, targetLocation.longitude];

    const adminMarker = L.marker(adminPoint, { icon: createAdminIcon(L) })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:160px;">
          <div style="font-weight:800;font-size:13px;color:#1F6FE5;margin-bottom:4px;">Position admin</div>
          <div style="font-size:12px;color:#58748D;line-height:1.6;">
            Lat: ${adminPoint[0].toFixed(5)}<br/>Lng: ${adminPoint[1].toFixed(5)}
          </div>
        </div>
      `);

    const targetMarker = L.marker(targetPoint, { icon: createTargetIcon(L) })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:180px;">
          <div style="font-weight:800;font-size:13px;color:#D64545;margin-bottom:4px;">${escapeHtml(targetLabel)}</div>
          <div style="font-size:12px;color:#58748D;line-height:1.6;">
            Lat: ${targetPoint[0].toFixed(5)}<br/>Lng: ${targetPoint[1].toFixed(5)}
          </div>
        </div>
      `);

    targetMarker.openPopup();

    layersRef.current.push(adminMarker, targetMarker);
    setFallbackRoute(L, [adminPoint, targetPoint]);

    if (!userInteractedRef.current) {
      map.fitBounds([adminPoint, targetPoint], { padding: [64, 64], maxZoom: 16 });
    }

    void loadDrivingRoute(adminPoint, targetPoint, L);
  }

  async function loadDrivingRoute(
    adminPoint: [number, number],
    targetPoint: [number, number],
    L: any,
  ) {
    const map = mapRef.current;
    if (!map || !L) return;

    const seq = ++routeRequestSeqRef.current;
    setRouteLoading(true);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${adminPoint[1]},${adminPoint[0]};${targetPoint[1]},${targetPoint[0]}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('route fetch failed');
      const payload = await response.json();
      const route = payload?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;

      if (!Array.isArray(coordinates) || coordinates.length === 0 || seq !== routeRequestSeqRef.current) {
        return;
      }

      if (route?.distance != null && route?.duration != null) {
        setRouteInfo({ distanceM: route.distance, durationS: route.duration });
      }

      setRouteLayer(
        L,
        coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
      );
    } catch {
      if (seq === routeRequestSeqRef.current) {
        setFallbackRoute(L, [adminPoint, targetPoint]);
      }
    } finally {
      if (seq === routeRequestSeqRef.current) {
        setRouteLoading(false);
      }
    }
  }

  function setFallbackRoute(L: any, coordinates: [number, number][]) {
    const map = mapRef.current;
    if (!map) return;
    clearRouteLayer();

    const halo = L.polyline(coordinates, {
      color: '#1F6FE5',
      weight: 14,
      opacity: 0.12,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const line = L.polyline(coordinates, {
      color: '#1F6FE5',
      weight: 4,
      opacity: 0.7,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '8 6',
    }).addTo(map);

    routeHaloRef.current = halo;
    routeLayerRef.current = line;
    layersRef.current.push(halo, line);
  }

  function setRouteLayer(L: any, coordinates: [number, number][]) {
    const map = mapRef.current;
    if (!map) return;
    clearRouteLayer();

    const halo = L.polyline(coordinates, {
      color: '#1F6FE5',
      weight: 16,
      opacity: 0.14,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const line = L.polyline(coordinates, {
      color: '#1F6FE5',
      weight: 5,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    routeHaloRef.current = halo;
    routeLayerRef.current = line;
    layersRef.current.push(halo, line);
  }

  function clearRouteLayer() {
    const map = mapRef.current;
    if (!map) return;
    if (routeHaloRef.current) {
      try { map.removeLayer(routeHaloRef.current); } catch { /* noop */ }
      layersRef.current = layersRef.current.filter((l) => l !== routeHaloRef.current);
      routeHaloRef.current = null;
    }
    if (routeLayerRef.current) {
      try { map.removeLayer(routeLayerRef.current); } catch { /* noop */ }
      layersRef.current = layersRef.current.filter((l) => l !== routeLayerRef.current);
      routeLayerRef.current = null;
    }
  }

  if (!adminLocation || !targetLocation) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIconWrap}>
          <Text style={s.emptyIconText}>—</Text>
        </View>
        <Text style={s.emptyTitle}>Itineraire indisponible</Text>
        <Text style={s.emptyText}>
          {!adminLocation
            ? 'Position admin non disponible (GPS requis).'
            : 'Coordonnees GPS du TPE absentes.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View ref={containerRef as any} style={s.map as any} />

      {/* Panneau route — distance + duree */}
      {(routeInfo || routeLoading) && (
        <View style={s.routeInfo}>
          {routeLoading && !routeInfo ? (
            <Text style={s.routeLoading}>Calcul de l'itineraire...</Text>
          ) : routeInfo ? (
            <>
              <View style={s.routeInfoItem}>
                <View style={[s.routeInfoDot, { backgroundColor: UI.info }]} />
                <View>
                  <Text style={s.routeInfoLabel}>Distance</Text>
                  <Text style={s.routeInfoValue}>{formatDistance(routeInfo.distanceM)}</Text>
                </View>
              </View>
              <View style={s.routeInfoSep} />
              <View style={s.routeInfoItem}>
                <View style={[s.routeInfoDot, { backgroundColor: UI.warn }]} />
                <View>
                  <Text style={s.routeInfoLabel}>Duree estimee</Text>
                  <Text style={s.routeInfoValue}>{formatDuration(routeInfo.durationS)}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: UI.card,
  },
  map: {
    width: '100%',
    height: 440,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: UI.stroke,
    backgroundColor: UI.card2,
  },
  routeInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  routeInfoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  routeInfoLabel: {
    color: UI.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  routeInfoValue: {
    color: UI.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  routeInfoSep: {
    width: 1,
    height: 36,
    backgroundColor: UI.stroke,
  },
  routeLoading: {
    flex: 1,
    textAlign: 'center',
    color: UI.muted,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 12,
  },
  empty: {
    width: '100%',
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.card2,
    padding: 24,
    gap: 8,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: UI.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    color: UI.muted,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyTitle: {
    color: UI.ink,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyText: {
    color: UI.muted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
    maxWidth: 280,
  },
});
