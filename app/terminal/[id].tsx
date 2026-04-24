import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, terminalsApi } from '../../lib/api';
import type {
  AlertResponse,
  Terminal,
  TerminalConnectionHistoryResponse,
  TelemetrySnapshot,
  UpdateTerminalSettingsRequest,
} from '../../lib/types';
import { UI, toneBg, toneColor } from '../../constants/theme';
import {
  formatBattery,
  formatDateTime,
  formatFreshness,
  formatNetwork,
  formatSignal,
  formatStorageFree,
  getTerminalName,
} from '../../lib/terminalPresentation';
import { getGeofenceAlertMessage } from '../../lib/geofenceUtils';
import { MapEmbed } from '../../components/MapEmbed';
import { TerminalGeofenceModal } from '../../components/TerminalGeofenceModal';
import { NetworkErrorBanner } from '../../components/NetworkErrorBanner';
import { GeofenceDetailsCard } from '../../components/GeofenceDetailsCard';
import { GeofenceStatusBadge } from '../../components/GeofenceStatusBadge';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAlerts } from '../../contexts/AlertContext';

type DetailPayload = {
  terminal: Terminal;
  positions: { content: TelemetrySnapshot[] };
  events: { content: AlertResponse[] };
  connectionHistory: { content: TerminalConnectionHistoryResponse[] };
};

