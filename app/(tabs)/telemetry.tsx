import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, telemetryApi, terminalsApi } from '../../lib/api';
import { ConnectionHistoryModal } from '../../components/ConnectionHistoryModal';
import { NetworkErrorBanner } from '../../components/NetworkErrorBanner';
import { TerminalGeofenceModal } from '../../components/TerminalGeofenceModal';
import { TerminalQuickViewModal } from '../../components/TerminalQuickViewModal';
import { useDeduplicatedDevices } from '../../hooks/useDeduplicatedDevices';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import {
  buildConnectionHistory,
  deduplicateTelemetrySnapshots,
  type ConnectionHistoryItem,
} from '../../lib/deviceIdentity';
import { getGeofenceAlertMessage, getGeofenceStatus } from '../../lib/geofenceUtils';
import {
  formatBattery,
  formatDateTime,
  formatFreshness,
  formatNetwork,
  formatSignal,
  formatStorageFree,
  getConnectivityStatus,
  getTerminalName,
} from '../../lib/terminalPresentation';
import type {
  TelemetrySnapshot,
  TerminalSummary,
  UpdateTerminalSettingsRequest,
} from '../../lib/types';
import { UI, toneBg, toneColor } from '../../constants/theme';
import { GeofenceStatusBadge } from '../../components/GeofenceStatusBadge';
import { useAlerts } from '../../contexts/AlertContext';

type ViewMode = 'CURRENT' | 'HISTORY';
type StatusFilter = 'ALL' | 'ONLINE' | 'OFFLINE' | 'OUTSIDE_ZONE';

function isTerminalOutsideAuthorizedZone(terminal?: TerminalSummary | null): boolean {
  if (!terminal) return false;

  return (
    terminal.outsideAuthorizedZone === true ||
    getGeofenceStatus(terminal) === 'outside'
  );
}

function buildLiveAlertKey(alert: any): string {
  return String(
    alert?.id ??
      `${alert?.terminalId ?? alert?.terminal?.id ?? 'terminal'}-${alert?.createdAt ?? alert?.eventTimestamp ?? Date.now()}`,
  );
}

