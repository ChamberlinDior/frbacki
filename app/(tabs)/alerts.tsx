import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  Switch,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { alertsApi, terminalsApi } from '../../lib/api';
import type { AlertResponse, EventSeverity, TerminalSummary } from '../../lib/types';
import { UI, toneBg, toneColor } from '../../constants/theme';
import { NetworkErrorBanner } from '../../components/NetworkErrorBanner';
import { AlertRouteMap } from '../../components/AlertRouteMap';
import { GeofenceStatusBadge } from '../../components/GeofenceStatusBadge';
import { useAlerts } from '../../contexts/AlertContext';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { getGeofenceAlertMessage } from '../../lib/geofenceUtils';
import { getTerminalName } from '../../lib/terminalPresentation';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_TONE: Record<EventSeverity, 'ok' | 'warn' | 'bad' | 'info'> = {
  INFO: 'info',
  WARN: 'warn',
  CRITICAL: 'bad',
};

const SEVERITY_LABEL: Record<EventSeverity, string> = {
  INFO: 'Info',
  WARN: 'Attention',
  CRITICAL: 'Critique',
};

const SEVERITY_RANK: Record<EventSeverity, number> = {
  CRITICAL: 3,
  WARN: 2,
  INFO: 1,
};

const EVENT_LABELS: Record<string, string> = {
  OFFLINE: 'Hors ligne',
  BACK_ONLINE: 'Retour en ligne',
  LOW_BATTERY: 'Batterie faible',
  APP_CRASH: 'Plantage application',
  SIM_CHANGE: 'Changement SIM',
  IMEI_CHANGE: 'Changement IMEI',
  GPS_ANOMALY: 'Anomalie GPS',
  STORAGE_LOW: 'Stockage faible',
  REBOOT: 'Redemarrage',
  NETWORK_LOSS: 'Perte reseau',
  CUSTOM: 'Alerte personnalisee',
};

