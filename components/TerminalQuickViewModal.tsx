import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import type { TerminalSummary } from '../lib/types';
import {
  formatBattery,
  formatDateTime,
  formatFreshness,
  formatNetwork,
  formatSignal,
  formatStorageFree,
  getTerminalName,
  terminalHasGeofence,
  terminalHasPosition,
} from '../lib/terminalPresentation';
import { TerminalMap } from './TerminalMap';

export function TerminalQuickViewModal({
  terminal,
  visible,
  onClose,
}: {
  terminal: TerminalSummary | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!terminal) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{getTerminalName(terminal)}</Text>
              <Text style={s.sub}>{terminal.serialNumber ?? terminal.deviceKey}</Text>
            </View>
            <Pressable style={s.close} onPress={onClose}>
              <Ionicons name="close" size={18} color={UI.ink} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {terminalHasPosition(terminal) ? (
              <TerminalMap terminals={[terminal]} selectedTerminalId={terminal.id} height={220} />
            ) : (
              <View style={s.emptyMap}>
                <Text style={s.emptyMapText}>Aucune position GPS disponible</Text>
              </View>
            )}

            <View style={s.grid}>
              <Metric label="Statut" value={terminal.connectivityStatus ?? 'OFFLINE'} />
              <Metric label="Fraicheur" value={formatFreshness(terminal)} />
              <Metric label="Batterie" value={formatBattery(terminal.lastBatteryPercent)} />
              <Metric label="Reseau" value={formatNetwork(terminal.lastNetworkType)} />
              <Metric label="Signal" value={formatSignal(terminal.lastSignalLevel)} />
              <Metric
                label="Stockage"
                value={formatStorageFree(
                  terminal.lastStorageFreeMb,
                  terminal.lastStorageTotalMb,
                )}
              />
              <Metric label="Connexions" value={String(terminal.totalConnectionCount ?? 0)} />
              <Metric
                label="Hors zone"
                value={terminal.outsideAuthorizedZone ? 'Oui' : 'Non'}
                tone={terminal.outsideAuthorizedZone ? 'warn' : 'ok'}
              />
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Localisation</Text>
              <Text style={s.line}>
                {terminal.lastAddressLine ?? terminal.city ?? 'Non renseignee'}
              </Text>
              <Text style={s.lineMuted}>{terminal.country ?? '—'}</Text>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Zone autorisee</Text>
              {terminalHasGeofence(terminal) ? (
                <>
                  <Text style={s.line}>{terminal.authorizedZoneName ?? 'Zone sans nom'}</Text>
                  <Text style={s.lineMuted}>
                    Centre: {terminal.baseLatitude?.toFixed(5)}, {terminal.baseLongitude?.toFixed(5)}
                  </Text>
                  <Text style={s.lineMuted}>Rayon: {terminal.alertRadiusMeters} m</Text>
                </>
              ) : (
                <Text style={s.lineMuted}>Aucune geofence definie</Text>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Connexions</Text>
              <Text style={s.lineMuted}>
                Derniere connexion: {formatDateTime(terminal.lastConnectedAt)}
              </Text>
              <Text style={s.lineMuted}>
                Derniere deconnexion: {formatDateTime(terminal.lastDisconnectedAt)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Metric({
  label,
  value,
  tone = 'info',
}: {
  label: string;
  value: string;
  tone?: 'info' | 'ok' | 'warn';
}) {
  const bg = tone === 'warn' ? UI.warnBg : tone === 'ok' ? UI.okBg : UI.infoBg;
  const color = tone === 'warn' ? UI.warn : tone === 'ok' ? UI.ok : UI.info;

  return (
    <View style={[s.metric, { backgroundColor: bg }]}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18,50,74,0.42)',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: UI.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: UI.stroke,
    maxHeight: '92%',
    overflow: 'hidden',
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    color: UI.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  sub: {
    color: UI.muted,
    marginTop: 4,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMap: {
    height: 160,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMapText: {
    color: UI.muted,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metric: {
    width: '48%',
    borderRadius: 18,
    padding: 12,
  },
  metricLabel: {
    color: UI.muted2,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
  },
  section: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: UI.stroke2,
    paddingTop: 14,
  },
  sectionTitle: {
    color: UI.ink,
    fontWeight: '900',
    fontSize: 15,
    marginBottom: 8,
  },
  line: {
    color: UI.ink2,
    fontWeight: '700',
  },
  lineMuted: {
    color: UI.muted,
    marginTop: 4,
  },
});
