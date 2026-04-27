import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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

import { ApiError, alertsApi, terminalsApi } from '../../lib/api';
import type { TerminalSummary, UpdateTerminalSettingsRequest } from '../../lib/types';
import { UI, toneBg, toneColor } from '../../constants/theme';
import {
  buildConnectionHistory,
  type ConnectionHistoryItem,
} from '../../lib/deviceIdentity';
import { getGeofenceAlertMessage, getGeofenceStatus } from '../../lib/geofenceUtils';
import { useDeduplicatedDevices } from '../../hooks/useDeduplicatedDevices';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
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
import { NetworkErrorBanner } from '../../components/NetworkErrorBanner';
import { TerminalMap } from '../../components/TerminalMap';
import { TerminalQuickViewModal } from '../../components/TerminalQuickViewModal';
import { TerminalGeofenceModal } from '../../components/TerminalGeofenceModal';
import { ConnectionHistoryModal } from '../../components/ConnectionHistoryModal';
import { GeofenceStatusBadge } from '../../components/GeofenceStatusBadge';
import { useAlerts } from '../../contexts/AlertContext';

type StatusFilter = 'ALL' | 'ONLINE' | 'OFFLINE' | 'OUTSIDE_ZONE';

export default function DashboardScreen() {
  const [terminals, setTerminals] = useState<TerminalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalSummary | null>(null);
  const [mapTerminal, setMapTerminal] = useState<TerminalSummary | null>(null);
  const [geofenceTerminal, setGeofenceTerminal] = useState<TerminalSummary | null>(null);
  const [geofenceSaving, setGeofenceSaving] = useState(false);
  const [alertTotal, setAlertTotal] = useState(0);
  const [historyTerminal, setHistoryTerminal] = useState<TerminalSummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ConnectionHistoryItem[]>([]);

  const {
    isAlarmActive,
    stopAlarm,
    triggeredCount,
    triggerSyntheticOutOfZoneAlert,
    resolveSyntheticAlertForTerminal,
  } = useAlerts();
  const previousZoneStatusRef = useRef<Map<number, 'inside' | 'outside' | 'unknown'>>(new Map());

  const currentDevices = useDeduplicatedDevices(terminals);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [terminalList, alertPage] = await Promise.all([
        terminalsApi.list(),
        alertsApi.list(0, 1),
      ]);

      setTerminals(terminalList);
      setAlertTotal(alertPage.totalElements);
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Erreur de chargement du dashboard.';
      setError(message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useLiveRefresh(loadData, 5000);

  useEffect(() => {
    const nextStatuses = new Map<number, 'inside' | 'outside' | 'unknown'>();

    currentDevices.forEach((terminal) => {
      const nextStatus = getGeofenceStatus(terminal);
      const previousStatus = previousZoneStatusRef.current.get(terminal.id);
      nextStatuses.set(terminal.id, nextStatus);

      if (previousStatus === 'outside' && nextStatus !== 'outside') {
        resolveSyntheticAlertForTerminal(terminal.id);
      }

      if (previousStatus != null && previousStatus !== 'outside' && nextStatus === 'outside') {
        triggerSyntheticOutOfZoneAlert(terminal);
      }
    });

    previousZoneStatusRef.current = nextStatuses;
  }, [currentDevices, resolveSyntheticAlertForTerminal, triggerSyntheticOutOfZoneAlert]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return currentDevices.filter((terminal) => {
      const online = getConnectivityStatus(terminal) === 'ONLINE';

      if (statusFilter === 'ONLINE' && !online) return false;
      if (statusFilter === 'OFFLINE' && online) return false;
      if (statusFilter === 'OUTSIDE_ZONE' && getGeofenceStatus(terminal) !== 'outside') {
        return false;
      }

      if (!query) return true;

      const haystack = [
        getTerminalName(terminal),
        terminal.serialNumber,
        terminal.deviceKey,
        terminal.lastAddressLine,
        terminal.city,
        terminal.country,
        terminal.authorizedZoneName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [currentDevices, search, statusFilter]);

  const positioned = useMemo(
    () => filtered.filter((t) => t.lastGpsLat != null && t.lastGpsLng != null),
    [filtered],
  );

  const kpis = useMemo(() => {
    const online = currentDevices.filter((t) => getConnectivityStatus(t) === 'ONLINE').length;
    const outside = currentDevices.filter((t) => getGeofenceStatus(t) === 'outside').length;
    const withGeofence = currentDevices.filter((t) => t.alertRadiusMeters != null).length;
    const totalConnections = currentDevices.reduce(
      (sum, t) => sum + (t.totalConnectionCount ?? 0),
      0,
    );

    return { online, outside, withGeofence, totalConnections };
  }, [currentDevices]);

  const outsideZoneAlerts = useMemo(
    () =>
      filtered
        .filter((t) => getGeofenceStatus(t) === 'outside')
        .map((t) => ({
          id: t.id,
          message: getGeofenceAlertMessage(t),
          at: t.lastActivityAt ?? t.lastSeenAt,
          terminal: t,
        }))
        .filter((item) => Boolean(item.message)),
    [filtered],
  );

  function focusOnMap(terminal: TerminalSummary) {
    setSelectedTerminal(terminal);
  }

  async function saveGeofence(payload: UpdateTerminalSettingsRequest) {
    if (!geofenceTerminal) return;

    setGeofenceSaving(true);

    try {
      const updated = await terminalsApi.updateSettings(geofenceTerminal.id, payload);

      setTerminals((prev) =>
        prev.map((t) =>
          t.id === updated.id
            ? {
                ...t,
                displayName: updated.displayName,
                authorizedZoneName: updated.authorizedZoneName,
                baseLatitude: updated.baseLatitude,
                baseLongitude: updated.baseLongitude,
                alertRadiusMeters: updated.alertRadiusMeters,
                outsideAuthorizedZone: updated.outsideAuthorizedZone,
                lastGpsLat: updated.lastGpsLat,
                lastGpsLng: updated.lastGpsLng,
              }
            : t,
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
                <Text style={s.activeAlarmTitle}>ALARME ACTIVE SUR LE DASHBOARD</Text>
                <Text style={s.activeAlarmText}>
                  {triggeredCount > 0
                    ? `${triggeredCount} alerte${triggeredCount > 1 ? 's' : ''} critique${triggeredCount > 1 ? 's' : ''} dÃ©tectÃ©e${triggeredCount > 1 ? 's' : ''}.`
                    : "Une nouvelle alerte vient d'Ãªtre dÃ©tectÃ©e."}
                </Text>
              </View>
            </View>

            <Pressable style={s.activeAlarmStopBtn} onPress={stopAlarm}>
              <Ionicons name="volume-mute-outline" size={17} color="#fff" />
              <Text style={s.activeAlarmStopText}>Couper</Text>
            </Pressable>
          </View>
        ) : null}

        <LinearGradient colors={['rgba(255,255,255,0.94)', 'rgba(230,239,250,0.9)']} style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={s.overline}>Monitoring TPE</Text>
            <Text style={s.title}>Vue unique des terminaux</Text>
            <Text style={s.subtitle}>
              Tableau principal deduplique â€” l&apos;etat courant de chaque terminal en temps reel.
              Les nouvelles alertes backend sont synchronisees toutes les 5 secondes.
            </Text>

            <View style={s.heroChips}>
              <HeroChip icon="hardware-chip-outline" text={`${currentDevices.length} TPE uniques`} />
              <HeroChip
                icon="layers-outline"
                text={`${Math.max(terminals.length - currentDevices.length, 0)} doublon(s)`}
              />
              <HeroChip icon="locate-outline" text={`${kpis.withGeofence} zone(s)`} />
            </View>
          </View>

          <Pressable style={s.heroAlertBtn} onPress={() => router.push('/(tabs)/alerts' as any)}>
            <View style={[s.heroAlertDot, alertTotal > 0 && s.heroAlertDotActive]} />
            <Ionicons
              name="notifications-outline"
              size={17}
              color={alertTotal > 0 ? UI.bad : UI.info}
            />
            <Text style={[s.heroAlertText, alertTotal > 0 && s.heroAlertTextActive]}>
              {alertTotal} alerte{alertTotal > 1 ? 's' : ''}
            </Text>
          </Pressable>
        </LinearGradient>

        {error ? <NetworkErrorBanner message={error} onRetry={() => loadData()} /> : null}

        <View style={s.kpiRow}>
          <KpiCard
            icon="hardware-chip-outline"
            label="TPE uniques"
            value={currentDevices.length}
            tone="info"
          />
          <KpiCard icon="pulse-outline" label="En ligne" value={kpis.online} tone="ok" />
          <KpiCard
            icon="alert-circle-outline"
            label="Hors zone"
            value={kpis.outside}
            tone={kpis.outside > 0 ? 'warn' : 'ok'}
          />
          <KpiCard
            icon="repeat-outline"
            label="Connexions totales"
            value={kpis.totalConnections}
            tone="info"
          />
        </View>

        {outsideZoneAlerts.length > 0 ? (
          <View style={s.alertPanel}>
            <View style={s.alertPanelHead}>
              <View style={s.alertPanelDot} />
              <Text style={s.alertPanelTitle}>
                {outsideZoneAlerts.length} TPE hors zone autorisee
              </Text>
            </View>

            {outsideZoneAlerts.slice(0, 4).map((alert) => (
              <Pressable
                key={alert.id}
                style={s.alertRow}
                onPress={() => focusOnMap(alert.terminal)}
              >
                <Ionicons name="alert-circle-outline" size={15} color={UI.bad} />
                <Text style={s.alertRowText} numberOfLines={1}>
                  {alert.message}
                </Text>
                <Text style={s.alertRowMeta}>{formatDateTime(alert.at)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionHeadLeft}>
              <Text style={s.sectionTitle}>Carte globale des TPE</Text>
              <Text style={s.sectionSub}>
                Cliquez sur un terminal dans le tableau pour le centrer sur la carte.
                Les cercles representent les zones de geofence configurees.
              </Text>
            </View>
            <SectionBadge label={`${positioned.length} positions`} tone="info" />
          </View>

          <TerminalMap
            terminals={filtered}
            selectedTerminalId={selectedTerminal?.id}
            onSelectTerminal={(terminal) => {
              setSelectedTerminal(terminal);
              setMapTerminal(terminal);
            }}
            height={480}
          />
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionHeadLeft}>
              <Text style={s.sectionTitle}>Tableau principal des TPE</Text>
              <Text style={s.sectionSub}>
                Filtres et recherche s&apos;appliquent apres deduplication. Cliquez sur une ligne
                pour centrer la carte.
              </Text>
            </View>
            <SectionBadge label={`${filtered.length} visible(s)`} tone="ok" />
          </View>

          <View style={s.filters}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={17} color={UI.muted2} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher par nom, serie, zone ou localisation..."
                placeholderTextColor={UI.faint}
                style={s.searchInput}
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} style={s.searchClear}>
                  <Ionicons name="close-circle" size={18} color={UI.muted2} />
                </Pressable>
              ) : null}
            </View>

            <View style={s.filterChips}>
              {(['ALL', 'ONLINE', 'OFFLINE', 'OUTSIDE_ZONE'] as StatusFilter[]).map((f) => (
                <Pressable
                  key={f}
                  style={[s.filterChip, statusFilter === f && s.filterChipActive]}
                  onPress={() => setStatusFilter(f)}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      statusFilter === f && s.filterChipTextActive,
                    ]}
                  >
                    {f === 'ALL'
                      ? `Tous (${currentDevices.length})`
                      : f === 'ONLINE'
                        ? 'En ligne'
                        : f === 'OFFLINE'
                          ? 'Offline'
                          : 'Hors zone'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {loading ? (
            <View style={s.state}>
              <ActivityIndicator color={UI.info} size="large" />
              <Text style={s.stateText}>Chargement des terminaux...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.state}>
              <Ionicons name="search-outline" size={32} color={UI.muted2} />
              <Text style={s.stateText}>Aucun terminal ne correspond aux filtres.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.table}>
                <TableHeader />

                {filtered.map((terminal, idx) => (
                  <TerminalRow
                    key={terminal.id}
                    terminal={terminal}
                    selected={selectedTerminal?.id === terminal.id}
                    isEven={idx % 2 === 0}
                    onFocusMap={() => focusOnMap(terminal)}
                    onOpenMap={() => setMapTerminal(terminal)}
                    onOpenHistory={() => openHistory(terminal)}
                    onEditGeofence={() => setGeofenceTerminal(terminal)}
                  />
                ))}
              </View>
            </ScrollView>
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

function HeroChip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.heroChip}>
      <Ionicons name={icon} size={13} color={UI.info} />
      <Text style={s.heroChipText}>{text}</Text>
    </View>
  );
}

function KpiCard({
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
    <View style={s.kpiCard}>
      <View style={[s.kpiIcon, { backgroundColor: toneBg(tone) }]}>
        <Ionicons name={icon} size={20} color={toneColor(tone)} />
      </View>
      <Text style={[s.kpiValue, { color: value > 0 && tone !== 'info' ? toneColor(tone) : UI.ink }]}>
        {value}
      </Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function SectionBadge({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  return (
    <View style={[s.sectionBadge, { backgroundColor: toneBg(tone) }]}>
      <Text style={[s.sectionBadgeText, { color: toneColor(tone) }]}>{label}</Text>
    </View>
  );
}

function TableHeader() {
  const columns = [
    'Nom du TPE',
    'Statut',
    'Fraicheur',
    'Batterie',
    'Reseau',
    'Signal',
    'Stockage',
    'Zone',
    'Localisation',
    'Connexions',
    'Derniere connexion',
    'Derniere deconnexion',
    'Hors zone',
    'Actions',
  ];

  return (
    <View style={[s.row, s.headerRow]}>
      {columns.map((col, i) => (
        <Text key={col} style={[s.headerCell, columnStyle(i)]}>
          {col.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

function TerminalRow({
  terminal,
  selected,
  isEven,
  onFocusMap,
  onOpenMap,
  onOpenHistory,
  onEditGeofence,
}: {
  terminal: TerminalSummary;
  selected: boolean;
  isEven: boolean;
  onFocusMap: () => void;
  onOpenMap: () => void;
  onOpenHistory: () => void;
  onEditGeofence: () => void;
}) {
  const online = getConnectivityStatus(terminal) === 'ONLINE';
  const outside = getGeofenceStatus(terminal) === 'outside';

  return (
    <Pressable
      style={[
        s.row,
        !isEven && s.rowAlt,
        outside && s.rowWarn,
        selected && s.rowSelected,
      ]}
      onPress={onFocusMap}
    >
      <View style={[s.cell, columnStyle(0)]}>
        <Text style={s.primaryCell} numberOfLines={1}>
          {getTerminalName(terminal)}
        </Text>
        <Text style={s.secondaryCell} numberOfLines={1}>
          {terminal.serialNumber ?? terminal.deviceKey}
        </Text>
      </View>

      <View style={[s.cell, columnStyle(1)]}>
        <View style={[s.statusBadge, { backgroundColor: online ? UI.okBg : UI.badBg }]}>
          <View style={[s.statusDot, { backgroundColor: online ? UI.ok : UI.bad }]} />
          <Text style={[s.statusText, { color: online ? UI.ok : UI.bad }]}>
            {online ? 'En ligne' : 'Offline'}
          </Text>
        </View>
      </View>

      <Text style={[s.cell, s.textCell, columnStyle(2)]}>
        {formatFreshness(terminal)}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(3)]}>
        {formatBattery(terminal.lastBatteryPercent)}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(4)]}>
        {formatNetwork(terminal.lastNetworkType)}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(5)]}>
        {formatSignal(terminal.lastSignalLevel)}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(6)]}>
        {formatStorageFree(terminal.lastStorageFreeMb, terminal.lastStorageTotalMb)}
      </Text>

      <View style={[s.cell, columnStyle(7)]}>
        <Text style={s.primaryCell} numberOfLines={1}>
          {terminal.authorizedZoneName ?? 'Zone personnalisee'}
        </Text>
        <GeofenceStatusBadge terminal={terminal} compact />
      </View>

      <Text style={[s.cell, s.textCell, columnStyle(8)]} numberOfLines={1}>
        {terminal.lastAddressLine ?? terminal.city ?? 'â€”'}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(9)]}>
        {terminal.totalConnectionCount ?? 0}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(10)]}>
        {formatDateTime(terminal.lastConnectedAt)}
      </Text>
      <Text style={[s.cell, s.textCell, columnStyle(11)]}>
        {formatDateTime(terminal.lastDisconnectedAt)}
      </Text>

      <View style={[s.cell, columnStyle(12)]}>
        <GeofenceStatusBadge terminal={terminal} />
      </View>

      <View style={[s.cell, columnStyle(13), s.actions]}>
        <Pressable
          style={[s.actionBtn, selected && s.actionBtnActive]}
          onPress={onFocusMap}
          hitSlop={4}
        >
          <Ionicons
            name={selected ? 'map' : 'map-outline'}
            size={17}
            color={selected ? UI.info : UI.muted2}
          />
        </Pressable>

        <Pressable style={s.actionBtn} onPress={onOpenMap} hitSlop={4}>
          <Ionicons name="eye-outline" size={17} color={UI.ink2} />
        </Pressable>

        <Pressable style={s.actionBtn} onPress={onOpenHistory} hitSlop={4}>
          <Ionicons name="time-outline" size={17} color={UI.ink2} />
        </Pressable>

        <Pressable style={s.actionBtn} onPress={onEditGeofence} hitSlop={4}>
          <Ionicons name="locate-outline" size={17} color={UI.warn} />
        </Pressable>

        <Pressable
          style={s.actionBtn}
          onPress={() => router.push(`/terminal/${terminal.id}` as any)}
          hitSlop={4}
        >
          <Ionicons name="open-outline" size={17} color={UI.ink2} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function columnStyle(index: number) {
  const widths = [220, 120, 130, 100, 120, 100, 120, 200, 200, 110, 170, 170, 150, 190];
  return { width: widths[index] ?? 120 };
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },
  content: {
    padding: 18,
    gap: 18,
    paddingBottom: 48,
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
    borderRadius: 28,
    backgroundColor: UI.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    padding: 22,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    shadowColor: '#0F2940',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 36,
    elevation: 10,
  },
  heroCopy: {
    flex: 1,
  },
  overline: {
    color: UI.info,
    fontWeight: '900',
    letterSpacing: 1.4,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: UI.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: UI.muted,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 820,
  },
  heroChips: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: UI.infoBg,
  },
  heroChipText: {
    color: UI.info,
    fontWeight: '800',
    fontSize: 12,
  },
  heroAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: UI.infoBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexShrink: 0,
  },
  heroAlertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  heroAlertDotActive: {
    backgroundColor: UI.bad,
  },
  heroAlertText: {
    color: UI.info,
    fontWeight: '900',
    fontSize: 13,
  },
  heroAlertTextActive: {
    color: UI.bad,
  },

  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: UI.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: 16,
    shadowColor: '#0F2940',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 6,
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    marginTop: 16,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    marginTop: 6,
    color: UI.muted,
    fontWeight: '700',
    fontSize: 13,
  },

  alertPanel: {
    backgroundColor: '#FFF6F6',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0C8C8',
    padding: 16,
  },
  alertPanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  alertPanelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI.bad,
  },
  alertPanelTitle: {
    color: UI.bad,
    fontSize: 14,
    fontWeight: '900',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#F0D4D4',
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
    fontSize: 11,
    flexShrink: 0,
  },

  section: {
    backgroundColor: UI.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: 18,
    shadowColor: '#0F2940',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 8,
  },
  sectionHead: {
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionHeadLeft: {
    flex: 1,
  },
  sectionTitle: {
    color: UI.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionSub: {
    marginTop: 4,
    color: UI.muted,
    lineHeight: 20,
    maxWidth: 760,
    fontSize: 13,
  },
  sectionBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  sectionBadgeText: {
    fontWeight: '900',
    fontSize: 12,
  },

  filters: {
    gap: 12,
    marginBottom: 14,
  },
  searchWrap: {
    minHeight: 48,
    borderRadius: 14,
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
    fontSize: 14,
  },
  searchClear: {
    padding: 2,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: UI.infoBg,
    borderColor: '#B8D4FF',
  },
  filterChipText: {
    color: UI.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: UI.info,
  },

  table: {
    minWidth: 2000,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: UI.stroke2,
  },
  rowAlt: {
    backgroundColor: '#FAFCFF',
  },
  rowWarn: {
    backgroundColor: '#FFFBF0',
  },
  rowSelected: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#B8D4FF',
  },
  headerRow: {
    borderTopWidth: 1,
    borderTopColor: UI.stroke2,
    backgroundColor: UI.card2,
    borderBottomWidth: 1.5,
    borderBottomColor: UI.stroke,
  },
  headerCell: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    color: UI.muted2,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 13,
    justifyContent: 'center',
  },
  primaryCell: {
    color: UI.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryCell: {
    color: UI.muted,
    marginTop: 3,
    fontSize: 11,
  },
  textCell: {
    color: UI.ink2,
    fontWeight: '700',
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnActive: {
    backgroundColor: UI.infoBg,
    borderColor: '#B8D4FF',
  },
  state: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    color: UI.muted,
    fontWeight: '700',
    fontSize: 14,
  },
});