const EVENT_ICONS: Record<string, string> = {
  OFFLINE: 'cloud-offline-outline',
  BACK_ONLINE: 'cloud-done-outline',
  LOW_BATTERY: 'battery-dead-outline',
  APP_CRASH: 'bug-outline',
  SIM_CHANGE: 'swap-horizontal-outline',
  IMEI_CHANGE: 'finger-print-outline',
  GPS_ANOMALY: 'locate-outline',
  STORAGE_LOW: 'archive-outline',
  REBOOT: 'refresh-circle-outline',
  NETWORK_LOSS: 'wifi-outline',
  CUSTOM: 'notifications-outline',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types & grouping logic
// ─────────────────────────────────────────────────────────────────────────────

type SeverityFilter = 'ALL' | EventSeverity;

type GroupedAlert = {
  terminalId: number;
  totalCount: number;
  criticalCount: number;
  warnCount: number;
  highestSeverity: EventSeverity;
  latestAlert: AlertResponse;
  eventTypes: string[];
  alertIds: number[];
};

type InternalGroupedAlert = GroupedAlert & {
  businessKeys: Set<string>;
};

function toTimestamp(value?: string | null): number {
  if (!value) return 0;

  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatDateLabel(iso?: string | null): string {
  if (!iso) return '—';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);

  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Cette fonction empêche la même alerte métier de gonfler le compteur.
 *
 * Exemple :
 * - OUTSIDE_ZONE répété 20 fois pour le même TPE encore hors zone = 1 seule alerte affichée.
 * - Le backend peut avoir 20 lignes, mais l’interface affiche 1 anomalie active.
 *
 * Le vrai réarmement doit venir de Dashboard / Telemetry :
 * inside -> outside = nouvelle alarme
 * outside -> outside = pas de nouvelle alarme
 * outside -> inside = réarmement
 * inside -> outside = nouvelle alarme
 */
function getAlertBusinessKey(alert: AlertResponse): string {
  const type = String(alert.type ?? 'CUSTOM').trim().toUpperCase();
  const message = String(alert.message ?? '').trim().toLowerCase();

  const isGeofenceLike =
    type === 'GEOFENCE_EXIT' ||
    type === 'OUTSIDE_ZONE' ||
    message.includes('hors zone') ||
    message.includes('outside') ||
    message.includes('geofence') ||
    message.includes('zone autorisée') ||
    message.includes('zone autorisee');

  if (isGeofenceLike) {
    return 'GEOFENCE_OUTSIDE_ACTIVE';
  }

  return type || 'CUSTOM';
}

function groupAlertsByTerminal(alerts: AlertResponse[]): GroupedAlert[] {
  const map = new Map<number, InternalGroupedAlert>();

  for (const alert of alerts) {
    const businessKey = getAlertBusinessKey(alert);
    const current = map.get(alert.terminalId);
    const isCritical = alert.severity === 'CRITICAL';
    const isWarn = alert.severity === 'WARN';

    if (!current) {
      map.set(alert.terminalId, {
        terminalId: alert.terminalId,
        totalCount: 1,
        criticalCount: isCritical ? 1 : 0,
        warnCount: isWarn ? 1 : 0,
        highestSeverity: alert.severity,
        latestAlert: alert,
        eventTypes: [alert.type],
        alertIds: [alert.id],
        businessKeys: new Set([businessKey]),
      });

      continue;
    }

    current.alertIds.push(alert.id);

    if (toTimestamp(alert.eventTimestamp) > toTimestamp(current.latestAlert.eventTimestamp)) {
      current.latestAlert = alert;
    }

    const isNewBusinessAlert = !current.businessKeys.has(businessKey);

    if (isNewBusinessAlert) {
      current.businessKeys.add(businessKey);
      current.totalCount++;

      if (isCritical) current.criticalCount++;
      if (isWarn) current.warnCount++;

      if (!current.eventTypes.includes(alert.type)) {
        current.eventTypes.push(alert.type);
      }
    } else {
      /**
       * Même alerte métier répétée par le backend.
       * On garde l’id pour permettre l’acquittement de toutes les lignes,
       * mais on n’augmente PAS le compteur visible.
       */
      if (!current.eventTypes.includes(alert.type)) {
        current.eventTypes.push(alert.type);
      }
    }

    if ((SEVERITY_RANK[alert.severity] ?? 0) > (SEVERITY_RANK[current.highestSeverity] ?? 0)) {
      current.highestSeverity = alert.severity;
    }
  }

  return [...map.values()]
    .map(({ businessKeys, ...group }) => group)
    .sort((a, b) => {
      const sDiff =
        (SEVERITY_RANK[b.highestSeverity] ?? 0) -
        (SEVERITY_RANK[a.highestSeverity] ?? 0);

      if (sDiff !== 0) return sDiff;

      return toTimestamp(b.latestAlert.eventTimestamp) - toTimestamp(a.latestAlert.eventTimestamp);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [terminals, setTerminals] = useState<TerminalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [acking, setAcking] = useState<Set<number>>(new Set());
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null);
  const [adminLocation, setAdminLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const previousCountsRef = useRef<Map<number, number>>(new Map());
  const alertsReadyRef = useRef(false);

  const {
    alerts: liveMovementAlerts,
    triggeredCount: liveTriggeredCount,
    soundEnabled,
    setSoundEnabled,
    testSound,
    isAlarmActive,
    stopAlarm,
  } = useAlerts();

  const terminalsById = useMemo(
    () => new Map(terminals.map((t) => [t.id, t])),
    [terminals],
  );

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [alertPage, terminalList] = await Promise.all([
        alertsApi.list(0, 200),
        terminalsApi.list(),
      ]);

      setAlerts(alertPage.content);
      setTerminals(terminalList);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement des alertes.');
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
    void loadData();
  }, [liveMovementAlerts, loadData]);

  useEffect(() => {
    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startAdminTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') return;

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      if (mounted) {
        setAdminLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 1,
          timeInterval: 3000,
        },
        (pos) => {
          if (!mounted) return;

          setAdminLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
      );
    }

    startAdminTracking().catch(() => {});

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const groupedAlerts = useMemo(() => groupAlertsByTerminal(alerts), [alerts]);

  /**
   * Important :
   * Cette page ne déclenche plus la sirène.
   * Elle met seulement ses compteurs internes à jour.
   *
   * Le son doit être déclenché uniquement par les vues qui connaissent
   * la transition réelle du TPE :
   * inside -> outside.
   */
  useEffect(() => {
    if (!alertsReadyRef.current) {
      alertsReadyRef.current = true;

      groupedAlerts.forEach((g) => {
        previousCountsRef.current.set(g.terminalId, g.totalCount);
      });

      return;
    }

    groupedAlerts.forEach((g) => {
      previousCountsRef.current.set(g.terminalId, g.totalCount);
    });
  }, [groupedAlerts]);

  const filtered = useMemo(
    () =>
      filter === 'ALL'
        ? groupedAlerts
        : groupedAlerts.filter((g) => g.highestSeverity === filter),
    [groupedAlerts, filter],
  );

  const counters = useMemo(
    () => ({
      terminals: groupedAlerts.length,
      critical: groupedAlerts.filter((g) => g.highestSeverity === 'CRITICAL').length,
      warning: groupedAlerts.filter((g) => g.highestSeverity === 'WARN').length,
      totalEvents: groupedAlerts.reduce((sum, g) => sum + g.totalCount, 0),
    }),
    [groupedAlerts],
  );

  const selectedTerminal =
    (selectedTerminalId != null ? terminalsById.get(selectedTerminalId) : null) ?? null;

  async function handleAcknowledgeAll(group: GroupedAlert) {
    const count = group.alertIds.length;

    Alert.alert(
      'Acquitter tout',
      `Confirmer l'acquittement de ${count} ligne${count > 1 ? 's' : ''} d'alerte pour ce TPE ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Acquitter tout',
          onPress: async () => {
            setAcking((prev) => {
              const next = new Set(prev);
              group.alertIds.forEach((id) => next.add(id));
              return next;
            });

            try {
              await Promise.all(group.alertIds.map((id) => alertsApi.acknowledge(id)));
              setAlerts((prev) => prev.filter((a) => !group.alertIds.includes(a.id)));
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? "Impossible d'acquitter les alertes.");
            } finally {
              setAcking((prev) => {
                const next = new Set(prev);
                group.alertIds.forEach((id) => next.delete(id));
                return next;
              });
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.terminalId)}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={UI.info} />
        }
        ListHeaderComponent={
          <>
            {isAlarmActive ? (
              <View style={s.alarmBanner}>
                <View style={s.alarmLeft}>
                  <View style={s.alarmIconWrap}>
                    <Ionicons name="warning" size={22} color="#fff" />
                  </View>

                  <View style={s.alarmText}>
                    <Text style={s.alarmTitle}>ALARME EN COURS</Text>
                    <Text style={s.alarmSub}>
                      {liveTriggeredCount > 0
                        ? `${liveTriggeredCount} mouvement${liveTriggeredCount > 1 ? 's' : ''} detecte${liveTriggeredCount > 1 ? 's' : ''} — son actif`
                        : "Son d'alerte en cours"}
                    </Text>
                  </View>
                </View>

                <Pressable style={s.alarmStopBtn} onPress={stopAlarm}>
                  <Ionicons name="volume-mute-outline" size={18} color={UI.bad} />
                  <Text style={s.alarmStopText}>Couper l'alarme</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={s.hero}>
              <View style={s.heroCopy}>
                <Text style={s.overline}>Centre d'alertes</Text>
                <Text style={s.title}>Alertes techniques</Text>
                <Text style={s.subtitle}>
                  Une ligne par TPE — le compteur affiche les anomalies actives uniques.
                  Une même sortie de zone répétée par le système ne gonfle plus le compteur.
                </Text>
              </View>

              <View style={s.heroSide}>
                <View style={[s.heroChip, counters.critical > 0 && s.heroChipCritical]}>
                  <Ionicons
                    name="notifications"
                    size={15}
                    color={counters.critical > 0 ? UI.bad : UI.info}
                  />
                  <Text style={[s.heroChipText, counters.critical > 0 && s.heroChipTextCritical]}>
                    {counters.terminals} TPE{counters.terminals > 1 ? 's' : ''} en alerte
                  </Text>
                </View>

                {Platform.OS === 'web' ? (
                  <>
                    <View style={s.soundBox}>
                      <View style={s.soundTextWrap}>
                        <Text style={s.soundLabel}>Alertes sonores</Text>
                        <Text style={s.soundHint}>Vue web admin uniquement</Text>
                      </View>

                      <Switch
                        value={soundEnabled}
                        onValueChange={setSoundEnabled}
                        trackColor={{ true: UI.info, false: UI.stroke }}
                      />
                    </View>

                    <Pressable style={s.soundTestBtn} onPress={() => void testSound()}>
                      <Ionicons name="volume-high-outline" size={15} color={UI.info} />
                      <Text style={s.soundTestText}>Tester le son</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            {error ? <NetworkErrorBanner message={error} onRetry={() => loadData()} /> : null}

            <View style={s.kpis}>
              <KpiCard
                label="TPE en alerte"
                value={counters.terminals}
                tone="info"
                icon="hardware-chip-outline"
              />
              <KpiCard
                label="Niveaux critiques"
                value={counters.critical}
                tone="bad"
                icon="alert-circle-outline"
                highlight={counters.critical > 0}
              />
              <KpiCard
                label="Niveaux attention"
                value={counters.warning}
                tone="warn"
                icon="warning-outline"
              />
              <KpiCard
                label="Anomalies actives"
                value={counters.totalEvents}
                tone="ok"
                icon="albums-outline"
              />
            </View>

            {selectedTerminal ? (
              <View style={s.routePanel}>
                <View style={s.routePanelHeader}>
                  <View style={s.routePanelDot} />
                  <Text style={s.routePanelLabel}>Intervention en cours</Text>
                </View>

                <View style={s.routeHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.routeTitle}>{getTerminalName(selectedTerminal)}</Text>
                    <Text style={s.routeSubMuted}>
                      {getGeofenceAlertMessage(selectedTerminal) ??
                        'Trajet de rapprochement vers le TPE cible.'}
                    </Text>
                  </View>

                  <View style={s.routeHeadRight}>
                    <GeofenceStatusBadge terminal={selectedTerminal} />
                    <Pressable
                      style={s.routeCloseBtn}
                      onPress={() => setSelectedTerminalId(null)}
                    >
                      <Ionicons name="close" size={18} color={UI.muted} />
                    </Pressable>
                  </View>
                </View>

                <AlertRouteMap
                  adminLocation={adminLocation}
                  targetLocation={
                    selectedTerminal.lastGpsLat != null && selectedTerminal.lastGpsLng != null
                      ? {
                          latitude: selectedTerminal.lastGpsLat,
                          longitude: selectedTerminal.lastGpsLng,
                        }
                      : null
                  }
                  targetLabel={getTerminalName(selectedTerminal)}
                />

                <View style={s.routeActions}>
                  <Pressable
                    style={s.routeActionBtn}
                    onPress={() => router.push(`/terminal/${selectedTerminal.id}` as any)}
                  >
                    <Ionicons name="open-outline" size={16} color={UI.info} />
                    <Text style={s.routeActionBtnText}>Fiche TPE</Text>
                  </Pressable>

                  <Pressable
                    style={[s.routeActionBtn, s.routeActionBtnSecondary]}
                    onPress={() => setSelectedTerminalId(null)}
                  >
                    <Ionicons name="map-outline" size={16} color={UI.muted} />
                    <Text style={s.routeActionBtnTextSecondary}>Fermer le trajet</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={s.filtersRow}>
              {(['ALL', 'INFO', 'WARN', 'CRITICAL'] as SeverityFilter[]).map((severity) => (
                <Pressable
                  key={severity}
                  onPress={() => setFilter(severity)}
                  style={[
                    s.filterChip,
                    filter === severity && s.filterChipActive,
                    severity === 'CRITICAL' && filter === severity && s.filterChipCritical,
                    severity === 'WARN' && filter === severity && s.filterChipWarn,
                  ]}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      filter === severity && s.filterChipTextActive,
                      severity === 'CRITICAL' && filter === severity && s.filterChipTextCritical,
                      severity === 'WARN' && filter === severity && s.filterChipTextWarn,
                    ]}
                  >
                    {severity === 'ALL'
                      ? `Tous les TPE (${counters.terminals})`
                      : severity === 'INFO'
                        ? 'Info'
                        : severity === 'WARN'
                          ? `Attention (${counters.warning})`
                          : `Critique (${counters.critical})`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.resultText}>
              {filtered.length} TPE{filtered.length > 1 ? 's' : ''} visible
              {filtered.length > 1 ? 's' : ''}
              {filter !== 'ALL' ? ` — filtre : ${SEVERITY_LABEL[filter as EventSeverity]}` : ''}
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <GroupedAlertCard
            group={item}
            terminal={terminalsById.get(item.terminalId) ?? null}
            acknowledging={item.alertIds.some((id) => acking.has(id))}
            selected={selectedTerminalId === item.terminalId}
            onPress={() =>
              setSelectedTerminalId(
                selectedTerminalId === item.terminalId ? null : item.terminalId,
              )
            }
            onOpenTerminal={() => router.push(`/terminal/${item.terminalId}` as any)}
            onAcknowledgeAll={() => handleAcknowledgeAll(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={s.state}>
              <ActivityIndicator color={UI.info} size="large" />
              <Text style={s.stateText}>Chargement des alertes...</Text>
            </View>
          ) : (
            <View style={s.state}>
              <View style={s.stateIconWrap}>
                <Ionicons name="checkmark-circle" size={40} color={UI.ok} />
              </View>
              <Text style={s.emptyTitle}>Aucune alerte active</Text>
              <Text style={s.emptyText}>
                Le système ne remonte actuellement aucune anomalie.
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupedAlertCard
// ─────────────────────────────────────────────────────────────────────────────

function GroupedAlertCard({
  group,
  terminal,
  acknowledging,
  selected,
  onPress,
  onOpenTerminal,
  onAcknowledgeAll,
}: {
  group: GroupedAlert;
  terminal: TerminalSummary | null;
  acknowledging?: boolean;
  selected?: boolean;
  onPress: () => void;
  onOpenTerminal: () => void;
  onAcknowledgeAll: () => void;
}) {
  const tone = SEVERITY_TONE[group.highestSeverity] ?? 'info';
  const isCritical = group.highestSeverity === 'CRITICAL';
  const isGeofence = Boolean(terminal?.outsideAuthorizedZone);

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.card,
        isCritical && s.cardCritical,
        isGeofence && !isCritical && s.cardGeofence,
        selected && s.cardSelected,
      ]}
    >
      <View style={[s.cardAccent, { backgroundColor: toneColor(tone) }]} />

      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.cardBadges}>
            <View style={[s.severityBadge, { backgroundColor: toneBg(tone) }]}>
              <Ionicons name="alert-circle-outline" size={12} color={toneColor(tone)} />
              <Text style={[s.severityBadgeText, { color: toneColor(tone) }]}>
                {SEVERITY_LABEL[group.highestSeverity]}
              </Text>
            </View>

            <View style={[s.countBubble, isCritical && s.countBubbleCritical]}>
              <Text style={[s.countBubbleText, isCritical && s.countBubbleTextCritical]}>
                {group.totalCount} anomalie{group.totalCount > 1 ? 's' : ''} active
              </Text>
            </View>

            {isGeofence ? (
              <View style={s.geofencePill}>
                <Ionicons name="locate-outline" size={11} color={UI.bad} />
                <Text style={s.geofencePillText}>Geofence</Text>
              </View>
            ) : null}

            {selected ? (
              <View style={s.selectedPill}>
                <Ionicons name="map-outline" size={11} color={UI.info} />
                <Text style={s.selectedPillText}>Itineraire actif</Text>
              </View>
            ) : null}
          </View>

          <Text style={s.cardTime}>{formatDateLabel(group.latestAlert.eventTimestamp)}</Text>
        </View>

        <View style={s.terminalRow}>
          <Ionicons name="hardware-chip-outline" size={14} color={UI.info} />
          <Text style={s.terminalText}>
            {terminal ? getTerminalName(terminal) : `Terminal #${group.terminalId}`}
          </Text>
        </View>

        {terminal ? <GeofenceStatusBadge terminal={terminal} compact /> : null}

        {group.eventTypes.length > 0 ? (
          <View style={s.eventTypesRow}>
            {group.eventTypes.slice(0, 4).map((type) => (
              <View key={type} style={s.eventTypePill}>
                <Ionicons
                  name={(EVENT_ICONS[type] ?? 'notifications-outline') as any}
                  size={11}
                  color={UI.muted}
                />
                <Text style={s.eventTypePillText}>{EVENT_LABELS[type] ?? type}</Text>
              </View>
            ))}

            {group.eventTypes.length > 4 ? (
              <Text style={s.eventTypesMore}>+{group.eventTypes.length - 4} autres</Text>
            ) : null}
          </View>
        ) : null}

        {group.latestAlert.message ? (
          <Text style={s.message} numberOfLines={1}>
            Dernier : {group.latestAlert.message}
          </Text>
        ) : null}

        <View style={s.cardActions}>
          <Pressable style={[s.actionChip, s.actionChipRoute]} onPress={onPress}>
            <Ionicons name={selected ? 'map' : 'navigate-outline'} size={15} color={UI.info} />
            <Text style={s.actionChipTextRoute}>
              {selected ? 'Masquer trajet' : 'Voir le trajet'}
            </Text>
          </Pressable>

          <Pressable style={[s.actionChip, s.actionChipOpen]} onPress={onOpenTerminal}>
            <Ionicons name="open-outline" size={15} color={UI.muted} />
            <Text style={s.actionChipTextOpen}>Fiche TPE</Text>
          </Pressable>

          <Pressable
            style={[s.actionChip, s.actionChipAck, acknowledging && s.actionChipBusy]}
            onPress={onAcknowledgeAll}
            disabled={acknowledging}
          >
            {acknowledging ? (
              <ActivityIndicator color={UI.ok} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-done-outline" size={15} color={UI.ok} />
                <Text style={s.actionChipTextAck}>Tout acquitter</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KpiCard
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tone,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  icon: keyof typeof Ionicons.glyphMap;
  highlight?: boolean;
}) {
  return (
    <View style={[s.kpiCard, highlight && s.kpiCardHighlight]}>
      <View style={[s.kpiIcon, { backgroundColor: toneBg(tone) }]}>
        <Ionicons name={icon} size={18} color={toneColor(tone)} />
      </View>
      <Text style={[s.kpiValue, highlight && { color: toneColor(tone) }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },

  alarmBanner: {
    backgroundColor: '#12020A',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#8B1A1A',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#D64545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 14,
  },
  alarmLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alarmIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alarmText: {
    flex: 1,
  },
  alarmTitle: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  alarmSub: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    marginTop: 3,
  },
  alarmStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(214,69,69,0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(214,69,69,0.38)',
    flexShrink: 0,
  },
  alarmStopText: {
    color: UI.bad,
    fontWeight: '900',
    fontSize: 13,
  },

  hero: {
    backgroundColor: UI.white,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 20,
    flexDirection: 'row',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  overline: {
    color: UI.info,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: UI.ink,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: UI.muted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 760,
  },
  heroSide: {
    justifyContent: 'flex-start',
    gap: 10,
    alignItems: 'flex-end',
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: UI.infoBg,
  },
  heroChipCritical: {
    backgroundColor: UI.badBg,
  },
  heroChipText: {
    color: UI.info,
    fontWeight: '800',
    fontSize: 12,
  },
  heroChipTextCritical: {
    color: UI.bad,
  },
  soundBox: {
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: UI.stroke,
  },
  soundTextWrap: {
    flex: 1,
  },
  soundLabel: {
    color: UI.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  soundHint: {
    marginTop: 2,
    color: UI.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  soundTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: UI.infoBg,
  },
  soundTestText: {
    color: UI.info,
    fontWeight: '900',
    fontSize: 12,
  },

  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: UI.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    padding: 14,
  },
  kpiCardHighlight: {
    borderColor: '#F2C8C8',
    backgroundColor: '#FFF9F9',
  },
  kpiIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    marginTop: 14,
    color: UI.ink,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    marginTop: 4,
    color: UI.muted,
    fontWeight: '700',
    fontSize: 12,
  },

  routePanel: {
    backgroundColor: UI.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: UI.stroke,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  routePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: UI.infoBg,
    borderBottomWidth: 1,
    borderBottomColor: '#D1E8FF',
  },
  routePanelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI.info,
  },
  routePanelLabel: {
    color: UI.info,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  routeHead: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  routeTitle: {
    color: UI.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  routeSubMuted: {
    marginTop: 5,
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  routeHeadRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  routeCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: UI.stroke2,
  },
  routeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: UI.infoBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  routeActionBtnSecondary: {
    backgroundColor: UI.card2,
  },
  routeActionBtnText: {
    color: UI.info,
    fontWeight: '900',
    fontSize: 13,
  },
  routeActionBtnTextSecondary: {
    color: UI.muted,
    fontWeight: '800',
    fontSize: 13,
  },

  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: UI.infoBg,
    borderColor: '#B8D4FF',
  },
  filterChipCritical: {
    backgroundColor: UI.badBg,
    borderColor: '#F2C8C8',
  },
  filterChipWarn: {
    backgroundColor: UI.warnBg,
    borderColor: '#FFE0A0',
  },
  filterChipText: {
    color: UI.muted,
    fontWeight: '800',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: UI.info,
  },
  filterChipTextCritical: {
    color: UI.bad,
  },
  filterChipTextWarn: {
    color: UI.warn,
  },
  resultText: {
    color: UI.muted2,
    fontWeight: '700',
    fontSize: 12,
  },

  card: {
    backgroundColor: UI.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCritical: {
    borderColor: '#F0C0C0',
    backgroundColor: '#FFF7F7',
  },
  cardGeofence: {
    borderColor: '#FFE0A0',
    backgroundColor: '#FFFBF0',
  },
  cardSelected: {
    borderColor: '#B8D4FF',
    backgroundColor: '#F4F9FF',
    shadowColor: UI.info,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  cardAccent: {
    width: 4,
    flexShrink: 0,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    flex: 1,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  countBubble: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: UI.infoBg,
    borderWidth: 1,
    borderColor: '#B8D4FF',
  },
  countBubbleCritical: {
    backgroundColor: UI.badBg,
    borderColor: '#F0C0C0',
  },
  countBubbleText: {
    color: UI.info,
    fontSize: 12,
    fontWeight: '900',
  },
  countBubbleTextCritical: {
    color: UI.bad,
  },
  geofencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: UI.badBg,
  },
  geofencePillText: {
    color: UI.bad,
    fontSize: 11,
    fontWeight: '900',
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: UI.infoBg,
  },
  selectedPillText: {
    color: UI.info,
    fontSize: 11,
    fontWeight: '900',
  },
  cardTime: {
    color: UI.muted2,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
  },
  terminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  terminalText: {
    color: UI.info,
    fontWeight: '800',
    fontSize: 14,
  },
  eventTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  eventTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: UI.stroke,
  },
  eventTypePillText: {
    color: UI.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  eventTypesMore: {
    color: UI.muted2,
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'center',
  },
  message: {
    marginTop: 6,
    color: UI.ink2,
    fontSize: 13,
    lineHeight: 19,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipRoute: {
    backgroundColor: UI.infoBg,
  },
  actionChipOpen: {
    backgroundColor: UI.card2,
  },
  actionChipAck: {
    backgroundColor: UI.okBg,
  },
  actionChipBusy: {
    minWidth: 110,
    justifyContent: 'center',
  },
  actionChipTextRoute: {
    color: UI.info,
    fontWeight: '900',
    fontSize: 12,
  },
  actionChipTextOpen: {
    color: UI.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  actionChipTextAck: {
    color: UI.ok,
    fontWeight: '900',
    fontSize: 12,
  },

  state: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    color: UI.muted,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 8,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: UI.okBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: UI.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  emptyText: {
    color: UI.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});
