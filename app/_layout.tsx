/**
 * app/_layout.tsx — Layout racine avec guard d'authentification
 * + bannière d'alarme globale persistante
 * + activation globale du son / notifications
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AlertProvider, useAlerts } from '../contexts/AlertContext';
import { registerUnauthorizedHandler } from '../lib/api';
import { startAgent, stopAgent } from '../lib/agentService';
import { UI } from '../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Guard navigation
// ─────────────────────────────────────────────────────────────────────────────

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, logout } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      await logout();
      router.replace('/login');
    });
  }, [logout]);

  useEffect(() => {
    if (isAuthenticated) {
      startAgent();
    } else {
      stopAgent();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inLoginScreen = segments[0] === 'login';

    if (!isAuthenticated && !inLoginScreen) {
      router.replace('/login');
    } else if (isAuthenticated && inLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bannière globale : alarme + autorisations son/notifications
// ─────────────────────────────────────────────────────────────────────────────

function GlobalAlarmBanner() {
  const {
    connected,
    isAlarmActive,
    stopAlarm,
    triggeredCount,
    latestAlert,
    soundEnabled,
    setSoundEnabled,
    webAudioUnlocked,
    notificationPermission,
    soundPermissionMessage,
    requestAlertPermissions,
    testSound,
  } = useAlerts();

  const latestMessage =
    (latestAlert as any)?.message ??
    (latestAlert as any)?.description ??
    (latestAlert as any)?.type ??
    null;

  const alarmLabel =
    latestMessage ??
    (triggeredCount > 0
      ? `${triggeredCount} alerte${triggeredCount > 1 ? 's' : ''} critique${triggeredCount > 1 ? 's' : ''} en cours`
      : "Son d'alerte actif");

  const shouldShowPermissionPanel =
    Boolean(soundPermissionMessage) ||
    notificationPermission !== 'granted' ||
    (Platform.OS === 'web' && soundEnabled && !webAudioUnlocked);

  if (!isAlarmActive && !shouldShowPermissionPanel) {
    return null;
  }

  return (
    <View style={ab.container} pointerEvents="box-none">
      {isAlarmActive ? (
        <View style={ab.alarmPanel}>
          <View style={ab.left}>
            <View style={ab.iconWrapDanger}>
              <Ionicons name="warning" size={20} color="#fff" />
            </View>

            <View style={ab.textWrap}>
              <Text style={ab.titleDanger}>ALARME ACTIVE</Text>
              <Text style={ab.subDanger} numberOfLines={2}>
                {alarmLabel}
              </Text>
              <Text style={ab.metaDanger}>
                Sirène en boucle — arrêt manuel requis.
              </Text>
            </View>
          </View>

          <Pressable style={ab.stopBtn} onPress={stopAlarm}>
            <Ionicons name="volume-mute" size={16} color="#fff" />
            <Text style={ab.stopText}>Couper</Text>
          </Pressable>
        </View>
      ) : null}

      {shouldShowPermissionPanel ? (
        <View style={ab.permissionPanel}>
          <View style={ab.permissionLeft}>
            <View style={ab.iconWrapInfo}>
              <Ionicons
                name={connected ? 'notifications-outline' : 'cloud-offline-outline'}
                size={18}
                color={UI.info}
              />
            </View>

            <View style={ab.textWrap}>
              <Text style={ab.permissionTitle}>
                Autorisations des alertes
              </Text>

              <Text style={ab.permissionText} numberOfLines={3}>
                {soundPermissionMessage ??
                  "Active le son et les notifications pour recevoir les alertes depuis toutes les pages."}
              </Text>

              <Text style={ab.permissionMeta}>
                WebSocket : {connected ? 'connecté' : 'déconnecté'} · Notifications : {notificationPermission}
                {Platform.OS === 'web'
                  ? ` · Son web : ${webAudioUnlocked ? 'autorisé' : 'à activer'}`
                  : ''}
              </Text>
            </View>
          </View>

          <View style={ab.actions}>
            <View style={ab.soundSwitch}>
              <Text style={ab.soundSwitchLabel}>Son</Text>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ true: UI.info, false: UI.stroke }}
              />
            </View>

            <Pressable
              style={ab.enableBtn}
              onPress={() => {
                void requestAlertPermissions();
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
              <Text style={ab.enableBtnText}>
                {Platform.OS === 'web' && webAudioUnlocked ? 'Autorisé' : 'Activer'}
              </Text>
            </Pressable>

            <Pressable
              style={ab.testBtn}
              onPress={() => {
                void testSound();
              }}
            >
              <Ionicons name="volume-high-outline" size={16} color={UI.info} />
              <Text style={ab.testBtnText}>Tester</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const ab = StyleSheet.create({
  container: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
      } as any,
      ios: {
        position: 'absolute',
        top: 54,
        left: 14,
        right: 14,
        zIndex: 9999,
      },
      android: {
        position: 'absolute',
        top: 34,
        left: 14,
        right: 14,
        zIndex: 9999,
      },
      default: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
      },
    }),
    gap: 8,
  } as any,

  alarmPanel: {
    backgroundColor: '#120305',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#D64545',
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#D64545',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 24,
  },
  permissionPanel: {
    backgroundColor: UI.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.stroke,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 14,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapDanger: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#D64545',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapInfo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  titleDanger: {
    color: '#FF7777',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  subDanger: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    lineHeight: 18,
  },
  metaDanger: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  permissionTitle: {
    color: UI.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  permissionText: {
    color: UI.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 17,
  },
  permissionMeta: {
    color: UI.muted2,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  soundSwitch: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: UI.card2,
    borderWidth: 1,
    borderColor: UI.stroke,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundSwitchLabel: {
    color: UI.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  enableBtn: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: UI.info,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  enableBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  testBtn: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: UI.infoBg,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testBtnText: {
    color: UI.info,
    fontSize: 12,
    fontWeight: '900',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D64545',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexShrink: 0,
  },
  stopText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Contenu principal
// ─────────────────────────────────────────────────────────────────────────────

function AppContent() {
  return (
    <View style={{ flex: 1 }}>
      <NavigationGuard>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: UI.bgTop },
            headerTintColor: UI.ink,
            headerTitleStyle: { fontWeight: '700', color: UI.ink },
            contentStyle: { backgroundColor: UI.bgBot },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="terminal/[id]"
            options={{ title: 'Détail TPE', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="incident/[id]"
            options={{ title: 'Incident', headerBackTitle: 'Retour' }}
          />
        </Stack>
      </NavigationGuard>

      <GlobalAlarmBanner />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout racine
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <AuthProvider>
      <AlertProvider>
        <StatusBar style="light" />
        <AppContent />
      </AlertProvider>
    </AuthProvider>
  );
}