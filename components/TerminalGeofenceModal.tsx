import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { UI } from '../constants/theme';
import { useTelemetryZones } from '../hooks/useTelemetryZones';
import {
  formatDistanceMeters,
  getGeofenceDistance,
  getGeofenceStatus,
  hasValidTerminalPosition,
} from '../lib/geofenceUtils';
import type { TerminalSummary, UpdateTerminalSettingsRequest } from '../lib/types';
import { getTerminalName } from '../lib/terminalPresentation';
import { MapEmbed } from './MapEmbed';
import { ZoneSelector } from './ZoneSelector';

export function TerminalGeofenceModal({
  terminal,
  visible,
  saving,
  onClose,
  onSave,
}: {
  terminal: TerminalSummary | null;
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: UpdateTerminalSettingsRequest) => Promise<void>;
}) {
  const [zoneName, setZoneName] = useState('');
  const [baseLat, setBaseLat] = useState('');
  const [baseLng, setBaseLng] = useState('');
  const [radius, setRadius] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('custom');
  const { presets, radiusPresets, toSettingsPayload } = useTelemetryZones();

  const hasPosition = hasValidTerminalPosition(terminal);
  const liveDistance = useMemo(() => getGeofenceDistance(terminal), [terminal]);
  const geofenceStatus = useMemo(() => getGeofenceStatus(terminal), [terminal]);

  useEffect(() => {
    const liveLat = terminal?.lastGpsLat;
    const liveLng = terminal?.lastGpsLng;

    setZoneName(terminal?.authorizedZoneName ?? '');
    setBaseLat(liveLat != null ? String(liveLat) : '');
    setBaseLng(liveLng != null ? String(liveLng) : '');
    setRadius(terminal?.alertRadiusMeters != null ? String(terminal.alertRadiusMeters) : '100');

    const preset = presets.find((item) => item.name === terminal?.authorizedZoneName);
    setSelectedZoneId(preset?.id ?? 'custom');
  }, [presets, terminal]);

  if (!terminal) return null;

  const radiusNumber = Number(radius);
  const invalidRadius = !Number.isFinite(radiusNumber) || radiusNumber <= 0;
  const saveDisabled = saving || !hasPosition || invalidRadius;

  async function submit() {
    if (!hasPosition || invalidRadius) return;

    const payload =
      toSettingsPayload(
        selectedZoneId,
        {
          latitude: Number(baseLat),
          longitude: Number(baseLng),
        },
        radiusNumber,
        zoneName,
      ) ?? {
        authorizedZoneName: zoneName || 'Zone personnalisee',
        baseLatitude: Number(baseLat),
        baseLongitude: Number(baseLng),
        alertRadiusMeters: radiusNumber,
      };

    await onSave(payload);
  }

  function applyPreset(zoneId: string) {
    setSelectedZoneId(zoneId);
    const selected = presets.find((item) => item.id === zoneId);
    if (!selected) return;
    setZoneName(selected.name);
    setRadius(String(selected.defaultRadiusMeters));
  }

  function useCurrentPosition() {
    if (!hasPosition) return;
    setBaseLat(String(terminal?.lastGpsLat ?? ''));
    setBaseLng(String(terminal?.lastGpsLng ?? ''));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Configurer la geofence</Text>
              <Text style={s.sub}>{getTerminalName(terminal)}</Text>
            </View>
            <Pressable style={s.close} onPress={onClose}>
              <Ionicons name="close" size={18} color={UI.ink} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <ZoneSelector zones={presets} selectedZoneId={selectedZoneId} onSelect={applyPreset} />

            <View style={s.infoBox}>
              <Ionicons name="locate-outline" size={16} color={UI.info} />
              <Text style={s.infoText}>
                Le centre de la geofence est base automatiquement sur la position actuelle du TPE.
              </Text>
            </View>

            {!hasPosition ? (
              <View style={s.warningBox}>
                <Ionicons name="alert-circle-outline" size={16} color={UI.bad} />
                <Text style={s.warningText}>
                  Position actuelle du TPE indisponible. La sauvegarde reste desactivee tant qu&apos;une position valide n&apos;est pas disponible.
                </Text>
              </View>
            ) : (
              <View style={s.refreshBox}>
                <Text style={s.refreshText}>
                  Derniere position connue detectee. Vous pouvez l&apos;utiliser comme centre de reference.
                </Text>
                <Pressable style={s.refreshBtn} onPress={useCurrentPosition}>
                  <Ionicons name="refresh-outline" size={15} color={UI.info} />
                  <Text style={s.refreshBtnText}>Reprendre la position actuelle</Text>
                </Pressable>
              </View>
            )}

            {hasPosition ? (
              <View style={s.mapWrap}>
                <MapEmbed
                  terminalId={terminal.id}
                  lat={terminal.lastGpsLat as number}
                  lng={terminal.lastGpsLng as number}
                  label={getTerminalName(terminal)}
                  height={190}
                  zoneName={zoneName || terminal.authorizedZoneName || undefined}
                  baseLatitude={Number(baseLat)}
                  baseLongitude={Number(baseLng)}
                  alertRadiusMeters={radiusNumber || undefined}
                  outsideAuthorizedZone={geofenceStatus === 'outside'}
                />
              </View>
            ) : null}

            <Field
              label="Nom de zone"
              value={zoneName}
              onChangeText={setZoneName}
              placeholder="Zone personnalisee"
            />

            <View style={s.readOnlyGrid}>
              <ReadOnlyField label="Latitude automatique" value={baseLat || '—'} />
              <ReadOnlyField label="Longitude automatique" value={baseLng || '—'} />
            </View>

            <Text style={s.label}>Rayon autorise</Text>
            <View style={s.radiusPresets}>
              {radiusPresets.map((item) => {
                const active = radius === String(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => setRadius(String(item))}
                    style={[s.radiusChip, active && s.radiusChipActive]}
                  >
                    <Text style={[s.radiusChipText, active && s.radiusChipTextActive]}>{item} m</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label="Rayon personnalise (metres)"
              value={radius}
              onChangeText={setRadius}
              placeholder="100"
              keyboardType="numeric"
            />

            <View style={s.summaryCard}>
              <SummaryRow label="Nom de la zone" value={zoneName || 'Zone personnalisee'} />
              <SummaryRow label="Rayon retenu" value={invalidRadius ? 'Valeur invalide' : `${radiusNumber} m`} />
              <SummaryRow label="Distance actuelle" value={formatDistanceMeters(liveDistance)} />
            </View>

            {geofenceStatus === 'outside' ? (
              <View style={s.alertBox}>
                <Ionicons name="alert-circle-outline" size={16} color={UI.bad} />
                <Text style={s.alertText}>
                  Ce terminal est actuellement hors de sa zone autorisee. Le cercle et les badges passeront en rouge.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={s.actions}>
            <Pressable style={s.ghost} onPress={onClose}>
              <Text style={s.ghostText}>Annuler</Text>
            </Pressable>
            <Pressable style={[s.primary, saveDisabled && s.primaryDisabled]} onPress={submit} disabled={saveDisabled}>
              {saving ? (
                <ActivityIndicator color={UI.white} />
              ) : (
                <Text style={s.primaryText}>Enregistrer</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={UI.faint}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.field, s.readOnlyField]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.readOnlyInput}>
        <Text style={s.readOnlyText}>{value}</Text>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
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
    padding: 18,
    maxHeight: '94%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    color: UI.ink,
    fontSize: 20,
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
  infoBox: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: UI.infoBg,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: UI.ink2,
    fontWeight: '600',
    lineHeight: 18,
  },
  warningBox: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: UI.badBg,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: UI.bad,
    fontWeight: '700',
    lineHeight: 18,
  },
  refreshBox: {
    marginTop: 12,
    marginBottom: 2,
    borderRadius: 16,
    backgroundColor: UI.card2,
    padding: 12,
    gap: 10,
  },
  refreshText: {
    color: UI.ink2,
    fontWeight: '600',
    lineHeight: 18,
  },
  refreshBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: UI.infoBg,
  },
  refreshBtnText: {
    color: UI.info,
    fontWeight: '800',
  },
  mapWrap: {
    marginTop: 14,
    marginBottom: 14,
  },
  field: {
    marginBottom: 12,
  },
  readOnlyGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  readOnlyField: {
    flex: 1,
  },
  label: {
    color: UI.ink2,
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    height: 48,
    backgroundColor: UI.card2,
    borderColor: UI.stroke,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: UI.ink,
  },
  readOnlyInput: {
    minHeight: 48,
    backgroundColor: '#EFF5FB',
    borderColor: UI.stroke,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  readOnlyText: {
    color: UI.ink,
    fontWeight: '700',
  },
  radiusPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: UI.card2,
  },
  radiusChipActive: {
    backgroundColor: UI.infoBg,
  },
  radiusChipText: {
    color: UI.muted,
    fontWeight: '800',
  },
  radiusChipTextActive: {
    color: UI.info,
  },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: UI.card2,
    padding: 12,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
  },
  summaryLabel: {
    color: UI.muted,
    fontWeight: '700',
  },
  summaryValue: {
    color: UI.ink,
    fontWeight: '800',
  },
  alertBox: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: UI.badBg,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  alertText: {
    flex: 1,
    color: UI.bad,
    fontWeight: '700',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  ghost: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: UI.ink2,
    fontWeight: '800',
  },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: UI.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: {
    opacity: 0.55,
  },
  primaryText: {
    color: UI.white,
    fontWeight: '900',
  },
});
