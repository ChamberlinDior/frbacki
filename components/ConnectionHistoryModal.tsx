import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { UI, toneBg, toneColor } from '../constants/theme';
import type { ConnectionHistoryItem } from '../lib/deviceIdentity';
import { formatDateTime } from '../lib/terminalPresentation';

export function ConnectionHistoryModal({
  visible,
  terminalName,
  loading,
  error,
  records,
  onClose,
}: {
  visible: boolean;
  terminalName?: string;
  loading?: boolean;
  error?: string | null;
  records: ConnectionHistoryItem[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Historique des connexions</Text>
              <Text style={s.sub}>{terminalName ?? 'Terminal'}</Text>
            </View>
            <Pressable style={s.close} onPress={onClose}>
              <Ionicons name="close" size={18} color={UI.ink} />
            </Pressable>
          </View>

          {loading ? (
            <View style={s.state}>
              <ActivityIndicator color={UI.info} />
            </View>
          ) : error ? (
            <View style={s.state}>
              <Text style={s.error}>{error}</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={s.state}>
              <Text style={s.empty}>Aucun historique de connexion disponible.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.table}>
                <View style={[s.row, s.headerRow]}>
                  <HeaderCell label="Terminal" width={220} />
                  <HeaderCell label="Identifiant source" width={210} />
                  <HeaderCell label="Connexion" width={160} />
                  <HeaderCell label="Deconnexion" width={160} />
                  <HeaderCell label="Statut" width={120} />
                  <HeaderCell label="Evenement" width={140} />
                </View>
                {records.map((record) => {
                  const tone = record.status === 'Connecte' ? 'ok' : 'warn';
                  return (
                    <View key={record.id} style={s.row}>
                      <BodyCell width={220} primary={record.terminalName} secondary={record.normalizedIdentity} />
                      <BodyCell width={210} primary={record.previousIdentifier} />
                      <BodyCell width={160} primary={formatDateTime(record.connectedAt)} />
                      <BodyCell width={160} primary={formatDateTime(record.disconnectedAt)} />
                      <View style={[s.cell, { width: 120 }]}>
                        <View style={[s.badge, { backgroundColor: toneBg(tone) }]}>
                          <Text style={[s.badgeText, { color: toneColor(tone) }]}>{record.status}</Text>
                        </View>
                      </View>
                      <BodyCell width={140} primary={record.eventType} />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function HeaderCell({ label, width }: { label: string; width: number }) {
  return <Text style={[s.headerCell, { width }]}>{label.toUpperCase()}</Text>;
}

function BodyCell({
  width,
  primary,
  secondary,
}: {
  width: number;
  primary: string;
  secondary?: string;
}) {
  return (
    <View style={[s.cell, { width }]}>
      <Text style={s.primary}>{primary}</Text>
      {secondary ? <Text style={s.secondary}>{secondary}</Text> : null}
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
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: UI.ink,
    fontSize: 21,
    fontWeight: '900',
  },
  sub: {
    color: UI.muted,
    marginTop: 4,
    fontSize: 14,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: UI.bad,
    fontWeight: '700',
  },
  empty: {
    color: UI.muted,
    fontWeight: '700',
  },
  table: {
    minWidth: 1010,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: UI.stroke2,
  },
  headerRow: {
    backgroundColor: UI.card2,
    borderTopWidth: 1,
    borderTopColor: UI.stroke2,
  },
  headerCell: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    color: UI.muted2,
    fontSize: 11,
    fontWeight: '900',
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  primary: {
    color: UI.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  secondary: {
    marginTop: 4,
    color: UI.muted,
    fontSize: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontWeight: '900',
    fontSize: 12,
  },
});
