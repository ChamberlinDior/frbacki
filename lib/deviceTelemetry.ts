import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import type { LocalTelemetry, NetworkType } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mapNetwork(state: Network.NetworkState | null): NetworkType {
  if (!state || !state.isConnected) return 'NONE';
  switch (state.type) {
    case Network.NetworkStateType.WIFI:
      return 'WIFI';
    case Network.NetworkStateType.ETHERNET:
      return 'ETHERNET';
    case Network.NetworkStateType.CELLULAR:
      return 'CELL_4G';
    default:
      return 'UNKNOWN';
  }
}

export async function requestPermissions(): Promise<'granted' | 'denied'> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status as 'granted' | 'denied';
}

export async function getCurrentLocationTelemetry() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy:
        Platform.OS === 'android'
          ? Location.Accuracy.Highest
          : Location.Accuracy.BestForNavigation,
      maximumAge: 0,
      mayShowUserSettingsDialog: true,
    });

    const { latitude, longitude, accuracy } = pos.coords;

    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;

    if (Platform.OS !== 'web') {
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        const g = geo?.[0];
        city = g?.city ?? g?.subregion ?? g?.district ?? null;
        region = g?.region ?? null;
        country = g?.country ?? null;
      } catch {
        // noop
      }
    }

    return {
      gpsLat: latitude,
      gpsLng: longitude,
      gpsAccuracy: accuracy ?? null,
      city,
      region,
      country,
    };
  } catch {
    return null;
  }
}

export async function watchDeviceLocation(
  onLocation: (location: {
    gpsLat: number;
    gpsLng: number;
    gpsAccuracy?: number | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
  }) => void | Promise<void>,
) {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  return Location.watchPositionAsync(
    {
      accuracy:
        Platform.OS === 'android'
          ? Location.Accuracy.Highest
          : Location.Accuracy.BestForNavigation,
      distanceInterval: 1,
      timeInterval: 3000,
      mayShowUserSettingsDialog: true,
    },
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      await onLocation({
        gpsLat: latitude,
        gpsLng: longitude,
        gpsAccuracy: accuracy ?? null,
      });
    },
  );
}

async function collectBattery() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    return {
      batteryPercent: clamp(Math.round(level * 100), 0, 100),
      charging:
        state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
      batteryTemp: null as null,
    };
  } catch {
    return { batteryPercent: null, charging: null, batteryTemp: null };
  }
}

async function collectNetwork() {
  try {
    const state = await Network.getNetworkStateAsync();
    return { networkType: mapNetwork(state), signalLevel: null as null };
  } catch {
    return { networkType: 'UNKNOWN' as NetworkType, signalLevel: null };
  }
}

export async function buildLocalTelemetry(
  locationOverride?: Partial<Pick<LocalTelemetry, 'gpsLat' | 'gpsLng' | 'gpsAccuracy' | 'city' | 'region' | 'country'>>,
): Promise<LocalTelemetry> {
  const serialNumber =
    (Device.osInternalBuildId ? String(Device.osInternalBuildId) : null) ||
    (Device.modelId ? String(Device.modelId) : null) ||
    `PHONE-${Date.now()}`;

  const [loc, batt, net] = await Promise.all([
    locationOverride?.gpsLat != null && locationOverride?.gpsLng != null
      ? Promise.resolve({
          gpsLat: locationOverride.gpsLat,
          gpsLng: locationOverride.gpsLng,
          gpsAccuracy: locationOverride.gpsAccuracy ?? null,
          city: locationOverride.city ?? null,
          region: locationOverride.region ?? null,
          country: locationOverride.country ?? null,
        })
      : getCurrentLocationTelemetry(),
    collectBattery(),
    collectNetwork(),
  ]);

  return {
    serialNumber,
    imei1: null,
    imei2: null,
    androidId: null,
    model: Device.modelName ?? null,
    manufacturer: Device.manufacturer ?? 'UNKNOWN',
    brand: Device.manufacturer ?? null,
    city: loc?.city ?? null,
    region: loc?.region ?? null,
    country: loc?.country ?? null,
    batteryPercent: batt.batteryPercent,
    charging: batt.charging,
    batteryTemp: batt.batteryTemp,
    networkType: net.networkType,
    signalLevel: net.signalLevel,
    gpsLat: loc?.gpsLat ?? null,
    gpsLng: loc?.gpsLng ?? null,
    gpsAccuracy: loc?.gpsAccuracy ?? null,
    storageFreeMb: null,
    uptimeSec: null,
    osVersion: Device.osVersion ?? null,
    agentVersion: '2.0.0',
  };
}
