/**
 * contexts/AlertContext.tsx
 * Connexion STOMP WebSocket temps réel — alertes de mouvement GPS
 *
 * IMPORTANT :
 * Ce context NE JOUE PLUS automatiquement la sirène sur chaque status TRIGGERED.
 * Il stocke les alertes live, affiche les notifications si nécessaire,
 * mais le déclenchement sonore métier doit être fait par les pages qui connaissent
 * l'état réel du TPE : inside / outside zone.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Client } from '@stomp/stompjs';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { MovementAlert } from '../lib/types';
import * as tokenStore from '../lib/tokenStore';
import { getWebSocketUrl } from '../lib/api';
import {
  isWebAudioUnlocked,
  playAlertSound,
  stopAlertSound,
  unlockAlertSound,
} from '../lib/alertSound';

const WS_URL = getWebSocketUrl();

type PermissionState = 'unknown' | 'granted' | 'denied';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type AlertContextValue = {
  alerts: MovementAlert[];
  latestAlert: MovementAlert | null;
  triggeredCount: number;
  connected: boolean;
  soundEnabled: boolean;
  isAlarmActive: boolean;
  webAudioUnlocked: boolean;
  notificationPermission: PermissionState;
  soundPermissionMessage: string | null;
  setSoundEnabled: (value: boolean) => void;
  requestAlertPermissions: () => Promise<boolean>;
  testSound: () => Promise<boolean>;
  triggerAlarm: (alert?: MovementAlert) => Promise<void>;
  stopAlarm: () => void;
  clearAlert: (id: number) => void;
  clearAll: () => void;
};

const AlertContext = createContext<AlertContextValue>({
  alerts: [],
  latestAlert: null,
  triggeredCount: 0,
  connected: false,
  soundEnabled: true,
  isAlarmActive: false,
  webAudioUnlocked: false,
  notificationPermission: 'unknown',
  soundPermissionMessage: null,
  setSoundEnabled: () => {},
  requestAlertPermissions: async () => false,
  testSound: async () => false,
  triggerAlarm: async () => {},
  stopAlarm: () => {},
  clearAlert: () => {},
  clearAll: () => {},
});

export function useAlerts() {
  return useContext(AlertContext);
}

function getSavedSoundEnabled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;

  const raw = window.localStorage.getItem('tpe-alert-sound-enabled');
  return raw == null ? true : raw === 'true';
}

function getSavedWebAudioUnlocked(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  return window.localStorage.getItem('tpe-alert-web-audio-unlocked') === 'true';
}

function getAlertId(alert: MovementAlert): number | string {
  const rawId = (alert as any)?.id;

  if (rawId !== undefined && rawId !== null) {
    return rawId;
  }

  const terminalId = (alert as any)?.terminalId ?? (alert as any)?.terminal?.id ?? 'terminal';
  const createdAt =
    (alert as any)?.createdAt ??
    (alert as any)?.eventTimestamp ??
    (alert as any)?.timestamp ??
    Date.now();

  return `${terminalId}-${createdAt}`;
}

function getAlertTitle(alert?: MovementAlert): string {
  if (!alert) return 'Alerte TPE déclenchée';

  const terminalName =
    (alert as any).terminalName ??
    (alert as any).deviceKey ??
    (alert as any).terminalLabel ??
    ((alert as any).terminalId ? `Terminal #${(alert as any).terminalId}` : 'Terminal inconnu');

  return `Alerte TPE — ${terminalName}`;
}

function getAlertBody(alert?: MovementAlert): string {
  if (!alert) return 'Une nouvelle alerte a été détectée.';

  return (
    (alert as any).message ??
    (alert as any).description ??
    (alert as any).type ??
    'Une nouvelle alerte critique a été détectée.'
  );
}

async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('tpe-critical-alerts', {
    name: 'Alertes critiques TPE',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 700, 300, 700, 300, 700],
    lightColor: '#D64545',
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<MovementAlert[]>([]);
  const [latestAlert, setLatestAlert] = useState<MovementAlert | null>(null);
  const [connected, setConnected] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(getSavedSoundEnabled);
  const [webAudioUnlocked, setWebAudioUnlocked] = useState(getSavedWebAudioUnlocked);
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionState>('unknown');
  const [soundPermissionMessage, setSoundPermissionMessage] = useState<string | null>(
    Platform.OS === 'web'
      ? 'Cliquez sur “Activer” une première fois pour autoriser le navigateur à jouer la sirène automatiquement.'
      : null,
  );

  const clientRef = useRef<Client | null>(null);
  const seenAlertIdsRef = useRef<Set<number | string>>(new Set());
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    window.localStorage.setItem('tpe-alert-sound-enabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    window.localStorage.setItem(
      'tpe-alert-web-audio-unlocked',
      String(webAudioUnlocked),
    );
  }, [webAudioUnlocked]);

  useEffect(() => {
    let mounted = true;

    async function bootstrapPermissions() {
      try {
        await configureNotificationChannel();

        const current = await Notifications.getPermissionsAsync();

        if (!mounted) return;

        if (current.granted) {
          setNotificationPermission('granted');
        } else if (current.canAskAgain === false) {
          setNotificationPermission('denied');
        } else {
          setNotificationPermission('unknown');
        }
      } catch {
        if (mounted) {
          setNotificationPermission('unknown');
        }
      }
    }

    bootstrapPermissions();

    return () => {
      mounted = false;
    };
  }, []);

  const requestAlertPermissions = useCallback(async () => {
    let notificationOk = true;
    let soundOk = true;

    try {
      await configureNotificationChannel();

      const current = await Notifications.getPermissionsAsync();
      const finalPermission = current.granted
        ? current
        : await Notifications.requestPermissionsAsync();

      notificationOk = Boolean(finalPermission.granted);
      setNotificationPermission(notificationOk ? 'granted' : 'denied');
    } catch {
      notificationOk = false;
      setNotificationPermission('denied');
    }

    try {
      soundOk = await unlockAlertSound();

      if (Platform.OS === 'web') {
        const unlocked = isWebAudioUnlocked();
        setWebAudioUnlocked(unlocked);

        if (unlocked) {
          setSoundPermissionMessage(null);
        } else {
          setSoundPermissionMessage(
            "Le navigateur bloque encore le son. Cliquez sur “Activer”, puis vérifiez l’autorisation audio du site.",
          );
        }
      } else {
        setWebAudioUnlocked(true);

        if (soundOk) {
          setSoundPermissionMessage(null);
        } else {
          setSoundPermissionMessage(
            "Le son n'a pas pu être initialisé sur ce téléphone.",
          );
        }
      }
    } catch {
      soundOk = false;

      setSoundPermissionMessage(
        Platform.OS === 'web'
          ? "Le navigateur a bloqué le son. Cliquez sur “Activer” depuis la bannière."
          : "Le son n'a pas pu être initialisé sur ce téléphone.",
      );
    }

    return notificationOk && soundOk;
  }, []);

  const showLocalNotification = useCallback(async (alert?: MovementAlert) => {
    try {
      const permission = await Notifications.getPermissionsAsync();

      if (!permission.granted) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: getAlertTitle(alert),
          body: getAlertBody(alert),
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 700, 300, 700, 300, 700],
        },
        trigger: null,
      });
    } catch {
      // noop
    }
  }, []);

  const triggerAlarm = useCallback(
    async (alert?: MovementAlert) => {
      if (alert) {
        setLatestAlert(alert);
      }

      await showLocalNotification(alert);

      if (!soundEnabledRef.current) return;

      const ok = await playAlertSound();

      if (ok) {
        setIsAlarmActive(true);
        setSoundPermissionMessage(null);

        if (Platform.OS === 'web') {
          setWebAudioUnlocked(true);
        }

        return;
      }

      setIsAlarmActive(false);

      setSoundPermissionMessage(
        Platform.OS === 'web'
          ? "Le son automatique est bloqué par le navigateur. Cliquez sur “Activer”, puis testez la sirène."
          : "Impossible de jouer le son d'alerte sur ce téléphone.",
      );
    },
    [showLocalNotification],
  );

  const upsert = useCallback((incoming: MovementAlert) => {
    const alertId = getAlertId(incoming);
    const isNew = !seenAlertIdsRef.current.has(alertId);

    if (isNew) {
      seenAlertIdsRef.current.add(alertId);
    }

    setLatestAlert(incoming);

    setAlerts((prev) => {
      const idx = prev.findIndex((a) => getAlertId(a) === alertId);

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = incoming;
        return next;
      }

      return [incoming, ...prev].slice(0, 100);
    });

    /**
     * IMPORTANT :
     * On ne joue plus le son ici.
     * Le Context ne sait pas si le TPE est réellement dans ou hors zone bleue.
     * Les pages Dashboard / Telemetry, qui ont terminalsApi.list(),
     * déclenchent la sirène uniquement sur transition INSIDE -> OUTSIDE.
     */
  }, []);

  useEffect(() => {
    let alive = true;

    async function connect() {
      const adminToken = await tokenStore.getAdminToken();
      const deviceToken = await tokenStore.getDeviceToken();
      const token = adminToken ?? deviceToken;

      const connectHeaders: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const client = new Client({
        brokerURL: WS_URL,
        connectHeaders,
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
        onConnect: () => {
          if (!alive) return;

          setConnected(true);

          client.subscribe('/topic/movement-alerts', (msg) => {
            try {
              const alert: MovementAlert = JSON.parse(msg.body);
              upsert(alert);
            } catch {
              // malformed
            }
          });
        },
        onDisconnect: () => {
          if (alive) setConnected(false);
        },
        onWebSocketClose: () => {
          if (alive) setConnected(false);
        },
        onStompError: () => {
          if (alive) setConnected(false);
        },
      });

      clientRef.current = client;
      client.activate();
    }

    connect();

    return () => {
      alive = false;
      clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [upsert]);

  const stopAlarm = useCallback(() => {
    void stopAlertSound();
    setIsAlarmActive(false);
  }, []);

  const clearAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => (a as any).id !== id));
    seenAlertIdsRef.current.delete(id);
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
    seenAlertIdsRef.current.clear();
  }, []);

  const setSoundEnabled = useCallback((value: boolean) => {
    setSoundEnabledState(value);

    if (!value) {
      void stopAlertSound();
      setIsAlarmActive(false);
    }
  }, []);

  const testSound = useCallback(async () => {
    await requestAlertPermissions();

    const ok = await playAlertSound();

    if (ok) {
      setIsAlarmActive(true);
      setSoundPermissionMessage(null);

      if (Platform.OS === 'web') {
        setWebAudioUnlocked(true);
      }

      return true;
    }

    setSoundPermissionMessage(
      Platform.OS === 'web'
        ? "Le navigateur bloque encore le son. Cliquez sur “Activer”, puis retestez."
        : "Impossible de tester le son sur ce téléphone.",
    );

    return false;
  }, [requestAlertPermissions]);

  const triggeredCount = useMemo(
    () => alerts.filter((a) => a.status === 'TRIGGERED').length,
    [alerts],
  );

  return (
    <AlertContext.Provider
      value={{
        alerts,
        latestAlert,
        triggeredCount,
        connected,
        soundEnabled,
        isAlarmActive,
        webAudioUnlocked,
        notificationPermission,
        soundPermissionMessage,
        setSoundEnabled,
        requestAlertPermissions,
        testSound,
        triggerAlarm,
        stopAlarm,
        clearAlert,
        clearAll,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}