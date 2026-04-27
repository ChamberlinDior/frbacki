import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import { getGeofenceColors, getGeofenceDistance, getGeofenceLabel, getGeofenceStatus } from '../lib/geofenceUtils';
import { loadLeaflet } from '../lib/leafletLoader';
import type { TerminalSummary } from '../lib/types';
import {
  formatBattery,
  formatFreshness,
  formatNetwork,
  formatSignal,
  formatStorageFree,
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

// Navigue vers un point Leaflet en gérant le cas où la carte n'a pas encore
// de centre défini — flyTo lance "Set map center and zoom first" dans ce cas.
function safeNavigate(map: any, lat: number, lng: number): void {
  try {
    const zoom = map.getZoom();
    map.flyTo([lat, lng], Math.max(zoom, 16), { animate: true, duration: 0.55 });
  } catch {
    map.setView([lat, lng], 16, { animate: false });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function batteryColor(pct?: number | null): string {
  if (pct == null) return '#9AB0C4';
  if (pct <= 15) return '#D64545';
  if (pct <= 30) return '#E2A100';
  return '#1F9D61';
}

function popupHtml(terminal: TerminalSummary): string {
  const isOnline = getConnectivityStatus(terminal) === 'ONLINE';
  const statusColor = isOnline ? '#1F9D61' : '#D64545';
  const statusBg = isOnline ? '#E8F7EF' : '#FCE7E7';
  const statusLabel = isOnline ? 'En ligne' : 'Hors ligne';
  const outside = getGeofenceStatus(terminal) === 'outside';
  const geofenceColor = outside ? '#D64545' : (outside === false ? '#1F9D61' : '#9AB0C4');
  const geofenceBg = outside ? '#FCE7E7' : (outside === false ? '#E8F7EF' : '#F5F8FC');
  const geofenceLabel = getGeofenceLabel(terminal);
  const distance = getGeofenceDistance(terminal);
  const bat = terminal.lastBatteryPercent;
  const batColor = batteryColor(bat);
  const sn = terminal.serialNumber ?? terminal.deviceKey ?? '';
  const zone = terminal.authorizedZoneName ?? 'Zone personnalisee';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:220px;max-width:270px;overflow:hidden;border-radius:10px;">
      <!-- En-tete -->
      <div style="background:#12324A;padding:12px 14px;">
        <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(getTerminalName(terminal))}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);">${escapeHtml(sn)}</div>
      </div>
      <!-- Corps -->
      <div style="background:#ffffff;padding:12px 14px;">
        <!-- Badges statut -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
          <span style="background:${statusBg};color:${statusColor};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:800;">${statusLabel}</span>
          ${outside != null ? `<span style="background:${geofenceBg};color:${geofenceColor};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:800;">${escapeHtml(geofenceLabel)}</span>` : ''}
        </div>
        <!-- Donnees -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Zone</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:#12324A;">${escapeHtml(zone)}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Fraicheur</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:#12324A;">${escapeHtml(formatFreshness(terminal))}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Batterie</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:${batColor};">${escapeHtml(formatBattery(bat))}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Reseau</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:#12324A;">${escapeHtml(formatNetwork(terminal.lastNetworkType))}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Signal</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:#12324A;">${escapeHtml(formatSignal(terminal.lastSignalLevel))}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Stockage</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:#12324A;">${escapeHtml(formatStorageFree(terminal.lastStorageFreeMb, terminal.lastStorageTotalMb))}</td>
          </tr>
          ${distance != null ? `
          <tr>
            <td style="padding:3px 0;color:#72879A;font-weight:600;">Distance</td>
            <td style="padding:3px 0;font-weight:700;text-align:right;color:${outside ? '#D64545' : '#1F9D61'};">${distance} m</td>
          </tr>` : ''}
        </table>
      </div>
    </div>
  `;
}

function createTerminalIcon(L: any, color: string, isOutsideZone: boolean, isOnline: boolean): any {
  const ringColor = isOutsideZone ? '#D64545' : (isOnline ? '#ffffff' : '#ffffff');
  const ringWidth = isOutsideZone ? '4' : '3';
  const glowColor = isOutsideZone
    ? 'rgba(214,69,69,0.35)'
    : isOnline
      ? 'rgba(31,111,229,0.25)'
      : 'rgba(0,0,0,0.12)';
  const size = isOutsideZone ? 32 : 26;
  const half = size / 2;

  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:${ringWidth}px solid ${ringColor};
      border-radius:50%;
      box-shadow:0 2px 10px rgba(0,0,0,0.28),0 0 0 ${isOutsideZone ? '5' : '4'}px ${glowColor};
    "></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -(half + 8)],
  });
}

function fitRegion(terminals: TerminalSummary[]) {
  const valid = terminals.filter(terminalHasPosition);
  if (valid.length === 0) return null;

  const lats = valid.map((t) => t.lastGpsLat as number);
  const lngs = valid.map((t) => t.lastGpsLng as number);

  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    zoom: valid.length === 1 ? 16 : 13,
  };
}

export function TerminalMap({
  terminals,
  selectedTerminalId,
  onSelectTerminal,
  height = 360,
}: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markerLayersRef = useRef<any[]>([]);
  const circleLayersRef = useRef<any[]>([]);
  const initializedRef = useRef(false);
  const lastFocusedIdRef = useRef<number | null>(null);
  const onSelectTerminalRef = useRef(onSelectTerminal);
  const positioned = useMemo(() => terminals.filter(terminalHasPosition), [terminals]);
  const mapHeight = useMemo(() => Math.max(280, height), [height]);
  const mapStats = useMemo(() => {
    const online = positioned.filter((terminal) => getConnectivityStatus(terminal) === 'ONLINE').length;
    const outside = positioned.filter((terminal) => getGeofenceStatus(terminal) === 'outside').length;
    const withGeofence = positioned.filter((terminal) => terminalHasGeofence(terminal)).length;
    return { online, outside, withGeofence };
  }, [positioned]);

  useEffect(() => {
    onSelectTerminalRef.current = onSelectTerminal;
  }, [onSelectTerminal]);

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
      if (positioned.length === 0 || mapRef.current || !containerRef.current) return;

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

      // CartoDB Positron — carte propre et professionnelle
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        detectRetina: true,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      mapRef.current = map;
      redraw();
    }

    initIfNeeded().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [positioned.length]);

  function clearLayers() {
    const map = mapRef.current;
    if (!map) return;
    markerLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch { /* noop */ } });
    circleLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch { /* noop */ } });
    markerLayersRef.current = [];
    circleLayersRef.current = [];
  }

  function redraw() {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    clearLayers();

    positioned.forEach((terminal) => {
      const lat = terminal.lastGpsLat as number;
      const lng = terminal.lastGpsLng as number;
      const colors = getGeofenceColors(terminal);
      const isOnline = getConnectivityStatus(terminal) === 'ONLINE';
      const isOutsideZone = getGeofenceStatus(terminal) === 'outside';

      const markerColor = isOutsideZone
        ? colors.marker
        : isOnline
          ? UI.info
          : '#8896A8';

      const icon = createTerminalIcon(L, markerColor, isOutsideZone, isOnline);

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(popupHtml(terminal), {
          maxWidth: 280,
          className: 'tpe-popup',
        });

      marker.on('click', () => {
        onSelectTerminalRef.current?.(terminal);
        safeNavigate(map, lat, lng);
        lastFocusedIdRef.current = terminal.id;
      });

      markerLayersRef.current.push(marker);

      if (terminalHasGeofence(terminal)) {
        const circle = L.circle(
          [terminal.baseLatitude as number, terminal.baseLongitude as number],
          {
            radius: terminal.alertRadiusMeters as number,
            color: colors.stroke,
            weight: 1.5,
            fillColor: colors.fill,
            fillOpacity: isOutsideZone ? 0.14 : 0.08,
            dashArray: isOutsideZone ? null : '4 4',
          },
        ).addTo(map);
        circleLayersRef.current.push(circle);
      }
    });

    if (selectedTerminalId != null) {
      const selected = positioned.find((t) => t.id === selectedTerminalId);
      if (selected && lastFocusedIdRef.current !== selectedTerminalId) {
        const lat = selected.lastGpsLat as number;
        const lng = selected.lastGpsLng as number;
        if (!initializedRef.current) {
          // Carte non encore initialisée — setView évite le crash _checkIfLoaded
          map.setView([lat, lng], 16, { animate: false });
        } else {
          safeNavigate(map, lat, lng);
        }
        lastFocusedIdRef.current = selectedTerminalId;
      }
      initializedRef.current = true;
      return;
    }

    if (!initializedRef.current && positioned.length > 0) {
      const region = fitRegion(positioned);
      if (region) {
        map.setView([region.latitude, region.longitude], region.zoom, { animate: false });
      }
      initializedRef.current = true;
    } else if (positioned.length === 0) {
      map.setView([0.3901, 9.4544], 11, { animate: false });
    }
  }

  useEffect(() => {
    if (!mapRef.current) return;
    redraw();
  }, [positioned, selectedTerminalId]);

  useEffect(() => {
    if (selectedTerminalId == null) {
      lastFocusedIdRef.current = null;
    }
  }, [selectedTerminalId]);

  useEffect(() => {
    if (positioned.length > 0 || !mapRef.current) return;
    mapRef.current.remove();
    mapRef.current = null;
    markerLayersRef.current = [];
    circleLayersRef.current = [];
    initializedRef.current = false;
    lastFocusedIdRef.current = null;
  }, [positioned.length]);

  return (
    <View style={s.outer}>
      <View style={s.topBar}>
        <View>
          <Text style={s.topEyebrow}>Cartographie temps reel</Text>
          <Text style={s.topTitle}>Suivi geospatial des terminaux</Text>
        </View>

        <View style={s.kpiRow}>
          <MapPill label={`${positioned.length} visibles`} tone="info" />
          <MapPill label={`${mapStats.online} en ligne`} tone="ok" />
          <MapPill label={`${mapStats.outside} hors zone`} tone={mapStats.outside > 0 ? 'bad' : 'ok'} />
          <MapPill label={`${mapStats.withGeofence} zones`} tone="info" />
        </View>
      </View>

      {positioned.length === 0 ? (
        <View style={[s.empty, { height: mapHeight }]}>
          <View style={s.emptyIconWrap}>
            <Text style={s.emptyIconText}>—</Text>
          </View>
          <Text style={s.emptyTitle}>Aucune coordonnee exploitable</Text>
          <Text style={s.emptyText}>
            La carte s&apos;affichera automatiquement des qu&apos;au moins un TPE remontera une
            position GPS valide.
          </Text>
        </View>
      ) : (
        <View style={s.mapWrap}>
          <View
            ref={containerRef as any}
            style={[s.map as any, { height: mapHeight }]}
          />

          <View pointerEvents="none" style={s.legend}>
            <LegendDot color={UI.info} label="Terminal en ligne" />
            <LegendDot color="#8896A8" label="Terminal hors ligne" />
            <LegendDot color={UI.bad} label="Hors zone autorisee" />
          </View>
        </View>
      )}
    </View>
  );
}

function MapPill({
  label,
  tone,
}: {
  label: string;
  tone: 'ok' | 'bad' | 'info';
}) {
  const palette = {
    ok: { bg: 'rgba(31,157,97,0.12)', fg: UI.ok },
    bad: { bg: 'rgba(214,69,69,0.12)', fg: UI.bad },
    info: { bg: 'rgba(31,111,229,0.12)', fg: UI.info },
  }[tone];

  return (
    <View style={[s.mapPill, { backgroundColor: palette.bg }]}>
      <Text style={[s.mapPillText, { color: palette.fg }]}>{label}</Text>
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
  outer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(215,227,242,0.85)',
    backgroundColor: 'rgba(248,251,255,0.92)',
    gap: 12,
  },
  topEyebrow: {
    color: UI.info,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  topTitle: {
    marginTop: 4,
    color: UI.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mapPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  mapWrap: {
    position: 'relative',
  },
  map: {
    width: '100%',
  },
  legend: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(215,227,242,0.92)',
    shadowColor: '#12324A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
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
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: UI.card2,
    gap: 10,
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
  },
  emptyText: {
    color: UI.muted,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 13,
    maxWidth: 340,
  },
});
