import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, telemetryApi, terminalsApi } from '../../lib/api';
import type { TelemetrySnapshot, Terminal } from '../../lib/types';
import { UI, toneBg, toneColor } from '../../constants/theme';
import {
  formatBattery,
  formatDateTime,
  formatNetwork,
  formatSignal,
  formatStorageFree,
  getTerminalName,
} from '../../lib/terminalPresentation';
import { MapEmbed } from '../../components/MapEmbed';
import { NetworkErrorBanner } from '../../components/NetworkErrorBanner';
import { GeofenceDetailsCard } from '../../components/GeofenceDetailsCard';
import { GeofenceStatusBadge } from '../../components/GeofenceStatusBadge';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAlerts } from '../../contexts/AlertContext';

export default function TelemetryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [snap, setSnap] = useState<TelemetrySnapshot | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { alerts: liveMovementAlerts } = useAlerts();

  const load = useCallback(async () => {
    const snapshot = await telemetryApi.getById(Number(id));
    setSnap(snapshot);
    const currentTerminal = await terminalsApi.getById(snapshot.terminalId);
    setTerminal(currentTerminal);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useLiveRefresh(load, 1500);

  useEffect(() => {
    void load();
  }, [liveMovementAlerts, load]);

  const locationLabel = useMemo(() => {
    if (!snap) return '—';
    return snap.addressLine ?? snap.city ?? snap.country ?? 'Position indisponible';
  }, [snap]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={UI.info} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!snap || !terminal) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <NetworkErrorBanner message={error ?? 'Snapshot introuvable.'} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {error ? <NetworkErrorBanner message={error} /> : null}

        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={17} color={UI.info} />
          <Text style={s.backBtnText}>Retour</Text>
        </Pressable>

        <LinearGradient colors={['rgba(255,255,255,0.94)', 'rgba(232,240,250,0.88)']} style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Snapshot detaille</Text>
            <Text style={s.title}>{getTerminalName(terminal)}</Text>
            <Text style={s.subtitle}>Snapshot du {formatDateTime(snap.capturedAt)}</Text>
            <Text style={s.subtitle}>Terminal #{snap.terminalId}</Text>
          </View>
          <GeofenceStatusBadge terminal={terminal} />
        </LinearGradient>

        <View style={s.kpiRow}>
          <MetricCard label="Batterie" value={formatBattery(snap.batteryPercent)} tone="info" />
          <MetricCard label="Reseau" value={formatNetwork(snap.networkType)} tone="info" />
          <MetricCard label="Signal" value={formatSignal(snap.signalLevel)} tone="info" />
          <MetricCard label="Zone" value={terminal.authorizedZoneName ?? 'Zone personnalisee'} tone="ok" />
        </View>

        {snap.gpsLat != null && snap.gpsLng != null ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Carte de position et perimetre</Text>
            <MapEmbed
              terminalId={terminal.id}
              lat={snap.gpsLat}
              lng={snap.gpsLng}
              label={getTerminalName(terminal)}
              zoneName={terminal.authorizedZoneName ?? undefined}
              baseLatitude={terminal.baseLatitude}
              baseLongitude={terminal.baseLongitude}
              alertRadiusMeters={terminal.alertRadiusMeters}
              outsideAuthorizedZone={terminal.outsideAuthorizedZone}
              height={280}
            />
          </View>
        ) : null}

        <GeofenceDetailsCard terminal={terminal} title="Geofence de surveillance" />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Etat telemetrie</Text>
          <Row label="Localisation" value={locationLabel} />
          <Row label="Batterie" value={formatBattery(snap.batteryPercent)} />
          <Row label="Reseau" value={formatNetwork(snap.networkType)} />
          <Row label="Signal" value={formatSignal(snap.signalLevel)} />
          <Row label="Stockage" value={formatStorageFree(snap.storageFreeMb, snap.storageTotalMb)} />
          <Row label="Precision GPS" value={snap.gpsAccuracy != null ? `${Math.round(snap.gpsAccuracy)} m` : '—'} />
          <Row label="Derniere position" value={formatDateTime(snap.capturedAt)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}) {
  return (
    <View style={[s.metricCard, { backgroundColor: toneBg(tone) }]}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color: toneColor(tone) }]}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    gap: 16,
    paddingBottom: 36,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: UI.infoBg,
    borderWidth: 1,
    borderColor: UI.stroke,
  },
  backBtnText: {
    color: UI.info,
    fontSize: 13,
    fontWeight: '900',
  },
  hero: {
    backgroundColor: UI.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: 18,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    shadowColor: '#0F2940',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 8,
  },
  eyebrow: {
    color: UI.info,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: UI.ink,
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: UI.muted,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 18,
    padding: 14,
  },
  metricLabel: {
    color: UI.muted2,
    fontWeight: '700',
    fontSize: 12,
  },
  metricValue: {
    marginTop: 6,
    fontWeight: '900',
    fontSize: 18,
  },
  section: {
    backgroundColor: UI.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: 16,
    shadowColor: '#0F2940',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 5,
  },
  sectionTitle: {
    color: UI.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: UI.stroke2,
  },
  rowLabel: {
    color: UI.muted,
    fontWeight: '700',
  },
  rowValue: {
    color: UI.ink2,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
});
