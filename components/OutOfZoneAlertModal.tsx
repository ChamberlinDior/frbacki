import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MovementAlert } from '../lib/types';
import { UI } from '../constants/theme';

type Props = {
  alert: MovementAlert | null;
  visible: boolean;
  acknowledging: boolean;
  onAcknowledge: () => void;
};

function formatDate(value?: string | null): string {
  if (!value) return 'Maintenant';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR');
}

function formatDistance(value?: number | null): string {
  if (value == null) return 'Distance indisponible';
  return `${Math.round(value)} m hors zone`;
}

export function OutOfZoneAlertModal({
  alert,
  visible,
  acknowledging,
  onAcknowledge,
}: Props) {
  if (!alert) return null;

  const terminalLabel = alert.terminalName ?? `Terminal #${alert.terminalId}`;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={s.backdrop}>
        <BlurView intensity={Platform.OS === 'ios' ? 30 : 10} tint="dark" style={s.blur}>
          <View style={s.card}>
            <View style={s.header}>
              <View style={s.iconWrap}>
                <Ionicons name="alert-circle" size={28} color="#fff" />
              </View>

              <View style={s.headerText}>
                <Text style={s.eyebrow}>Alerte critique geofence</Text>
                <Text style={s.title}>TP hors zone autorisee</Text>
                <Text style={s.subtitle}>
                  Une confirmation est requise pour couper la sirene et verrouiller ce cycle d alerte.
                </Text>
              </View>
            </View>

            <View style={s.body}>
              <InfoRow label="Terminal" value={terminalLabel} />
              <InfoRow label="Heure" value={formatDate(alert.triggeredAt)} />
              <InfoRow label="Distance" value={formatDistance(alert.distanceFromBase)} />
              <InfoRow label="Zone" value={alert.authorizedZoneName ?? 'Zone personnalisee'} />
              <InfoRow label="Statut" value={alert.acknowledged ? 'Hors zone confirmee' : 'Hors zone active'} />
            </View>

            <View style={s.actions}>
              <Pressable
                style={s.secondaryBtn}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/telemetry',
                    params: { terminalId: String(alert.terminalId) },
                  } as any)
                }
              >
                <Ionicons name="map-outline" size={16} color={UI.info} />
                <Text style={s.secondaryText}>Voir sur la carte</Text>
              </Pressable>

              <Pressable
                style={[s.primaryBtn, acknowledging && s.primaryBtnBusy]}
                disabled={acknowledging}
                onPress={onAcknowledge}
              >
                {acknowledging ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                )}
                <Text style={s.primaryText}>J ai vu l alerte</Text>
              </Pressable>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 18, 31, 0.46)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  blur: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 28,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: 'rgba(10, 24, 39, 0.78)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 24,
    shadowColor: '#04101E',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 28,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#D64545',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D64545',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: '#F5B7B7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.74)',
    lineHeight: 20,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    marginTop: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#D64545',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnBusy: {
    opacity: 0.72,
  },
  primaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 241, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(184, 212, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: '#DDEBFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
