import React from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { UI } from '../constants/theme';

export function AlertRouteMap({
  adminLocation,
  targetLocation,
  targetLabel,
}: {
  adminLocation: { latitude: number; longitude: number } | null;
  targetLocation: { latitude: number; longitude: number } | null;
  targetLabel: string;
}) {
  if (!adminLocation || !targetLocation) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>Itineraire indisponible</Text>
        <Text style={s.emptyText}>La position admin ou celle du TPE est absente.</Text>
      </View>
    );
  }

  const latitude = (adminLocation.latitude + targetLocation.latitude) / 2;
  const longitude = (adminLocation.longitude + targetLocation.longitude) / 2;

  return (
    <View style={s.wrap}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: Math.max(Math.abs(adminLocation.latitude - targetLocation.latitude) * 2, 0.02),
          longitudeDelta: Math.max(Math.abs(adminLocation.longitude - targetLocation.longitude) * 2, 0.02),
        }}
      >
        <Marker coordinate={adminLocation} title="Admin" pinColor={UI.info} />
        <Marker coordinate={targetLocation} title={targetLabel} pinColor={UI.bad} />
        <Polyline
          coordinates={[adminLocation, targetLocation]}
          strokeColor={UI.info}
          strokeWidth={4}
        />
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card,
  },
  empty: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: UI.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 8,
    color: UI.muted,
    textAlign: 'center',
  },
});