function getLiveAlertTerminalId(alert: any): number | null {
  const raw =
    alert?.terminalId ??
    alert?.terminal?.id ??
    alert?.terminalSummary?.id ??
    alert?.device?.terminalId;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function TelemetryScreen() {
  const params = useLocalSearchParams<{ terminalId?: string }>();
  const terminalId = params.terminalId ? Number(params.terminalId) : null;

  const [terminals, setTerminals] = useState<TerminalSummary[]>([]);
  const [snapshots, setSnapshots] = useState<TelemetrySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('CURRENT');
  const [mapTerminal, setMapTerminal] = useState<TerminalSummary | null>(null);
  const [geofenceTerminal, setGeofenceTerminal] = useState<TerminalSummary | null>(null);
  const [geofenceSaving, setGeofenceSaving] = useState(false);
  const [historyTerminal, setHistoryTerminal] = useState<TerminalSummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ConnectionHistoryItem[]>([]);

  const {
    alerts: liveMovementAlerts,
    triggerAlarm,
    isAlarmActive,
    stopAlarm,
    triggeredCount,
  } = useAlerts();

  const alarmReadyRef = useRef(false);
  const alarmLockRef = useRef(false);
  const outsideStateByTerminalRef = useRef<Map<number, boolean>>(new Map());
  const seenLiveAlertKeysRef = useRef<Set<string>>(new Set());

  const currentDevices = useDeduplicatedDevices(terminals);

  const terminalsById = useMemo(
    () => new Map(terminals.map((terminal) => [terminal.id, terminal])),
    [terminals],
  );

  const currentRows = useMemo(() => {
    const base =
      terminalId != null
        ? currentDevices.filter((terminal) => terminal.id === terminalId)
        : currentDevices;

    const query = search.trim().toLowerCase();

    return base.filter((terminal) => {
      const online = getConnectivityStatus(terminal) === 'ONLINE';

      if (statusFilter === 'ONLINE' && !online) return false;
      if (statusFilter === 'OFFLINE' && online) return false;
      if (statusFilter === 'OUTSIDE_ZONE' && !isTerminalOutsideAuthorizedZone(terminal)) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        getTerminalName(terminal),
        terminal.serialNumber,
        terminal.deviceKey,
        terminal.authorizedZoneName,
        terminal.city,
        terminal.country,
        terminal.lastAddressLine,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [currentDevices, search, statusFilter, terminalId]);

  const historyRows = useMemo(() => {
    const deduped = deduplicateTelemetrySnapshots(snapshots, terminalsById);
    const query = search.trim().toLowerCase();

    return deduped.filter((snapshot) => {
      const terminal = terminalsById.get(snapshot.terminalId);

      if (statusFilter === 'OUTSIDE_ZONE' && !isTerminalOutsideAuthorizedZone(terminal)) {
        return false;
      }

      if (statusFilter === 'ONLINE' && getConnectivityStatus(terminal) !== 'ONLINE') {
        return false;
      }

      if (statusFilter === 'OFFLINE' && getConnectivityStatus(terminal) === 'ONLINE') {
        return false;
      }

      if (!query) return true;

      const haystack = [
        getTerminalName(
          terminal ?? { id: snapshot.terminalId, deviceKey: `terminal-${snapshot.terminalId}` },
        ),
        terminal?.serialNumber,
        snapshot.model,
        snapshot.manufacturer,
        snapshot.city,
        snapshot.country,
        snapshot.addressLine,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [search, snapshots, statusFilter, terminalsById]);

  const metrics = useMemo(() => {
    const lowBattery = currentRows.filter(
      (terminal) => (terminal.lastBatteryPercent ?? 100) <= 20,
    ).length;

    const outside = currentRows.filter((terminal) =>
      isTerminalOutsideAuthorizedZone(terminal),
    ).length;

    const fresh = currentRows.filter(
      (terminal) => formatFreshness(terminal) === "A l'instant",
    ).length;

    return { lowBattery, outside, fresh };
  }, [currentRows]);

  const outsideZoneAlerts = useMemo(
    () =>
      currentRows
        .filter((terminal) => isTerminalOutsideAuthorizedZone(terminal))
        .map((terminal) => ({
          id: terminal.id,
          message:
            getGeofenceAlertMessage(terminal) ??
            `${getTerminalName(terminal)} est hors de sa zone autorisée.`,
          at: terminal.lastActivityAt ?? terminal.lastSeenAt,
          terminal,
        }))
        .filter((item) => Boolean(item.message)),
    [currentRows],
  );

  const triggerTelemetryAlarm = useCallback(async () => {
    if (alarmLockRef.current) return;

    alarmLockRef.current = true;

    try {
      await triggerAlarm();
    } finally {
      setTimeout(() => {
        alarmLockRef.current = false;
      }, 1500);
    }
  }, [triggerAlarm]);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [terminalList, snapshotList] = await Promise.all([
        terminalsApi.list(),
        terminalId != null
          ? telemetryApi.listByTerminal(terminalId, 150)
          : telemetryApi.listLatest(250),
      ]);

      setTerminals(terminalList);
      setSnapshots(snapshotList);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur de chargement de la telemetrie.');
    }
  }, [terminalId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useLiveRefresh(loadData, 5000);

  useEffect(() => {
    void loadData();
  }, [liveMovementAlerts, loadData]);

  useEffect(() => {
    const currentOutsideByTerminal = new Map<number, boolean>(
      currentDevices.map((terminal) => [
        terminal.id,
        isTerminalOutsideAuthorizedZone(terminal),
      ]),
    );

    if (!alarmReadyRef.current) {
      alarmReadyRef.current = true;
      outsideStateByTerminalRef.current = currentOutsideByTerminal;

      return;
    }

    for (const terminal of currentDevices) {
      const isOutside = currentOutsideByTerminal.get(terminal.id) === true;
      const wasOutside = outsideStateByTerminalRef.current.get(terminal.id) === true;

      if (!wasOutside && isOutside) {
        outsideStateByTerminalRef.current = currentOutsideByTerminal;
        void triggerTelemetryAlarm();
        return;
      }
    }

    outsideStateByTerminalRef.current = currentOutsideByTerminal;
  }, [currentDevices, triggerTelemetryAlarm]);

  useEffect(() => {
    for (const alert of liveMovementAlerts as any[]) {
      if (alert?.status !== 'TRIGGERED') continue;

      const alertTerminalId = getLiveAlertTerminalId(alert);
      if (alertTerminalId == null) continue;

      const terminal = currentDevices.find((item) => Number(item.id) === alertTerminalId);

      if (!isTerminalOutsideAuthorizedZone(terminal)) {
        continue;
      }

      const key = buildLiveAlertKey(alert);

      if (seenLiveAlertKeysRef.current.has(key)) continue;

      seenLiveAlertKeysRef.current.add(key);
      void triggerTelemetryAlarm();
      break;
    }
  }, [liveMovementAlerts, currentDevices, triggerTelemetryAlarm]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  async function saveGeofence(payload: UpdateTerminalSettingsRequest) {
    if (!geofenceTerminal) return;

    setGeofenceSaving(true);

    try {
      const updated = await terminalsApi.updateSettings(geofenceTerminal.id, payload);

      setTerminals((prev) =>
        prev.map((terminal) =>
          terminal.id === updated.id
            ? {
                ...terminal,
                displayName: updated.displayName,
                authorizedZoneName: updated.authorizedZoneName,
                baseLatitude: updated.baseLatitude,
                baseLongitude: updated.baseLongitude,
                alertRadiusMeters: updated.alertRadiusMeters,
                outsideAuthorizedZone: updated.outsideAuthorizedZone,
              }
            : terminal,
        ),
      );

      setGeofenceTerminal(null);
    } finally {
      setGeofenceSaving(false);
    }
  }

  async function openHistory(terminal: TerminalSummary) {
    setHistoryTerminal(terminal);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryRecords([]);

    try {
      const page = await terminalsApi.getConnections(terminal.id, 0, 100);
      setHistoryRecords(buildConnectionHistory(terminal, page.content));
    } catch (e) {
      setHistoryError(e instanceof ApiError ? e.message : 'Historique indisponible.');
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.safe}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={UI.info} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isAlarmActive ? (
          <View style={s.activeAlarmPanel}>
            <View style={s.activeAlarmLeft}>
              <View style={s.activeAlarmIcon}>
                <Ionicons name="warning" size={22} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.activeAlarmTitle}>ALARME ACTIVE SUR LA TÉLÉMÉTRIE</Text>
                <Text style={s.activeAlarmText}>
                  {triggeredCount > 0
                    ? `${triggeredCount} alerte${triggeredCount > 1 ? 's' : ''} critique${triggeredCount > 1 ? 's' : ''} détectée${triggeredCount > 1 ? 's' : ''}.`
                    : "Un TPE est hors de sa zone autorisée."}
                </Text>
              </View>
            </View>

            <Pressable style={s.activeAlarmStopBtn} onPress={stopAlarm}>
              <Ionicons name="volume-mute-outline" size={17} color="#fff" />
              <Text style={s.activeAlarmStopText}>Couper</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>Telemetrie TPE</Text>
            <Text style={s.title}>Etat courant et historique technique</Text>
            <Text style={s.subtitle}>
              Cette vue sépare clairement l’état courant dédupliqué des TPE et l’historique
              brut des remontées. La sirène se déclenche uniquement quand un TPE est réellement hors zone autorisée.
            </Text>
          </View>

          <View style={s.modeRow}>
            <ModeChip active={viewMode === 'CURRENT'} label="Etat courant" onPress={() => setViewMode('CURRENT')} />
            <ModeChip active={viewMode === 'HISTORY'} label="Historique" onPress={() => setViewMode('HISTORY')} />
          </View>
        </View>

        {error ? <NetworkErrorBanner message={error} onRetry={() => loadData()} /> : null}

        {terminalId != null ? (
          <View style={s.focusBanner}>
            <Ionicons name="hardware-chip-outline" size={16} color={UI.info} />
            <Text style={s.focusText}>Filtre actif sur le terminal #{terminalId}</Text>
            <Pressable onPress={() => router.setParams({ terminalId: undefined as any })}>
              <Ionicons name="close-circle" size={18} color={UI.muted2} />
            </Pressable>
          </View>
        ) : null}

        <View style={s.kpiRow}>
          <MetricCard icon="hardware-chip-outline" label="TPE courants" value={currentRows.length} tone="info" />
          <MetricCard icon="flash-outline" label="Tres frais" value={metrics.fresh} tone="ok" />
          <MetricCard icon="warning-outline" label="Batterie faible" value={metrics.lowBattery} tone="warn" />
          <MetricCard icon="alert-circle-outline" label="Hors zone" value={metrics.outside} tone="bad" />
        </View>

        {outsideZoneAlerts.length > 0 ? (
          <View style={s.alertPanel}>
            <Text style={s.alertPanelTitle}>Surveillance geofence</Text>

            {outsideZoneAlerts.slice(0, 3).map((alert) => (
              <Pressable
                key={alert.id}
                style={s.alertRow}
                onPress={() => setMapTerminal(alert.terminal)}
              >
                <Ionicons name="alert-circle-outline" size={16} color={UI.bad} />
                <Text style={s.alertRowText}>{alert.message}</Text>
                <Text style={s.alertRowMeta}>{formatDateTime(alert.at)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={s.panel}>
          <View style={s.filterRow}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={18} color={UI.muted2} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Filtrer par terminal, ville, zone ou serie"
                placeholderTextColor={UI.faint}
                style={s.searchInput}
              />
            </View>

            <View style={s.filterChips}>
              {(['ALL', 'ONLINE', 'OFFLINE', 'OUTSIDE_ZONE'] as StatusFilter[]).map((filter) => (
                <Pressable
                  key={filter}
                  style={[s.filterChip, statusFilter === filter && s.filterChipActive]}
                  onPress={() => setStatusFilter(filter)}
                >
                  <Text style={[s.filterChipText, statusFilter === filter && s.filterChipTextActive]}>
                    {filter === 'ALL'
                      ? 'Tous'
                      : filter === 'ONLINE'
                        ? 'En ligne'
                        : filter === 'OFFLINE'
                          ? 'Offline'
                          : 'Hors zone'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {loading ? (
            <View style={s.state}>
              <ActivityIndicator size="large" color={UI.info} />
            </View>
          ) : viewMode === 'CURRENT' ? (
            <CurrentTelemetryTable
              rows={currentRows}
              onOpenMap={setMapTerminal}
              onOpenHistory={openHistory}
              onEditGeofence={setGeofenceTerminal}
            />
          ) : (
            <TelemetryHistoryTable rows={historyRows} terminalsById={terminalsById} />
          )}
        </View>
      </ScrollView>

      <TerminalQuickViewModal
        terminal={mapTerminal}
        visible={Boolean(mapTerminal)}
        onClose={() => setMapTerminal(null)}
      />

      <TerminalGeofenceModal
        terminal={geofenceTerminal}
        visible={Boolean(geofenceTerminal)}
        saving={geofenceSaving}
        onClose={() => setGeofenceTerminal(null)}
        onSave={saveGeofence}
      />

      <ConnectionHistoryModal
        visible={Boolean(historyTerminal)}
        terminalName={historyTerminal ? getTerminalName(historyTerminal) : undefined}
        loading={historyLoading}
        error={historyError}
        records={historyRecords}
        onClose={() => {
          setHistoryTerminal(null);
          setHistoryRecords([]);
          setHistoryError(null);
        }}
      />
    </SafeAreaView>
  );
}

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.modeChip, active && s.modeChipActive]}>
      <Text style={[s.modeChipText, active && s.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}) {
  return (
    <View style={s.metricCard}>
      <View style={[s.metricIcon, { backgroundColor: toneBg(tone) }]}>
        <Ionicons name={icon} size={20} color={toneColor(tone)} />
      </View>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function CurrentTelemetryTable({
  rows,
  onOpenMap,
  onOpenHistory,
  onEditGeofence,
}: {
  rows: TerminalSummary[];
  onOpenMap: (terminal: TerminalSummary) => void;
  onOpenHistory: (terminal: TerminalSummary) => void;
  onEditGeofence: (terminal: TerminalSummary) => void;
}) {
  if (rows.length === 0) {
    return (
      <View style={s.state}>
        <Text style={s.stateText}>Aucun terminal courant ne correspond aux filtres.</Text>
      </View>
    );
  }

  const columns = [
    'Terminal',
    'Statut',
    'Fraicheur',
    'Batterie',
    'Reseau',
    'Signal',
    'Stockage',
    'Zone',
    'Alertes',
    'Actions',
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ minWidth: 1450 }}>
        <View style={[s.tableRow, s.headerRow]}>
          {columns.map((column, index) => (
            <Text key={column} style={[s.headerCell, currentColumn(index)]}>
              {column.toUpperCase()}
            </Text>
          ))}
        </View>

        {rows.map((terminal) => {
          const online = getConnectivityStatus(terminal) === 'ONLINE';
          const lowBattery = (terminal.lastBatteryPercent ?? 100) <= 20;
          const outside = isTerminalOutsideAuthorizedZone(terminal);

          return (
            <View
              key={terminal.id}
              style={[s.tableRow, outside && s.warnRow]}
            >
              <View style={[s.cell, currentColumn(0)]}>
                <Text style={s.primaryCell}>{getTerminalName(terminal)}</Text>
                <Text style={s.secondaryCell}>{terminal.serialNumber ?? terminal.deviceKey}</Text>
              </View>

              <View style={[s.cell, currentColumn(1)]}>
                <StatusPill label={online ? 'En ligne' : 'Offline'} tone={online ? 'ok' : 'bad'} />
              </View>

              <Text style={[s.cell, s.bodyText, currentColumn(2)]}>{formatFreshness(terminal)}</Text>
              <Text style={[s.cell, s.bodyText, currentColumn(3)]}>{formatBattery(terminal.lastBatteryPercent)}</Text>
              <Text style={[s.cell, s.bodyText, currentColumn(4)]}>{formatNetwork(terminal.lastNetworkType)}</Text>
              <Text style={[s.cell, s.bodyText, currentColumn(5)]}>{formatSignal(terminal.lastSignalLevel)}</Text>
              <Text style={[s.cell, s.bodyText, currentColumn(6)]}>
                {formatStorageFree(terminal.lastStorageFreeMb, terminal.lastStorageTotalMb)}
              </Text>

              <View style={[s.cell, currentColumn(7)]}>
                <Text style={s.primaryCellSmall}>{terminal.authorizedZoneName ?? 'Zone non definie'}</Text>
                <Text style={s.secondaryCell}>
                  {terminal.alertRadiusMeters ? `${terminal.alertRadiusMeters} m` : 'Aucun rayon'}
                </Text>
              </View>

              <View style={[s.cell, currentColumn(8)]}>
                {outside ? (
                  <GeofenceStatusBadge terminal={terminal} />
                ) : lowBattery ? (
                  <StatusPill label="Batterie faible" tone="warn" />
                ) : (
                  <GeofenceStatusBadge terminal={terminal} />
                )}
              </View>

              <View style={[s.cell, currentColumn(9), s.actions]}>
                <Pressable style={s.actionBtn} onPress={() => onOpenMap(terminal)}>
                  <Ionicons name="eye-outline" size={18} color={UI.info} />
                </Pressable>

                <Pressable style={s.actionBtn} onPress={() => onOpenHistory(terminal)}>
                  <Ionicons name="time-outline" size={18} color={UI.ink2} />
                </Pressable>

                <Pressable style={s.actionBtn} onPress={() => onEditGeofence(terminal)}>
                  <Ionicons name="locate-outline" size={18} color={UI.warn} />
                </Pressable>

                <Pressable style={s.actionBtn} onPress={() => router.push(`/terminal/${terminal.id}` as any)}>
                  <Ionicons name="open-outline" size={18} color={UI.ink2} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function TelemetryHistoryTable({
  rows,
  terminalsById,
}: {
  rows: TelemetrySnapshot[];
  terminalsById: Map<number, TerminalSummary>;
}) {
  if (rows.length === 0) {
    return (
      <View style={s.state}>
        <Text style={s.stateText}>Aucun historique de telemetrie disponible.</Text>
      </View>
    );
  }

  const columns = [
    'Terminal',
    'Capture',
    'Batterie',
    'Reseau',
    'Signal',
    'Stockage',
    'Localisation',
    'Seuils',
    'Alertes',
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ minWidth: 1490 }}>
        <View style={[s.tableRow, s.headerRow]}>
          {columns.map((column, index) => (
            <Text key={column} style={[s.headerCell, historyColumn(index)]}>
              {column.toUpperCase()}
            </Text>
          ))}
        </View>

        {rows.map((snapshot) => {
          const terminal = terminalsById.get(snapshot.terminalId);
          const lowBattery = (snapshot.batteryPercent ?? 100) <= 20;
          const outside = isTerminalOutsideAuthorizedZone(terminal);
          const thresholdText = terminal?.alertRadiusMeters ? `${terminal.alertRadiusMeters} m` : 'Sans zone';

          return (
            <View key={snapshot.id} style={[s.tableRow, outside && s.warnRow]}>
              <View style={[s.cell, historyColumn(0)]}>
                <Text style={s.primaryCell}>
                  {getTerminalName(
                    terminal ?? { id: snapshot.terminalId, deviceKey: `terminal-${snapshot.terminalId}` },
                  )}
                </Text>
                <Text style={s.secondaryCell}>Terminal #{snapshot.terminalId}</Text>
              </View>

              <Text style={[s.cell, s.bodyText, historyColumn(1)]}>{formatDateTime(snapshot.capturedAt)}</Text>
              <Text style={[s.cell, s.bodyText, historyColumn(2)]}>{formatBattery(snapshot.batteryPercent)}</Text>
              <Text style={[s.cell, s.bodyText, historyColumn(3)]}>{formatNetwork(snapshot.networkType)}</Text>
              <Text style={[s.cell, s.bodyText, historyColumn(4)]}>{formatSignal(snapshot.signalLevel)}</Text>
              <Text style={[s.cell, s.bodyText, historyColumn(5)]}>
                {formatStorageFree(snapshot.storageFreeMb, snapshot.storageTotalMb)}
              </Text>
              <Text style={[s.cell, s.bodyText, historyColumn(6)]}>{snapshot.addressLine ?? snapshot.city ?? '—'}</Text>

              <View style={[s.cell, historyColumn(7)]}>
                <Text style={s.primaryCellSmall}>{terminal?.authorizedZoneName ?? 'Zone libre'}</Text>
                <Text style={s.secondaryCell}>{thresholdText}</Text>
              </View>

              <View style={[s.cell, historyColumn(8)]}>
                {outside ? (
                  terminal ? (
                    <GeofenceStatusBadge terminal={terminal} />
                  ) : (
                    <StatusPill label="Hors zone" tone="bad" />
                  )
                ) : lowBattery ? (
                  <StatusPill label="Batterie faible" tone="warn" />
                ) : terminal ? (
                  <GeofenceStatusBadge terminal={terminal} />
                ) : (
                  <StatusPill label="OK" tone="ok" />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}) {
  return (
    <View style={[s.statusPill, { backgroundColor: toneBg(tone) }]}>
      <Text style={[s.statusPillText, { color: toneColor(tone) }]}>{label}</Text>
    </View>
  );
}

function currentColumn(index: number) {
  const widths = [250, 120, 130, 100, 120, 100, 120, 180, 140, 190];
  return { width: widths[index] };
}

function historyColumn(index: number) {
  const widths = [230, 170, 110, 120, 100, 120, 220, 150, 140];
  return { width: widths[index] };
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },

  activeAlarmPanel: {
    backgroundColor: '#12020A',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#8B1A1A',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#D64545',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 18,
  },
  activeAlarmLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeAlarmIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#D64545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAlarmTitle: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  activeAlarmText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  activeAlarmStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: '#D64545',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  activeAlarmStopText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  hero: {
    borderRadius: 30,
    backgroundColor: UI.white,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 24,
    gap: 18,
  },
  overline: {
    color: UI.info,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  title: {
    marginTop: 8,
    color: UI.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 10,
    color: UI.muted,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 840,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: UI.card2,
  },
  modeChipActive: {
    backgroundColor: UI.infoBg,
  },
  modeChipText: {
    color: UI.muted,
    fontWeight: '800',
    fontSize: 13,
  },
  modeChipTextActive: {
    color: UI.info,
  },
  focusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: UI.white,
    borderWidth: 1,
    borderColor: UI.stroke,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  focusText: {
    flex: 1,
    color: UI.ink2,
    fontWeight: '800',
    fontSize: 14,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 170,
    backgroundColor: UI.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 18,
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    marginTop: 16,
    color: UI.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 8,
    color: UI.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  alertPanel: {
    backgroundColor: UI.badBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F2C8C8',
    padding: 16,
  },
  alertPanelTitle: {
    color: UI.bad,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  alertRowText: {
    flex: 1,
    color: UI.ink2,
    fontWeight: '700',
    fontSize: 13,
  },
  alertRowMeta: {
    color: UI.bad,
    fontWeight: '800',
    fontSize: 12,
  },
  panel: {
    backgroundColor: UI.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 20,
  },
  filterRow: {
    gap: 14,
    marginBottom: 14,
  },
  searchWrap: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: UI.ink,
    fontSize: 15,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: UI.card2,
  },
  filterChipActive: {
    backgroundColor: UI.infoBg,
  },
  filterChipText: {
    color: UI.muted,
    fontWeight: '800',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: UI.info,
  },
  state: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: UI.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: UI.stroke2,
  },
  headerRow: {
    borderTopWidth: 1,
    borderTopColor: UI.stroke2,
    backgroundColor: UI.card2,
  },
  warnRow: {
    backgroundColor: '#FFF8F0',
  },
  headerCell: {
    paddingVertical: 13,
    paddingHorizontal: 10,
    color: UI.muted2,
    fontWeight: '900',
    fontSize: 11,
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 15,
    justifyContent: 'center',
  },
  primaryCell: {
    color: UI.ink,
    fontWeight: '900',
    fontSize: 14,
  },
  primaryCellSmall: {
    color: UI.ink2,
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryCell: {
    marginTop: 4,
    color: UI.muted,
    fontSize: 12,
  },
  bodyText: {
    color: UI.ink2,
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillText: {
    fontWeight: '900',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
