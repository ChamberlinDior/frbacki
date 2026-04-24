/**
 * app/(tabs)/profile.tsx — Écran Profil
 * Infos utilisateur, déconnexion, informations version
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../lib/api';
import { UI } from '../../constants/theme';

const ROLE_LABELS: Record<string, string> = {
  ADMIN:    'Administrateur',
  OPERATOR: 'Opérateur',
  VIEWER:   'Observateur',
  TESTER:   'Testeur · Simulation',
};

const ROLE_TONES: Record<string, 'bad' | 'warn' | 'info' | 'ok'> = {
  ADMIN:    'bad',
  OPERATOR: 'warn',
  VIEWER:   'info',
  TESTER:   'ok',
};

export default function ProfileScreen() {
  const { username, role, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetting, setResetting] = useState(false);

  function confirmLogout() {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: handleLogout,
        },
      ],
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  function confirmResetTestData() {
    Alert.alert(
      'Réinitialisation',
      'Supprimer tous les terminaux et relevés de test (préfixe SN:TEST-) ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: handleResetTestData },
      ],
    );
  }

  async function handleResetTestData() {
    setResetting(true);
    try {
      const res = await adminApi.resetTestData();
      Alert.alert(
        'Données réinitialisées',
        `${res.deletedTerminals} terminal(s) supprimé(s)\n${res.deletedTelemetries} relevé(s) supprimé(s)\n${res.deletedEvents} événement(s) supprimé(s)`,
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de réinitialiser les données');
    } finally {
      setResetting(false);
    }
  }

  const roleTone = role ? (ROLE_TONES[role] ?? 'info') : 'info';
  const roleColor = UI[roleTone];
  const roleBg    = UI[`${roleTone}Bg` as 'badBg' | 'warnBg' | 'infoBg' | 'okBg'];

  return (
    <LinearGradient colors={[UI.bgTop, UI.bgMid, UI.bgBot]} style={s.flex}>
      <SafeAreaView style={s.flex} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Avatar / Identité ─────────────────────────────────────────── */}
          <View style={s.avatarSection}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>
                {username?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
            <Text style={s.username}>{username ?? '—'}</Text>
            <View style={[s.roleBadge, { backgroundColor: roleBg }]}>
              <Text style={[s.roleText, { color: roleColor }]}>
                {role ? (ROLE_LABELS[role] ?? role) : '—'}
              </Text>
            </View>
          </View>

          {/* ── Infos session ─────────────────────────────────────────────── */}
          <BlurView intensity={14} tint="dark" style={s.section}>
            <Text style={s.sectionTitle}>Session</Text>
            <InfoRow icon="person-outline"    label="Identifiant"  value={username ?? '—'} />
            <InfoRow icon="shield-outline"    label="Rôle"         value={ROLE_LABELS[role ?? ''] ?? role ?? '—'} />
            <InfoRow icon="key-outline"       label="Authentification" value="JWT · Bearer" />
          </BlurView>

          {/* ── Application ───────────────────────────────────────────────── */}
          <BlurView intensity={14} tint="dark" style={s.section}>
            <Text style={s.sectionTitle}>Application</Text>
            <InfoRow icon="phone-portrait-outline"  label="Version"   value="v2.0.0" />
            <InfoRow icon="server-outline"          label="Plateforme" value="Orabank — MVET" />
            <InfoRow icon="cloud-outline"           label="API"        value={process.env.EXPO_PUBLIC_API_BASE_URL ?? '—'} />
          </BlurView>

          {role === 'ADMIN' && (
            <BlurView intensity={14} tint="dark" style={s.section}>
              <Text style={s.sectionTitle}>Administration</Text>
              <Pressable
                style={[s.dangerBtn, resetting && s.dangerDisabled]}
                onPress={confirmResetTestData}
                disabled={resetting}
              >
                <Ionicons name="trash-outline" size={20} color={UI.ink} />
                <Text style={s.dangerText}>
                  {resetting ? 'Réinitialisation…' : 'Réinitialiser les données de test'}
                </Text>
              </Pressable>
              <Text style={s.warningText}>
                Supprime uniquement les terminaux dont deviceKey commence par SN:TEST-
              </Text>
            </BlurView>
          )}

          {/* ── Déconnexion ───────────────────────────────────────────────── */}
          <Pressable
            style={[s.logoutBtn, loggingOut && s.logoutDisabled]}
            onPress={confirmLogout}
            disabled={loggingOut}
          >
            <Ionicons name="log-out-outline" size={20} color={UI.bad} />
            <Text style={s.logoutText}>
              {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
            </Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant ligne info
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={r.row}>
      <View style={r.iconWrap}>
        <Ionicons name={icon as any} size={16} color={UI.info} />
      </View>
      <Text style={r.label}>{label}</Text>
      <Text style={r.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  iconWrap:{ width: 30, alignItems: 'center' },
  label:   { flex: 1, fontSize: 14, color: UI.muted },
  value:   { fontSize: 14, color: UI.ink, fontWeight: '600', maxWidth: '45%' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: UI.infoBg, borderWidth: 2, borderColor: `${UI.info}55`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 30, fontWeight: '800', color: UI.info },
  username:     { fontSize: 22, fontWeight: '800', color: UI.ink },
  roleBadge:    { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  roleText:     { fontSize: 13, fontWeight: '700' },

  section: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: UI.card, borderWidth: 1, borderColor: UI.stroke,
    paddingHorizontal: 16, paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: UI.muted2,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingTop: 14, paddingBottom: 4,
  },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 16, paddingVertical: 16,
    backgroundColor: UI.badBg, borderWidth: 1, borderColor: `${UI.bad}44`,
  },
  logoutDisabled: { opacity: 0.5 },
  logoutText: { color: UI.bad, fontWeight: '700', fontSize: 16 },

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: UI.bad,
    borderWidth: 1,
    borderColor: `${UI.bad}66`,
    marginTop: 10,
  },
  dangerDisabled: { opacity: 0.5 },
  dangerText: { color: UI.ink, fontWeight: '800', fontSize: 14 },
  warningText: { color: UI.muted2, fontSize: 12, marginTop: 10, lineHeight: 16 },
});
