/**
 * lib/tokenStore.ts — Stockage sécurisé des tokens JWT
 * Mobile (iOS/Android) : expo-secure-store (chiffré)
 * Web                  : localStorage (fallback — pas de SecureStore sur browser)
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ─────────────────────────────────────────────────────────────────────────────
// Abstraction plateforme (SecureStore ≠ disponible sur web)
// ─────────────────────────────────────────────────────────────────────────────

async function storeSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}

async function storeGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function storeDel(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}

const K = {
  adminToken:    'tpe_v2_admin_token',
  adminExpires:  'tpe_v2_admin_expires',
  adminUsername: 'tpe_v2_admin_username',
  adminRole:     'tpe_v2_admin_role',
  deviceToken:   'tpe_v2_device_token',
  deviceExpires: 'tpe_v2_device_expires',
  deviceKey:     'tpe_v2_device_key',
  terminalId:    'tpe_v2_terminal_id',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Admin token (ROLE_ADMIN / OPERATOR / VIEWER)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAdminToken(
  token: string,
  expiresInMs: number,
  username: string,
  role: string,
): Promise<void> {
  const expiresAt = String(Date.now() + expiresInMs);
  await Promise.all([
    storeSet(K.adminToken,    token),
    storeSet(K.adminExpires,  expiresAt),
    storeSet(K.adminUsername, username),
    storeSet(K.adminRole,     role),
  ]);
}

export async function getAdminToken(): Promise<string | null> {
  const [token, expiresAt] = await Promise.all([
    storeGet(K.adminToken),
    storeGet(K.adminExpires),
  ]);
  if (!token || !expiresAt) return null;
  if (Date.now() > Number(expiresAt)) {
    await clearAdminToken();
    return null;
  }
  return token;
}

export async function isAdminTokenValid(): Promise<boolean> {
  return (await getAdminToken()) !== null;
}

export async function getAdminUsername(): Promise<string | null> {
  return storeGet(K.adminUsername);
}

export async function getAdminRole(): Promise<string | null> {
  return storeGet(K.adminRole);
}

export async function clearAdminToken(): Promise<void> {
  await Promise.all([
    storeDel(K.adminToken),
    storeDel(K.adminExpires),
    storeDel(K.adminUsername),
    storeDel(K.adminRole),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Device token (ROLE_DEVICE — push telemetry)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDeviceToken(
  token: string,
  expiresInMs: number,
  deviceKey: string,
  terminalId: number,
): Promise<void> {
  const expiresAt = String(Date.now() + expiresInMs);
  await Promise.all([
    storeSet(K.deviceToken,   token),
    storeSet(K.deviceExpires, expiresAt),
    storeSet(K.deviceKey,     deviceKey),
    storeSet(K.terminalId,    String(terminalId)),
  ]);
}

export async function getDeviceToken(): Promise<string | null> {
  const [token, expiresAt] = await Promise.all([
    storeGet(K.deviceToken),
    storeGet(K.deviceExpires),
  ]);
  if (!token || !expiresAt) return null;
  if (Date.now() > Number(expiresAt)) {
    await clearDeviceToken();
    return null;
  }
  return token;
}

export async function getDeviceKey(): Promise<string | null> {
  return storeGet(K.deviceKey);
}

export async function getTerminalId(): Promise<number | null> {
  const v = await storeGet(K.terminalId);
  return v ? Number(v) : null;
}

export async function clearDeviceToken(): Promise<void> {
  await Promise.all([
    storeDel(K.deviceToken),
    storeDel(K.deviceExpires),
    storeDel(K.deviceKey),
    storeDel(K.terminalId),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Effacement total (logout)
// ─────────────────────────────────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  await Promise.all([clearAdminToken(), clearDeviceToken()]);
}
