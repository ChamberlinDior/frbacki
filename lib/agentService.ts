import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { simulatorApi } from './api';
import {
  buildLocalTelemetry,
  requestPermissions,
  watchDeviceLocation,
} from './deviceTelemetry';
import * as tokenStore from './tokenStore';
import type { TelemetryPushRequest } from './types';

const INTERVAL_MS = 15 * 1000;
let timerRef: ReturnType<typeof setInterval> | null = null;
let locationSubscription: Location.LocationSubscription | null = null;
let lastPushAt = 0;
let lastCoords: { lat: number; lng: number } | null = null;

export async function startAgent(): Promise<void> {
  if (timerRef || locationSubscription) return;

  try {
    if (Platform.OS !== 'web') {
      await requestPermissions();
    }

    let token = await tokenStore.getDeviceToken();
    if (!token) {
      token = await enroll();
    }
    if (!token) return;

    await push(token);

    if (Platform.OS !== 'web') {
      locationSubscription = await watchDeviceLocation(async (location) => {
        const currentToken = await tokenStore.getDeviceToken();
        if (!currentToken) return;

        const movedEnough =
          !lastCoords ||
          Math.abs(lastCoords.lat - location.gpsLat) > 0.000005 ||
          Math.abs(lastCoords.lng - location.gpsLng) > 0.000005;
        const enoughTimeElapsed = Date.now() - lastPushAt >= 2500;

        if (movedEnough && enoughTimeElapsed) {
          await push(currentToken, location);
        }
      });
    }

    timerRef = setInterval(async () => {
      const currentToken = await tokenStore.getDeviceToken();
      if (currentToken) {
        await push(currentToken);
      }
    }, INTERVAL_MS);
  } catch {
    // noop
  }
}

export function stopAgent(): void {
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }

  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}

async function enroll(): Promise<string | null> {
  try {
    const serial =
      (Device.osInternalBuildId != null ? String(Device.osInternalBuildId) : null) ??
      (Device.modelId != null ? String(Device.modelId) : null) ??
      `DEVICE-${Platform.OS.toUpperCase()}-${Date.now()}`;

    const res = await simulatorApi.enroll({
      serialNumber: serial,
      displayName: `${Device.modelName ?? Platform.OS} (app)`,
      model: Device.modelName ?? undefined,
      manufacturer: Device.manufacturer ?? undefined,
      brand: Device.manufacturer ?? undefined,
      osVersion: Device.osVersion ?? undefined,
      deviceType: 'PHONE',
      agentVersion: '2.0.0',
      appPackage: 'com.orabank.tpemonitoringv2',
      appVersionName: '2.0.0',
    });

    await tokenStore.saveDeviceToken(
      res.deviceToken,
      res.tokenExpiresInMs,
      res.deviceKey,
      res.terminalId,
    );

    return res.deviceToken;
  } catch {
    return null;
  }
}

async function push(
  token: string,
  locationOverride?: {
    gpsLat: number;
    gpsLng: number;
    gpsAccuracy?: number | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
  },
): Promise<void> {
  try {
    const local = await buildLocalTelemetry(locationOverride);

    const payload: TelemetryPushRequest = {
      serialNumber: local.serialNumber,
      imei1: local.imei1,
      imei2: local.imei2,
      androidId: local.androidId,
      model: local.model,
      manufacturer: local.manufacturer,
      brand: local.brand,
      batteryPercent: local.batteryPercent,
      charging: local.charging,
      batteryTemp: local.batteryTemp,
      networkType: local.networkType,
      signalLevel: local.signalLevel,
      gpsLat: local.gpsLat,
      gpsLng: local.gpsLng,
      gpsAccuracy: local.gpsAccuracy,
      city: local.city,
      region: local.region,
      country: local.country,
      storageFreeMb: local.storageFreeMb,
      uptimeSec: local.uptimeSec,
      osVersion: local.osVersion,
      agentVersion: local.agentVersion,
    };

    await simulatorApi.pushTelemetry(payload, token);
    if (local.gpsLat != null && local.gpsLng != null) {
      lastCoords = { lat: local.gpsLat, lng: local.gpsLng };
    }
    lastPushAt = Date.now();
  } catch {
    // noop
  }
}
