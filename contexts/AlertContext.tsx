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
import {
  clearAllLiveMovementSnapshots,
  clearLiveMovementSnapshot,
  setLiveMovementSnapshot,
} from '../lib/liveMovementState';
import * as tokenStore from '../lib/tokenStore';
import { getWebSocketUrl, movementAlertsApi } from '../lib/api';
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
  activeOutOfZoneAlert: MovementAlert | null;
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
  acknowledgeActiveOutOfZoneAlert: () => Promise<boolean>;
  clearAlert: (id: number) => void;
  clearAll: () => void;
};

const AlertContext = createContext<AlertContextValue>({
  alerts: [],
  latestAlert: null,
  activeOutOfZoneAlert: null,
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
  acknowledgeActiveOutOfZoneAlert: async () => false,
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
  return alert.id ?? `${alert.terminalId}-${alert.triggeredAt}`;
}

function getAlertTitle(alert?: MovementAlert): string {
  if (!alert) return 'TP hors zone autorisee';
  return alert.terminalName
    ? `TP hors zone autorisee - ${alert.terminalName}`
    : `TP hors zone autorisee - Terminal #${alert.terminalId}`;
}

function getAlertBody(alert?: MovementAlert): string {
  if (!alert) return 'Une nouvelle alerte critique a ete detectee.';
  return (
    alert.message ??
    `${alert.terminalName ?? `Terminal #${alert.terminalId}`} a quitte sa zone autorisee.`
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
  const [activeOutOfZoneAlertId, setActiveOutOfZoneAlertId] = useState<number | string | null>(null);
  const [connected, setConnected] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(getSavedSoundEnabled);
  const [webAudioUnlocked, setWebAudioUnlocked] = useState(getSavedWebAudioUnlocked);
  const [notificationPermission, setNotificationPermission] = useState<PermissionState>('unknown');
  const [soundPermissionMessage, setSoundPermissionMessage] = useState<string | null>(
    Platform.OS === 'web'
      ? 'Cliquez sur "Activer" une premiere fois pour autoriser le navigateur a jouer la sirene automatiquement.'
      : null,
  );

  const clientRef = useRef<Client | null>(null);
  const seenAlertIdsRef = useRef<Set<number | string>>(new Set());
  const queuedAlarmIdsRef = useRef<Set<number | string>>(new Set());
  const alarmQueueRef = useRef<Array<number | string>>([]);
  const soundEnabledRef = useRef(soundEnabled);

  const activeOutOfZoneAlert = useMemo(
    () => alerts.find((alert) => getAlertId(alert) === activeOutOfZoneAlertId) ?? null,
    [activeOutOfZoneAlertId, alerts],
  );

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.localStorage.setItem('tpe-alert-sound-enabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.localStorage.setItem('tpe-alert-web-audio-unlocked', String(webAudioUnlocked));
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

    void bootstrapPermissions();
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
        setSoundPermissionMessage(
          unlocked
            ? null
            : 'Le navigateur bloque encore le son. Cliquez sur "Activer", puis verifiez l autorisation audio du site.',
        );
      } else {
        setWebAudioUnlocked(true);
        setSoundPermissionMessage(soundOk ? null : "Le son n'a pas pu etre initialise sur ce telephone.");
      }
    } catch {
      soundOk = false;
      setSoundPermissionMessage(
        Platform.OS === 'web'
          ? 'Le navigateur a bloque le son. Cliquez sur "Activer" depuis la banniere.'
          : "Le son n'a pas pu etre initialise sur ce telephone.",
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

      if (!soundEnabledRef.current) {
        return;
      }

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
          ? 'Le son automatique est bloque par le navigateur. Cliquez sur "Activer", puis testez la sirene.'
          : "Impossible de jouer le son d'alerte sur ce telephone.",
      );
    },
    [showLocalNotification],
  );

  const stopAlarm = useCallback(() => {
    void stopAlertSound();
    setIsAlarmActive(false);
  }, []);

  const playQueuedAlarm = useCallback(
    async (alertId: number | string) => {
      const alert = alerts.find((item) => getAlertId(item) === alertId) ?? null;
      setActiveOutOfZoneAlertId(alertId);
      await triggerAlarm(alert ?? undefined);
    },
    [alerts, triggerAlarm],
  );

  const removeFromQueue = useCallback(
    (alertId: number | string, stopCurrentSound: boolean) => {
      alarmQueueRef.current = alarmQueueRef.current.filter((id) => id !== alertId);
      queuedAlarmIdsRef.current.delete(alertId);

      const wasActive = activeOutOfZoneAlertId === alertId;
      const nextId = alarmQueueRef.current[0] ?? null;

      if (!wasActive) {
        return;
      }

      setActiveOutOfZoneAlertId(nextId);

      if (stopCurrentSound) {
        void stopAlertSound();
        setIsAlarmActive(false);
      }

      if (nextId != null) {
        void playQueuedAlarm(nextId);
      }
    },
    [activeOutOfZoneAlertId, playQueuedAlarm],
  );

  const upsert = useCallback(
    (incoming: MovementAlert) => {
      const alertId = getAlertId(incoming);
      const isNew = !seenAlertIdsRef.current.has(alertId);
      if (isNew) {
        seenAlertIdsRef.current.add(alertId);
      }

      setLatestAlert(incoming);
      setLiveMovementSnapshot({
        terminalId: incoming.terminalId,
        outside: incoming.status !== 'RESOLVED',
        currentLat: incoming.currentLat,
        currentLng: incoming.currentLng,
        updatedAt: Date.now(),
      });
      setAlerts((prev) => {
        const idx = prev.findIndex((item) => getAlertId(item) === alertId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = incoming;
          return next;
        }
        return [incoming, ...prev].slice(0, 150);
      });

      const isTriggered = incoming.status === 'TRIGGERED' && incoming.soundRequired !== false;
      const isClosed = incoming.status === 'ACKNOWLEDGED' || incoming.status === 'RESOLVED';

      if (isTriggered && !queuedAlarmIdsRef.current.has(alertId)) {
        alarmQueueRef.current = [...alarmQueueRef.current, alertId];
        queuedAlarmIdsRef.current.add(alertId);

        if (alarmQueueRef.current.length === 1) {
          setActiveOutOfZoneAlertId(alertId);
          void triggerAlarm(incoming);
        }
      }

      if (isClosed) {
        removeFromQueue(alertId, activeOutOfZoneAlertId === alertId);
      }
    },
    [activeOutOfZoneAlertId, removeFromQueue, triggerAlarm],
  );

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

    void connect();

    return () => {
      alive = false;
      clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [upsert]);

  const acknowledgeActiveOutOfZoneAlert = useCallback(async () => {
    if (!activeOutOfZoneAlert) {
      stopAlarm();
      return false;
    }

    try {
      const updated = await movementAlertsApi.acknowledge(activeOutOfZoneAlert.id);
      upsert(updated);
      removeFromQueue(getAlertId(activeOutOfZoneAlert), true);
      return true;
    } catch {
      return false;
    }
  }, [activeOutOfZoneAlert, removeFromQueue, stopAlarm, upsert]);

  const clearAlert = useCallback(
    (id: number) => {
      const alert = alerts.find((item) => item.id === id);
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
      seenAlertIdsRef.current.delete(id);
      if (alert) {
        clearLiveMovementSnapshot(alert.terminalId);
      }
      removeFromQueue(id, activeOutOfZoneAlertId === id);
    },
    [activeOutOfZoneAlertId, alerts, removeFromQueue],
  );

  const clearAll = useCallback(() => {
    setAlerts([]);
    seenAlertIdsRef.current.clear();
    queuedAlarmIdsRef.current.clear();
    alarmQueueRef.current = [];
    setActiveOutOfZoneAlertId(null);
    clearAllLiveMovementSnapshots();
    void stopAlertSound();
    setIsAlarmActive(false);
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
        ? 'Le navigateur bloque encore le son. Cliquez sur "Activer", puis retestez.'
        : 'Impossible de tester le son sur ce telephone.',
    );
    return false;
  }, [requestAlertPermissions]);

  const triggeredCount = useMemo(
    () => alerts.filter((alert) => alert.status !== 'RESOLVED').length,
    [alerts],
  );

  return (
    <AlertContext.Provider
      value={{
        alerts,
        latestAlert,
        activeOutOfZoneAlert,
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
        acknowledgeActiveOutOfZoneAlert,
        clearAlert,
        clearAll,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}
