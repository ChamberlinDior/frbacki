import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';

export function NetworkErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={s.wrap}>
      <View style={s.left}>
        <View style={s.iconWrap}>
          <Ionicons name="cloud-offline-outline" size={18} color={UI.bad} />
        </View>
        <Text style={s.text}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable style={s.btn} onPress={onRetry}>
          <Text style={s.btnText}>Reessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: UI.badBg,
    borderColor: '#F0C7C7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: UI.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    color: UI.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  btn: {
    borderRadius: 12,
    backgroundColor: UI.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnText: {
    color: UI.info,
    fontWeight: '800',
    fontSize: 12,
  },
});
