import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';
import type { ZonePreset } from '../lib/zonesCatalog';

export function ZoneSelector({
  zones,
  selectedZoneId,
  onSelect,
}: {
  zones: Array<ZonePreset | { id: string; name: string; defaultRadiusMeters: number; preset: boolean }>;
  selectedZoneId: string;
  onSelect: (zoneId: string) => void;
}) {
  return (
    <View>
      <Text style={s.label}>Zones predefinies</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {zones.map((zone) => {
          const active = zone.id === selectedZoneId;
          return (
            <Pressable
              key={zone.id}
              onPress={() => onSelect(zone.id)}
              style={[s.card, active && s.cardActive]}
            >
              <Text style={[s.name, active && s.nameActive]}>{zone.name}</Text>
              <Text style={[s.meta, active && s.metaActive]}>
                {zone.preset ? `${zone.defaultRadiusMeters} m` : 'Libre'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    color: UI.ink2,
    fontWeight: '800',
    marginBottom: 8,
    fontSize: 14,
  },
  row: {
    gap: 10,
    paddingBottom: 4,
  },
  card: {
    width: 148,
    minHeight: 76,
    borderRadius: 18,
    padding: 12,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: UI.stroke,
    justifyContent: 'space-between',
  },
  cardActive: {
    borderColor: UI.info,
    backgroundColor: UI.infoBg,
  },
  name: {
    color: UI.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  nameActive: {
    color: UI.info,
  },
  meta: {
    color: UI.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  metaActive: {
    color: UI.info,
  },
});
