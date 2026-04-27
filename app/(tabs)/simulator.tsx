/**
 * app/(tabs)/simulator.tsx — Simulateur TPE (rôle TESTER uniquement)
 * 4 sections : Enrôlement · Télémétrie · Événements · Scénarios
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { simulatorApi } from '../../lib/api';
import { buildLocalTelemetry, requestPermissions } from '../../lib/deviceTelemetry';
import type {
  EnrollResponse,
  EventLogRequest,
  EventSeverity,
  EventType,
  TerminalSummary,
  TelemetryPushRequest,
} from '../../lib/types';
import { UI, toneColor } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes simulateur
// ─────────────────────────────────────────────────────────────────────────────

const MODELS = ['Sunmi V2s', 'Sunmi V2 Pro', 'itel A6610L', 'SM-A336E', 'Urovo DT40'];
const NETWORK_TYPES = ['WIFI', 'CELL_4G', 'CELL_3G', 'CELL_2G', 'NONE'] as const;
const EVENT_TYPES: EventType[] = [
  'LOW_BATTERY', 'OFFLINE', 'BACK_ONLINE', 'APP_CRASH',
  'SIM_CHANGE', 'GPS_ANOMALY', 'STORAGE_LOW', 'REBOOT', 'NETWORK_LOSS',
];
const SEVERITIES: EventSeverity[] = ['INFO', 'WARN', 'CRITICAL'];

/** Génère un numéro de série aléatoire de test */
function randomSN(): string {
  return `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** GPS aléatoire dans la zone Libreville */
function randomGPS(): { lat: number; lng: number } {
  return {
    lat: 0.39 + Math.random() * 0.06,
    lng: 9.38 + Math.random() * 0.07,
  };
}

/** GPS aléatoire Port-Gentil */
function randomGPSPortGentil(): { lat: number; lng: number } {
  return {
    lat: -0.72 + Math.random() * 0.06,
    lng: 8.75 + Math.random() * 0.06,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants UI partagés
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <BlurView intensity={14} tint="dark" style={s.sectionCard}>
      <View style={s.sectionHeader}>
        <Ionicons name={icon as any} size={16} color={UI.info} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </BlurView>
  );
}

function SimBtn({
  label, onPress, loading, tone = 'ok', disabled,
}: {
  label: string; onPress: () => void; loading?: boolean;
  tone?: 'ok' | 'warn' | 'bad' | 'info'; disabled?: boolean;
}) {
  return (
    <Pressable
      style={[s.btn, { backgroundColor: toneColor(tone) + '22', borderColor: toneColor(tone) },
        (loading || disabled) && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading
        ? <ActivityIndicator color={toneColor(tone)} size="small" />
        : <Text style={[s.btnText, { color: toneColor(tone) }]}>{label}</Text>}
    </Pressable>
  );
}

function SelectPill<T extends string>({
  options, value, onChange, colorMap,
}: {
  options: readonly T[]; value: T; onChange: (v: T) => void;
  colorMap?: Partial<Record<T, string>>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map(opt => {
          const active = opt === value;
          const color = colorMap?.[opt] ?? UI.info;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[s.pill, active
                ? { backgroundColor: color + '22', borderColor: color }
                : { backgroundColor: UI.card2, borderColor: UI.stroke2 }]}
            >
              <Text style={[s.pillText, { color: active ? color : UI.muted2 }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Slider personnalisé (visuel horizontal) */
function SimSlider({
  label, value, min = 0, max = 100, step = 1, onChange, unit = '',
}: {
  label: string; value: number; min?: number; max?: number;
  step?: number; onChange: (v: number) => void; unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const steps = Math.round((max - min) / step);

  function decrease() { onChange(Math.max(min, value - step)); }
  function increase() { onChange(Math.min(max, value + step)); }

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={[s.fieldLabel, { color: UI.ok, fontWeight: '700' }]}>
          {value}{unit}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={decrease} style={s.sliderBtn}>
          <Ionicons name="remove" size={16} color={UI.ink} />
        </Pressable>
        <View style={s.sliderTrack}>
          <View style={[s.sliderFill, { width: `${pct}%` as any }]} />
        </View>
        <Pressable onPress={increase} style={s.sliderBtn}>
          <Ionicons name="add" size={16} color={UI.ink} />
        </Pressable>
      </View>
      {steps <= 20 && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: steps + 1 }, (_, i) => min + i * step).map(v => (
            <Pressable key={v} onPress={() => onChange(v)}
              style={[s.stepBtn, v === value && { backgroundColor: UI.ok + '33', borderColor: UI.ok }]}>
              <Text style={[s.stepText, v === value && { color: UI.ok }]}>{v}{unit}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

interface EnrolledDevice {
  terminalId: number;
  deviceKey: string;
  deviceToken: string;
  serialNumber: string;
  displayName?: string;
  model?: string;
}

interface LogEntry {
  id: string;
  ts: string;
  msg: string;
  kind: 'ok' | 'err' | 'info' | 'step';
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SimulatorScreen() {
  // ── Terminaux disponibles ─────────────────────────────────────────────────
  const [terminals, setTerminals]           = useState<TerminalSummary[]>([]);

  // ── Section 1 — Enrôlement ───────────────────────────────────────────────
  const [enrollSN, setEnrollSN]             = useState(randomSN);
  const [enrollName, setEnrollName]         = useState('');
  const [enrollModel, setEnrollModel]       = useState(MODELS[0]);
  const [enrolling, setEnrolling]           = useState(false);
  const [lastEnrolled, setLastEnrolled]     = useState<EnrolledDevice | null>(null);

  // ── Section 2 — Télémétrie ───────────────────────────────────────────────
  const [telTarget, setTelTarget]           = useState<TerminalSummary | null>(null);
  const [telBattery, setTelBattery]         = useState(75);
  const [telSignal, setTelSignal]           = useState(3);
  const [telStorage, setTelStorage]         = useState(60);
  const [telNetwork, setTelNetwork]         = useState<typeof NETWORK_TYPES[number]>('CELL_4G');
  const [telGpsOn, setTelGpsOn]             = useState(true);
  const [telRealGps, setTelRealGps]         = useState<{ lat: number; lng: number } | null>(null);
  const [telCity, setTelCity]               = useState('Libreville');
  const [telCountry, setTelCountry]         = useState('Gabon');
  const [sending, setSending]               = useState(false);
  const [loadingDevice, setLoadingDevice]   = useState(false);
  const autoRef                             = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRunning, setAutoRunning]       = useState(false);

  // ── Section 3 — Événements ───────────────────────────────────────────────
  const [evtTarget, setEvtTarget]           = useState<TerminalSummary | null>(null);
  const [evtType, setEvtType]               = useState<EventType>('LOW_BATTERY');
  const [evtSeverity, setEvtSeverity]       = useState<EventSeverity>('WARN');
  const [evtMessage, setEvtMessage]         = useState('');
  const [sendingEvt, setSendingEvt]         = useState(false);

  // ── Section 4 — Scénarios ────────────────────────────────────────────────
  const [log, setLog]                       = useState<LogEntry[]>([]);
  const [scenarioRunning, setScenarioRunning] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Chargement terminaux
  // ─────────────────────────────────────────────────────────────────────────

  const refreshTerminals = useCallback(async () => {
    try {
      const list = await simulatorApi.listTerminals();
      setTerminals(list);
      if (!telTarget && list.length > 0) setTelTarget(list[0]);
      if (!evtTarget && list.length > 0) setEvtTarget(list[0]);
    } catch { /* silencieux */ }
  }, [telTarget, evtTarget]);

  useEffect(() => { refreshTerminals(); }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Journal
  // ─────────────────────────────────────────────────────────────────────────

  function addLog(msg: string, kind: LogEntry['kind'] = 'info') {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [{ id: Math.random().toString(), ts: now, msg, kind }, ...prev]);
  }

  function clearLog() { setLog([]); }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers : résout le deviceToken d'un terminal sélectionné
  // ─────────────────────────────────────────────────────────────────────────

  function tokenForTerminal(t: TerminalSummary | null): string | null {
    if (!t) return null;
    // Si c'est le dernier terminal enrôlé, on a son deviceToken
    if (lastEnrolled && lastEnrolled.terminalId === t.id) return lastEnrolled.deviceToken;
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lecture capteurs réels du device
  // ─────────────────────────────────────────────────────────────────────────

  async function loadFromDevice() {
    setLoadingDevice(true);
    try {
      await requestPermissions();
      const data = await buildLocalTelemetry();

      if (data.batteryPercent != null) setTelBattery(data.batteryPercent);

      if (data.networkType) {
        const net =
          data.networkType === 'WIFI'     ? 'WIFI' :
          data.networkType === 'ETHERNET' ? 'WIFI' :
          data.networkType === 'NONE'     ? 'NONE' :
          data.networkType === 'CELL_3G'  ? 'CELL_3G' :
          data.networkType === 'CELL_2G'  ? 'CELL_2G' :
          'CELL_4G';
        setTelNetwork(net as any);
      }

      if (data.gpsLat != null && data.gpsLng != null) {
        setTelRealGps({ lat: data.gpsLat, lng: data.gpsLng });
        setTelGpsOn(true);
      }

      if (data.city)    setTelCity(data.city);
      if (data.country) setTelCountry(data.country);

      Alert.alert(
        '✅ Données lues',
        `Batterie : ${data.batteryPercent ?? '?'}%\n` +
        `Réseau : ${data.networkType ?? '?'}\n` +
        `GPS : ${data.gpsLat != null ? `${data.gpsLat.toFixed(5)}, ${data.gpsLng!.toFixed(5)}` : 'non disponible'}\n` +
        `Ville : ${data.city ?? '—'}`,
      );
    } catch (e: any) {
      Alert.alert('Erreur lecture capteurs', e.message ?? String(e));
    } finally {
      setLoadingDevice(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 1 — Enrôlement
  // ─────────────────────────────────────────────────────────────────────────

  async function doEnroll() {
    if (!enrollSN.trim()) { Alert.alert('Erreur', 'Le numéro de série est requis'); return; }
    setEnrolling(true);
    try {
      const res: EnrollResponse = await simulatorApi.enroll({
        serialNumber: enrollSN.trim(),
        displayName: enrollName.trim() || undefined,
        model: enrollModel,
        manufacturer: enrollModel.startsWith('Sunmi') ? 'Sunmi' : 'Generic',
        deviceType: 'TPE',
        agentVersion: '2.0.0-sim',
        appPackage: 'com.orabank.tpe.simulator',
        appVersionName: '2.0.0',
      });
      const enrolled: EnrolledDevice = {
        terminalId: res.terminalId,
        deviceKey: res.deviceKey,
        deviceToken: res.deviceToken,
        serialNumber: enrollSN.trim(),
        displayName: enrollName.trim() || undefined,
        model: enrollModel,
      };
      setLastEnrolled(enrolled);
      await refreshTerminals();
      Alert.alert(
        '✅ Terminal enrôlé',
        `ID : ${res.terminalId}\nCLÉ : ${res.deviceKey}\n${res.created ? 'Nouveau terminal créé.' : 'Terminal existant récupéré.'}`,
      );
    } catch (e: any) {
      Alert.alert('❌ Erreur enrôlement', e.message ?? String(e));
    } finally {
      setEnrolling(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 2 — Télémétrie
  // ─────────────────────────────────────────────────────────────────────────

  function buildTelemetry(
    target: TerminalSummary,
    battery: number,
    signal: number,
    storePct: number,
    network: string,
    gpsOn: boolean,
    city: string,
    country: string,
    realGps?: { lat: number; lng: number } | null,
  ): TelemetryPushRequest {
    const gps = gpsOn ? (realGps ?? randomGPS()) : null;
    const totalMb = 64 * 1024; // 64 Go
    return {
      serialNumber: target.serialNumber ?? undefined,
      model: target.model ?? enrollModel,
      manufacturer: target.model?.startsWith('Sunmi') ? 'Sunmi' : 'Generic',
      batteryPercent: battery,
      charging: battery >= 95,
      networkType: network as any,
      signalLevel: signal,
      storageFreeMb: Math.round((storePct / 100) * totalMb),
      storageTotalMb: totalMb,
      ramAvailMb: 2048,
      ramTotalMb: 4096,
      gpsLat: gps?.lat ?? null,
      gpsLng: gps?.lng ?? null,
      gpsAccuracy: gpsOn ? 8 : null,
      city: city || null,
      country: country || null,
      addressLine: gpsOn ? `Quartier Lalala, ${city}` : null,
      agentVersion: '2.0.0-sim',
      appPackage: 'com.orabank.tpe.simulator',
      appVersionName: '2.0.0',
      uptimeSec: Math.floor(Math.random() * 86400),
    };
  }

  async function doSendTelemetry(
    target?: TerminalSummary,
    overrideBattery?: number,
    overrideGps?: { lat: number; lng: number } | null,
    overrideCity?: string,
    overrideCountry?: string,
  ) {
    const t = target ?? telTarget;
    if (!t) { Alert.alert('Erreur', 'Sélectionnez un terminal'); return; }
    const token = tokenForTerminal(t);
    if (!token) {
      Alert.alert('Token manquant', 'Enrôlez ce terminal d\'abord pour obtenir son deviceToken.');
      return;
    }
    setSending(true);
    try {
      const payload = buildTelemetry(
        t,
        overrideBattery ?? telBattery,
        telSignal,
        telStorage,
        telNetwork,
        telGpsOn,
        overrideCity ?? telCity,
        overrideCountry ?? telCountry,
        telRealGps,
      );
      if (overrideGps !== undefined && payload) {
        (payload as any).gpsLat = overrideGps?.lat ?? null;
        (payload as any).gpsLng = overrideGps?.lng ?? null;
      }
      await simulatorApi.pushTelemetry(payload, token);
    } catch (e: any) {
      Alert.alert('❌ Erreur télémétrie', e.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  function startAutoSend() {
    if (autoRunning) return;
    doSendTelemetry();
    const id = setInterval(() => doSendTelemetry(), 30_000);
    autoRef.current = id;
    setAutoRunning(true);
  }

  function stopAutoSend() {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; }
    setAutoRunning(false);
  }

  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current); }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3 — Événements
  // ─────────────────────────────────────────────────────────────────────────

  async function doSendEvent() {
    if (!evtTarget) { Alert.alert('Erreur', 'Sélectionnez un terminal'); return; }
    const token = tokenForTerminal(evtTarget);
    if (!token) {
      Alert.alert('Token manquant', 'Enrôlez ce terminal d\'abord.');
      return;
    }
    setSendingEvt(true);
    try {
      const body: EventLogRequest = {
        terminalId: evtTarget.id,
        type: evtType,
        severity: evtSeverity,
        message: evtMessage.trim() || null,
      };
      await simulatorApi.pushEvent(body, token);
      Alert.alert('✅ Événement envoyé', `${evtType} · ${evtSeverity}`);
    } catch (e: any) {
      Alert.alert('❌ Erreur événement', e.message ?? String(e));
    } finally {
      setSendingEvt(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 4 — Scénarios automatiques
  // ─────────────────────────────────────────────────────────────────────────

  async function runScenario(name: string, fn: () => Promise<void>) {
    if (scenarioRunning) return;
    setScenarioRunning(true);
    addLog(`▶ Démarrage scénario : ${name}`, 'step');
    try {
      await fn();
      addLog(`✅ Scénario "${name}" terminé`, 'ok');
    } catch (e: any) {
      addLog(`❌ Erreur : ${e.message ?? String(e)}`, 'err');
    } finally {
      setScenarioRunning(false);
      await refreshTerminals();
    }
  }

  async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function enrollForScenario(sn: string, model: string): Promise<EnrolledDevice> {
    addLog(`  🔧 Enrôlement : ${sn}`, 'info');
    const res = await simulatorApi.enroll({
      serialNumber: sn, model,
      manufacturer: model.startsWith('Sunmi') ? 'Sunmi' : 'Generic',
      deviceType: 'TPE', agentVersion: '2.0.0-sim',
    });
    const d: EnrolledDevice = {
      terminalId: res.terminalId, deviceKey: res.deviceKey, deviceToken: res.deviceToken,
      serialNumber: sn, model,
    };
    setLastEnrolled(d);
    addLog(`  ✅ Terminal ID ${res.terminalId} — ${res.created ? 'créé' : 'récupéré'}`, 'ok');
    return d;
  }

  async function pushTel(d: EnrolledDevice, battery: number, gps?: { lat: number; lng: number } | null, city = 'Libreville', country = 'Gabon') {
    const total = 64 * 1024;
    const payload: TelemetryPushRequest = {
      serialNumber: d.serialNumber, model: d.model,
      manufacturer: d.model?.startsWith('Sunmi') ? 'Sunmi' : 'Generic',
      batteryPercent: battery, charging: battery >= 95,
      networkType: 'CELL_4G', signalLevel: 3,
      storageFreeMb: Math.round(0.6 * total), storageTotalMb: total,
      gpsLat: gps === undefined ? randomGPS().lat : gps?.lat ?? null,
      gpsLng: gps === undefined ? randomGPS().lng : gps?.lng ?? null,
      gpsAccuracy: gps !== null ? 10 : null,
      city: city || null, country: country || null,
      addressLine: gps !== null ? `Quartier Test, ${city}` : null,
      agentVersion: '2.0.0-sim', uptimeSec: 3600,
    };
    await simulatorApi.pushTelemetry(payload, d.deviceToken);
    addLog(`  📡 Télémétrie → 🔋${battery}% · ${city}`, 'info');
  }

  async function pushEvt(d: EnrolledDevice, type: EventType, severity: EventSeverity, message?: string) {
    await simulatorApi.pushEvent({ terminalId: d.terminalId, type, severity, message: message ?? null }, d.deviceToken);
    addLog(`  ⚡ Événement → ${type} [${severity}]`, 'info');
  }

  // ── Scénario 1 : Nouveau TPE complet ────────────────────────────────────
  async function scenario1() {
    const sn = randomSN();
    const d  = await enrollForScenario(sn, 'Sunmi V2s');
    await sleep(500);
    await pushTel(d, 85);
    await sleep(1000);
    await pushTel(d, 22);
    await sleep(500);
    await pushEvt(d, 'LOW_BATTERY', 'WARN', 'Batterie faible détectée');
  }

  // ── Scénario 2 : Décharge batterie ──────────────────────────────────────
  async function scenario2() {
    const sn = randomSN();
    const d  = await enrollForScenario(sn, 'Sunmi V2 Pro');
    for (const pct of [80, 60, 40, 20, 5]) {
      await sleep(800);
      await pushTel(d, pct);
      if (pct <= 20) await pushEvt(d, 'LOW_BATTERY', pct <= 10 ? 'CRITICAL' : 'WARN', `Batterie à ${pct}%`);
    }
  }

  // ── Scénario 3 : Déconnexion ─────────────────────────────────────────────
  async function scenario3() {
    const sn = randomSN();
    const d  = await enrollForScenario(sn, 'itel A6610L');
    for (let i = 0; i < 3; i++) {
      await sleep(600);
      await pushTel(d, 70 - i * 5);
    }
    await sleep(500);
    await pushEvt(d, 'OFFLINE', 'CRITICAL', 'Terminal non joignable');
    addLog('  ⚠️  Terminal simulé hors ligne', 'step');
  }

  // ── Scénario 4 : Déplacement suspect ────────────────────────────────────
  async function scenario4() {
    const sn = randomSN();
    const d  = await enrollForScenario(sn, 'SM-A336E');
    addLog('  📍 Phase 1 : Libreville', 'step');
    for (let i = 0; i < 2; i++) {
      await sleep(700);
      await pushTel(d, 80, randomGPS(), 'Libreville', 'Gabon');
    }
    addLog('  📍 Phase 2 : Port-Gentil (déplacement anormal)', 'step');
    for (let i = 0; i < 2; i++) {
      await sleep(700);
      await pushTel(d, 75, randomGPSPortGentil(), 'Port-Gentil', 'Gabon');
    }
    await pushEvt(d, 'GPS_ANOMALY', 'CRITICAL', 'Déplacement suspect Libreville → Port-Gentil');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={[UI.bgTop, UI.bgMid, UI.bgBot]} style={s.flex}>
      <SafeAreaView style={s.flex} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['rgba(14,165,233,0.22)', 'rgba(15,23,42,0.94)', 'rgba(3,7,18,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <View style={s.heroGlow} />
            <View style={s.heroHeader}>
              <View style={s.heroCopy}>
                <Text style={s.heroEyebrow}>Simulation lab</Text>
                <Text style={s.heroTitle}>Console de tests TPE</Text>
                <Text style={s.heroSubtitle}>
                  Enrolement, telemetrie, evenements et scenarios pilotes dans une interface de supervision.
                </Text>
              </View>
              <View style={s.heroPill}>
                <Ionicons name="flask-outline" size={16} color={UI.info} />
                <Text style={s.heroPillText}>Mode testeur</Text>
              </View>
            </View>

            <View style={s.metricRow}>
              <MetricChip label="Terminaux charges" value={String(terminals.length)} tone="info" />
              <MetricChip label="Auto push" value={autoRunning ? 'Actif' : 'Arret'} tone={autoRunning ? 'ok' : 'warn'} />
              <MetricChip label="Scenario" value={scenarioRunning ? 'En cours' : 'Pret'} tone={scenarioRunning ? 'warn' : 'ok'} />
            </View>
          </LinearGradient>

          {/* ─── SECTION 1 — ENRÔLEMENT ───────────────────────────────────── */}
          <SectionCard title="Enrôler un TPE" icon="add-circle-outline">

            <Text style={s.fieldLabel}>Numéro de série</Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={enrollSN}
                onChangeText={setEnrollSN}
                placeholder="TEST-XXXXXX"
                placeholderTextColor={UI.faint}
                autoCapitalize="characters"
              />
              <Pressable style={s.genBtn} onPress={() => setEnrollSN(randomSN())}>
                <Ionicons name="refresh-outline" size={16} color={UI.info} />
              </Pressable>
            </View>

            <Text style={s.fieldLabel}>Nom d'affichage (optionnel)</Text>
            <TextInput
              style={s.input}
              value={enrollName}
              onChangeText={setEnrollName}
              placeholder="Ex: Caisse Agence Nord"
              placeholderTextColor={UI.faint}
            />

            <Text style={s.fieldLabel}>Modèle</Text>
            <SelectPill options={MODELS as any} value={enrollModel} onChange={setEnrollModel} />

            <SimBtn label="Enrôler ce terminal" onPress={doEnroll} loading={enrolling} tone="ok" />

            {lastEnrolled && (
              <View style={s.resultBox}>
                <Text style={s.resultTitle}>✅ Dernier enrôlé</Text>
                <Text style={s.resultLine}>ID : {lastEnrolled.terminalId}</Text>
                <Text style={s.resultLine}>SN : {lastEnrolled.serialNumber}</Text>
                <Text style={s.resultLine} numberOfLines={1}>Clé : {lastEnrolled.deviceKey}</Text>
                <Text style={[s.resultLine, { color: UI.warn }]} numberOfLines={2}>
                  Token : {lastEnrolled.deviceToken.slice(0, 40)}…
                </Text>
              </View>
            )}
          </SectionCard>

          {/* ─── SECTION 2 — TÉLÉMÉTRIE ───────────────────────────────────── */}
          <SectionCard title="Envoyer télémétrie" icon="pulse-outline">

            <Text style={s.fieldLabel}>Terminal cible</Text>
            <TerminalPicker
              terminals={terminals}
              value={telTarget}
              onChange={setTelTarget}
            />

            {/* Bouton lecture capteurs réels */}
            <SimBtn
              label={loadingDevice ? 'Lecture en cours…' : '📡 Lire mon appareil'}
              onPress={loadFromDevice}
              loading={loadingDevice}
              tone="info"
            />
            {telRealGps && (
              <View style={[s.warnBox, { borderColor: UI.ok + '55', backgroundColor: UI.ok + '11' }]}>
                <Ionicons name="location-outline" size={14} color={UI.ok} />
                <Text style={[s.warnText, { color: UI.ok }]}>
                  GPS réel : {telRealGps.lat.toFixed(5)}, {telRealGps.lng.toFixed(5)}
                </Text>
              </View>
            )}

            <SimSlider label="Batterie" value={telBattery} onChange={setTelBattery} unit="%" />
            <SimSlider label="Signal réseau" value={telSignal} min={0} max={4} step={1} onChange={setTelSignal} />
            <SimSlider label="Stockage libre" value={telStorage} onChange={setTelStorage} unit="%" />

            <Text style={s.fieldLabel}>Type réseau</Text>
            <SelectPill options={NETWORK_TYPES} value={telNetwork} onChange={setTelNetwork} />

            <View style={s.toggleRow}>
              <Text style={s.fieldLabel}>
                Inclure GPS {telRealGps ? '(position réelle)' : '(aléatoire Libreville)'}
              </Text>
              <Switch
                value={telGpsOn}
                onValueChange={v => { setTelGpsOn(v); if (!v) setTelRealGps(null); }}
                trackColor={{ false: UI.card2, true: UI.ok + '66' }}
                thumbColor={telGpsOn ? UI.ok : UI.muted2}
              />
            </View>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Ville</Text>
                <TextInput style={s.input} value={telCity} onChangeText={setTelCity} placeholderTextColor={UI.faint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Pays</Text>
                <TextInput style={s.input} value={telCountry} onChangeText={setTelCountry} placeholderTextColor={UI.faint} />
              </View>
            </View>

            {!tokenForTerminal(telTarget) && telTarget && (
              <View style={s.warnBox}>
                <Ionicons name="warning-outline" size={14} color={UI.warn} />
                <Text style={s.warnText}>Enrôlez d'abord ce terminal pour obtenir son deviceToken.</Text>
              </View>
            )}

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <SimBtn
                  label="Envoyer"
                  onPress={() => doSendTelemetry()}
                  loading={sending}
                  tone="ok"
                  disabled={!tokenForTerminal(telTarget)}
                />
              </View>
              <View style={{ flex: 1 }}>
                {autoRunning
                  ? <SimBtn label="⏹ Stop auto" onPress={stopAutoSend} tone="bad" />
                  : <SimBtn label="▶ Auto 30s" onPress={startAutoSend} tone="info"
                      disabled={!tokenForTerminal(telTarget)} />}
              </View>
            </View>
          </SectionCard>

          {/* ─── SECTION 3 — ÉVÉNEMENTS ───────────────────────────────────── */}
          <SectionCard title="Simuler un événement" icon="flash-outline">

            <Text style={s.fieldLabel}>Terminal cible</Text>
            <TerminalPicker
              terminals={terminals}
              value={evtTarget}
              onChange={setEvtTarget}
            />

            <Text style={s.fieldLabel}>Type d'événement</Text>
            <SelectPill
              options={EVENT_TYPES}
              value={evtType}
              onChange={setEvtType}
              colorMap={{
                OFFLINE: UI.bad, BACK_ONLINE: UI.ok, LOW_BATTERY: UI.warn,
                APP_CRASH: UI.bad, GPS_ANOMALY: UI.warn, STORAGE_LOW: UI.warn,
                SIM_CHANGE: UI.info, REBOOT: UI.info, NETWORK_LOSS: UI.bad,
              } as any}
            />

            <Text style={s.fieldLabel}>Sévérité</Text>
            <SelectPill
              options={SEVERITIES}
              value={evtSeverity}
              onChange={setEvtSeverity}
              colorMap={{ INFO: UI.info, WARN: UI.warn, CRITICAL: UI.bad }}
            />

            <Text style={s.fieldLabel}>Message (optionnel)</Text>
            <TextInput
              style={[s.input, { height: 60, textAlignVertical: 'top' }]}
              value={evtMessage}
              onChangeText={setEvtMessage}
              placeholder="Description de l'événement…"
              placeholderTextColor={UI.faint}
              multiline
            />

            {!tokenForTerminal(evtTarget) && evtTarget && (
              <View style={s.warnBox}>
                <Ionicons name="warning-outline" size={14} color={UI.warn} />
                <Text style={s.warnText}>Enrôlez d'abord ce terminal.</Text>
              </View>
            )}

            <SimBtn
              label="Envoyer l'événement"
              onPress={doSendEvent}
              loading={sendingEvt}
              tone="warn"
              disabled={!tokenForTerminal(evtTarget)}
            />
          </SectionCard>

          {/* ─── SECTION 4 — SCÉNARIOS AUTOMATIQUES ──────────────────────── */}
          <SectionCard title="Scénarios automatiques" icon="rocket-outline">
            <Text style={[s.fieldLabel, { marginBottom: 12 }]}>
              Chaque scénario enrôle un nouveau terminal et envoie des données en séquence.
            </Text>

            <ScenarioBtn
              label="1 · Nouveau TPE complet"
              sub="Enrôlement + télémétrie normale + alerte batterie faible"
              onPress={() => runScenario('Nouveau TPE complet', scenario1)}
              disabled={scenarioRunning}
              tone="ok"
            />
            <ScenarioBtn
              label="2 · Décharge batterie"
              sub="Enrôlement + 5 télémétries (80% → 5%)"
              onPress={() => runScenario('Décharge batterie', scenario2)}
              disabled={scenarioRunning}
              tone="warn"
            />
            <ScenarioBtn
              label="3 · Simulation déconnexion"
              sub="3 télémétries normales + événement OFFLINE"
              onPress={() => runScenario('Déconnexion', scenario3)}
              disabled={scenarioRunning}
              tone="bad"
            />
            <ScenarioBtn
              label="4 · Déplacement suspect"
              sub="2 positions Libreville + 2 Port-Gentil + alerte GPS"
              onPress={() => runScenario('Déplacement suspect', scenario4)}
              disabled={scenarioRunning}
              tone="info"
            />

            {/* Journal */}
            <View style={s.logHeader}>
              <Text style={s.logTitle}>Journal d'exécution</Text>
              <Pressable onPress={clearLog}>
                <Text style={s.logClear}>Effacer</Text>
              </Pressable>
            </View>
            {log.length === 0 ? (
              <Text style={s.logEmpty}>Aucune activité — lancez un scénario</Text>
            ) : (
              <View style={s.logBox}>
                {log.slice(0, 50).map(entry => (
                  <View key={entry.id} style={s.logEntry}>
                    <Text style={s.logTs}>{entry.ts}</Text>
                    <Text style={[s.logMsg, {
                      color: entry.kind === 'ok' ? UI.ok
                           : entry.kind === 'err' ? UI.bad
                           : entry.kind === 'step' ? UI.warn
                           : UI.muted,
                    }]}>{entry.msg}</Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants auxiliaires
// ─────────────────────────────────────────────────────────────────────────────

function TerminalPicker({
  terminals, value, onChange,
}: {
  terminals: TerminalSummary[];
  value: TerminalSummary | null;
  onChange: (t: TerminalSummary) => void;
}) {
  if (terminals.length === 0) {
    return <Text style={[s.fieldLabel, { color: UI.faint, marginBottom: 8 }]}>Aucun terminal — enrôlez-en un</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {terminals.slice(0, 20).map(t => {
          const active = value?.id === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t)}
              style={[s.pill,
                active ? { backgroundColor: UI.info + '22', borderColor: UI.info }
                       : { backgroundColor: UI.card2, borderColor: UI.stroke2 }]}
            >
              <Text style={[s.pillText, { color: active ? UI.info : UI.muted2 }]} numberOfLines={1}>
                {t.displayName ?? t.serialNumber ?? `#${t.id}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ScenarioBtn({
  label, sub, onPress, disabled, tone,
}: {
  label: string; sub: string; onPress: () => void;
  disabled?: boolean; tone: 'ok' | 'warn' | 'bad' | 'info';
}) {
  return (
    <Pressable
      style={[s.scenarioBtn, { borderLeftColor: toneColor(tone) }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[s.scenarioLabel, { color: toneColor(tone) }]}>{label}</Text>
      <Text style={s.scenarioSub}>{sub}</Text>
    </Pressable>
  );
}

function MetricChip({
  label,
  value,
  tone = 'info',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad' | 'info';
}) {
  return (
    <View style={[s.metricChip, { borderColor: `${toneColor(tone)}33` }]}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color: toneColor(tone) }]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    shadowColor: '#020617',
    shadowOpacity: 0.36,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(56,189,248,0.16)',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 18,
  },
  heroCopy: {
    flex: 1,
    maxWidth: 290,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: UI.info,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: UI.ink,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: UI.muted,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.22)',
    backgroundColor: 'rgba(15,23,42,0.52)',
  },
  heroPillText: {
    color: UI.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metricChip: {
    flexGrow: 1,
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(9,15,30,0.58)',
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: UI.muted2,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },

  sectionCard: {
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: 'rgba(10,18,34,0.62)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)',
    padding: 18, marginBottom: 0,
    shadowColor: '#020617',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.14)',
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: UI.ink,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  fieldLabel: { fontSize: 12, color: UI.muted2, marginBottom: 6, letterSpacing: 0.3 },

  input: {
    backgroundColor: 'rgba(8,15,28,0.72)', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)', color: UI.ink, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },

  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },

  genBtn: {
    backgroundColor: 'rgba(8,15,28,0.72)', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)', padding: 12, marginBottom: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  btn: {
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, minHeight: 46,
  },
  btnText: { fontSize: 14, fontWeight: '700' },

  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontSize: 12, fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },

  sliderTrack: {
    flex: 1, height: 6,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden',
  },
  sliderFill: { height: 6, backgroundColor: UI.ok, borderRadius: 3 },
  sliderBtn: {
    backgroundColor: 'rgba(8,15,28,0.72)', borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)',
  },
  stepBtn: {
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)',
    paddingHorizontal: 7, paddingVertical: 3,
  },
  stepText: { fontSize: 10, color: UI.muted2 },

  warnBox: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    backgroundColor: 'rgba(120,53,15,0.16)', borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  warnText: { flex: 1, fontSize: 12, color: UI.warn },

  resultBox: {
    backgroundColor: 'rgba(3,105,161,0.15)', borderRadius: 18, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.28)',
  },
  resultTitle: { fontSize: 13, fontWeight: '700', color: UI.ok, marginBottom: 6 },
  resultLine:  { fontSize: 12, color: UI.ink, marginBottom: 2 },

  scenarioBtn: {
    borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 14,
    backgroundColor: 'rgba(8,15,28,0.72)', borderRadius: 18, marginBottom: 10,
    borderTopRightRadius: 18, borderBottomRightRadius: 18,
    borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  scenarioLabel: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  scenarioSub:   { fontSize: 11, color: UI.muted2, lineHeight: 16 },

  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  logTitle:  { fontSize: 12, fontWeight: '700', color: UI.muted2, textTransform: 'uppercase', letterSpacing: 0.5 },
  logClear:  { fontSize: 12, color: UI.bad },
  logEmpty:  { fontSize: 12, color: UI.faint, fontStyle: 'italic', textAlign: 'center', padding: 12 },
  logBox:    {
    backgroundColor: 'rgba(2,6,23,0.66)',
    borderRadius: 18,
    padding: 12,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  logEntry:  { flexDirection: 'row', gap: 8, marginBottom: 7 },
  logTs:     { fontSize: 10, color: UI.faint, width: 60, flexShrink: 0 },
  logMsg:    { fontSize: 11, flex: 1, lineHeight: 16 },
});