export default function TerminalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const terminalId = Number(id);

  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { alerts: liveMovementAlerts } = useAlerts();

  const load = useCallback(async () => {
    try {
      setError(null);
      const full = await terminalsApi.getFullHistory(terminalId, 0, 20);
      setData(full as DetailPayload);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Impossible de charger le terminal.';
      setError(message);
    }
  }, [terminalId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useLiveRefresh(load, 5000);

  useEffect(() => {
    void load();
  }, [liveMovementAlerts, load]);

  async function saveGeofence(payload: UpdateTerminalSettingsRequest) {
    setSaving(true);
    try {
      const updated = await terminalsApi.updateSettings(terminalId, payload);
      setData((prev) =>
        prev
          ? {
              ...prev,
              terminal: {
                ...prev.terminal,
                ...updated,
              },
            }
          : prev,
      );
      setConfigOpen(false);
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Impossible d’enregistrer la geofence.';
      Alert.alert('Erreur', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={UI.info} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <NetworkErrorBanner message={error ?? 'Terminal introuvable.'} onRetry={() => load()} />
        </View>
      </SafeAreaView>
    );
  }

  const { terminal, positions, events, connectionHistory } = data;
  const latest = positions.content[0];
  const outsideMessage = getGeofenceAlertMessage(terminal);

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={positions.content}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <>
            {error ? <NetworkErrorBanner message={error} onRetry={() => load()} /> : null}

            <View style={s.hero}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{getTerminalName(terminal)}</Text>
                <Text style={s.subtitle}>{terminal.serialNumber ?? terminal.deviceKey}</Text>
                <View style={s.heroMeta}>
                  <MetricCard label="Statut" value={terminal.connectivityStatus ?? 'OFFLINE'} />
                  <MetricCard label="Fraicheur" value={formatFreshness(terminal)} />
                  <MetricCard
                    label="Zone"
                    value={terminal.authorizedZoneName ?? 'Zone personnalisee'}
                    tone="info"
                  />
                </View>
              </View>
              <Pressable style={s.configBtn} onPress={() => setConfigOpen(true)}>
                <Ionicons name="locate-outline" size={18} color={UI.info} />
                <Text style={s.configBtnText}>Configurer zone</Text>
              </Pressable>
            </View>

            {outsideMessage ? (
              <View style={s.alertPanel}>
                <Ionicons name="alert-circle-outline" size={18} color={UI.bad} />
                <Text style={s.alertPanelText}>{outsideMessage}</Text>
                <Text style={s.alertPanelTime}>{formatDateTime(terminal.lastActivityAt ?? terminal.lastSeenAt)}</Text>
              </View>
            ) : null}

            <View style={s.metricGrid}>
              <MetricCard label="Batterie" value={formatBattery(terminal.lastBatteryPercent ?? latest?.batteryPercent)} />
              <MetricCard label="Reseau" value={formatNetwork(terminal.lastNetworkType ?? latest?.networkType)} />
              <MetricCard label="Signal" value={formatSignal(terminal.lastSignalLevel ?? latest?.signalLevel)} />
              <MetricCard label="Stockage" value={formatStorageFree(terminal.lastStorageFreeMb ?? latest?.storageFreeMb, terminal.lastStorageTotalMb ?? latest?.storageTotalMb)} />
              <MetricCard label="Connexions" value={String(terminal.totalConnectionCount ?? 0)} />
              <View style={s.statusCard}>
                <Text style={s.metricLabel}>Statut geofence</Text>
                <GeofenceStatusBadge terminal={terminal} />
              </View>
            </View>

            {terminal.lastGpsLat != null && terminal.lastGpsLng != null ? (
              <Section title="Carte et perimetre autorise">
                <MapEmbed
                  lat={terminal.lastGpsLat}
                  lng={terminal.lastGpsLng}
                  label={getTerminalName(terminal)}
                  zoneName={terminal.authorizedZoneName}
                  baseLatitude={terminal.baseLatitude}
                  baseLongitude={terminal.baseLongitude}
                  alertRadiusMeters={terminal.alertRadiusMeters}
                  outsideAuthorizedZone={terminal.outsideAuthorizedZone}
                  height={280}
                />
              </Section>
            ) : null}

            <GeofenceDetailsCard terminal={terminal} title="Bloc geofence" />

            <Section title="Etat courant">
              <InfoRow label="Adresse" value={terminal.lastAddressLine ?? '—'} />
              <InfoRow label="Ville" value={terminal.city ?? '—'} />
              <InfoRow label="Pays" value={terminal.country ?? '—'} />
              <InfoRow label="Derniere activite" value={formatDateTime(terminal.lastActivityAt ?? terminal.lastSeenAt)} />
              <InfoRow label="Derniere connexion" value={formatDateTime(terminal.lastConnectedAt)} />
              <InfoRow label="Derniere deconnexion" value={formatDateTime(terminal.lastDisconnectedAt)} />
            </Section>

            <Section title={`Historique de connexion (${connectionHistory.content.length})`}>
              {connectionHistory.content.length === 0 ? (
                <Text style={s.empty}>Aucun evenement de connexion.</Text>
              ) : (
                connectionHistory.content.map((entry) => (
                  <View key={entry.id} style={s.timelineItem}>
                    <Text style={s.timelineTitle}>{entry.eventType}</Text>
                    <Text style={s.timelineText}>Connecte: {formatDateTime(entry.connectedAt)}</Text>
                    <Text style={s.timelineText}>Deconnecte: {formatDateTime(entry.disconnectedAt)}</Text>
                  </View>
                ))
              )}
            </Section>

            <Section title={`Alertes (${events.content.length})`}>
              {events.content.length === 0 ? (
                <Text style={s.empty}>Aucune alerte recente.</Text>
              ) : (
                events.content.map((event) => (
                  <View key={event.id} style={s.alertItem}>
                    <Text style={s.alertType}>
                      {event.severity} · {event.type}
                    </Text>
                    <Text style={s.alertText}>{event.message ?? 'Alerte systeme'}</Text>
                  </View>
                ))
              )}
            </Section>

            <Text style={s.sectionTitle}>Derniers snapshots de telemetrie</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={s.snapshot}>
            <Text style={s.snapshotDate}>{formatDateTime(item.capturedAt)}</Text>
            <Text style={s.snapshotLine}>
              Batterie {formatBattery(item.batteryPercent)} · Reseau {formatNetwork(item.networkType)} · Signal {formatSignal(item.signalLevel)}
            </Text>
            <Text style={s.snapshotLine}>{item.addressLine ?? item.city ?? 'Localisation inconnue'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>Aucun snapshot de telemetrie.</Text>}
      />

      <TerminalGeofenceModal
        terminal={terminal}
        visible={configOpen}
        saving={saving}
        onClose={() => setConfigOpen(false)}
        onSave={saveGeofence}
      />
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  tone = 'info',
}: {
  label: string;
  value: string;
  tone?: 'info' | 'ok' | 'warn';
}) {
  return (
    <View style={[s.metricCard, { backgroundColor: toneBg(tone) }]}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color: toneColor(tone) }]}>{value}</Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
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
  hero: {
    backgroundColor: UI.white,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 18,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  title: {
    color: UI.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: UI.muted,
  },
  heroMeta: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  configBtn: {
    backgroundColor: UI.infoBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  configBtnText: {
    color: UI.info,
    fontWeight: '900',
  },
  alertPanel: {
    marginTop: 14,
    backgroundColor: UI.badBg,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F2C8C8',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  alertPanelText: {
    flex: 1,
    color: UI.bad,
    fontWeight: '800',
    lineHeight: 20,
  },
  alertPanelTime: {
    color: UI.bad,
    fontWeight: '900',
    fontSize: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    marginBottom: 6,
  },
  metricCard: {
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 18,
    padding: 14,
  },
  statusCard: {
    minWidth: 180,
    flexGrow: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: UI.stroke,
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
    backgroundColor: UI.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 16,
  },
  sectionTitle: {
    color: UI.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: UI.stroke2,
  },
  infoLabel: {
    color: UI.muted,
    fontWeight: '700',
  },
  infoValue: {
    color: UI.ink2,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'right',
  },
  timelineItem: {
    borderRadius: 16,
    backgroundColor: UI.card2,
    padding: 12,
    marginBottom: 10,
  },
  timelineTitle: {
    color: UI.ink,
    fontWeight: '900',
  },
  timelineText: {
    color: UI.muted,
    marginTop: 4,
  },
  alertItem: {
    borderLeftWidth: 4,
    borderLeftColor: UI.bad,
    backgroundColor: UI.badBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  alertType: {
    color: UI.bad,
    fontWeight: '900',
  },
  alertText: {
    color: UI.ink2,
    marginTop: 4,
  },
  snapshot: {
    backgroundColor: UI.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 14,
    marginBottom: 10,
  },
  snapshotDate: {
    color: UI.ink,
    fontWeight: '900',
  },
  snapshotLine: {
    marginTop: 4,
    color: UI.muted,
  },
  empty: {
    color: UI.muted,
    fontWeight: '700',
  },
});
