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

import { UI } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../lib/api';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  OPERATOR: 'Operateur',
  VIEWER: 'Observateur',
  TESTER: 'Testeur simulation',
};

const ROLE_TONES: Record<string, 'bad' | 'warn' | 'info' | 'ok'> = {
  ADMIN: 'bad',
  OPERATOR: 'warn',
  VIEWER: 'info',
  TESTER: 'ok',
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={16} color={UI.info} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { username, role, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetting, setResetting] = useState(false);

  const roleTone = role ? (ROLE_TONES[role] ?? 'info') : 'info';
  const roleColor = UI[roleTone];
  const roleBg = UI[`${roleTone}Bg` as 'badBg' | 'warnBg' | 'infoBg' | 'okBg'];

  function confirmLogout() {
    Alert.alert('Deconnexion', 'Voulez-vous vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Deconnecter',
        style: 'destructive',
        onPress: handleLogout,
      },
    ]);
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
      'Reinitialisation',
      'Supprimer tous les terminaux et releves de test (prefixe SN:TEST-) ? Cette action est irreversible.',
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
        'Donnees reinitialisees',
        `${res.deletedTerminals} terminal(s) supprime(s)\n${res.deletedTelemetries} releve(s) supprime(s)\n${res.deletedEvents} evenement(s) supprime(s)`,
      );
    } catch (error: any) {
      Alert.alert('Erreur', error?.message ?? 'Impossible de reinitialiser les donnees');
    } finally {
      setResetting(false);
    }
  }

  return (
    <LinearGradient colors={[UI.bgTop, UI.bgMid, UI.bgBot]} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['rgba(37,99,235,0.26)', 'rgba(15,23,42,0.94)', 'rgba(3,7,18,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>Control room access</Text>
                <Text style={styles.heroTitle}>Profil et securite</Text>
                <Text style={styles.heroSubtitle}>
                  Vue operateur pour l identite, le role, les actions sensibles et la session active.
                </Text>
              </View>

              <View style={styles.heroBadge}>
                <Ionicons name="shield-checkmark-outline" size={16} color={UI.info} />
                <Text style={styles.heroBadgeText}>
                  {role ? (ROLE_LABELS[role] ?? role) : 'Session'}
                </Text>
              </View>
            </View>

            <View style={styles.avatarSection}>
              <View style={styles.avatarHalo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {username?.charAt(0).toUpperCase() ?? '?'}
                  </Text>
                </View>
              </View>
              <Text style={styles.username}>{username ?? '—'}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
                <Text style={[styles.roleText, { color: roleColor }]}>
                  {role ? (ROLE_LABELS[role] ?? role) : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Role actif</Text>
                <Text style={styles.metricValue}>{role ? (ROLE_LABELS[role] ?? role) : '—'}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Authentification</Text>
                <Text style={styles.metricValue}>JWT Bearer</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Canal</Text>
                <Text style={styles.metricValue}>Console securisee</Text>
              </View>
            </View>
          </LinearGradient>

          <BlurView intensity={18} tint="dark" style={styles.section}>
            <Text style={styles.sectionTitle}>Session</Text>
            <InfoRow icon="person-outline" label="Identifiant" value={username ?? '—'} />
            <InfoRow
              icon="shield-outline"
              label="Role"
              value={ROLE_LABELS[role ?? ''] ?? role ?? '—'}
            />
            <InfoRow icon="key-outline" label="Authentification" value="JWT Bearer" />
          </BlurView>

          <BlurView intensity={18} tint="dark" style={styles.section}>
            <Text style={styles.sectionTitle}>Plateforme</Text>
            <InfoRow icon="phone-portrait-outline" label="Version" value="v2.0.0" />
            <InfoRow icon="server-outline" label="Plateforme" value="Orabank - MVET" />
            <InfoRow
              icon="cloud-outline"
              label="API"
              value={process.env.EXPO_PUBLIC_API_BASE_URL ?? '—'}
            />
          </BlurView>

          {role === 'ADMIN' && (
            <BlurView intensity={18} tint="dark" style={styles.section}>
              <Text style={styles.sectionTitle}>Administration</Text>
              <Pressable
                style={[styles.dangerBtn, resetting && styles.disabled]}
                onPress={confirmResetTestData}
                disabled={resetting}
              >
                <Ionicons name="trash-outline" size={20} color={UI.ink} />
                <Text style={styles.dangerText}>
                  {resetting ? 'Reinitialisation...' : 'Reinitialiser les donnees de test'}
                </Text>
              </Pressable>
              <Text style={styles.warningText}>
                Supprime uniquement les terminaux dont deviceKey commence par SN:TEST-.
              </Text>
            </BlurView>
          )}

          <Pressable
            style={[styles.logoutBtn, loggingOut && styles.disabled]}
            onPress={confirmLogout}
            disabled={loggingOut}
          >
            <Ionicons name="log-out-outline" size={20} color={UI.bad} />
            <Text style={styles.logoutText}>
              {loggingOut ? 'Deconnexion...' : 'Se deconnecter'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    shadowColor: '#020617',
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  heroGlow: {
    position: 'absolute',
    top: -42,
    right: -18,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    maxWidth: 290,
  },
  eyebrow: {
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
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    backgroundColor: 'rgba(15,23,42,0.52)',
  },
  heroBadgeText: {
    color: UI.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  avatarHalo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.24)',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(20,34,62,0.92)',
    borderWidth: 2,
    borderColor: `${UI.info}66`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 34,
    fontWeight: '800',
    color: '#dbeafe',
  },
  username: {
    fontSize: 24,
    fontWeight: '800',
    color: UI.ink,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(9,15,30,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: UI.muted2,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.ink,
  },

  section: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,18,34,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#020617',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.muted2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 14,
    paddingBottom: 8,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
  },
  infoIconWrap: {
    width: 30,
    alignItems: 'center',
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: UI.muted,
  },
  infoValue: {
    fontSize: 14,
    color: UI.ink,
    fontWeight: '600',
    maxWidth: '45%',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 22,
    paddingVertical: 18,
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderWidth: 1,
    borderColor: `${UI.bad}44`,
    shadowColor: UI.bad,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logoutText: {
    color: UI.bad,
    fontWeight: '700',
    fontSize: 16,
  },

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: 'rgba(185,28,28,0.86)',
    borderWidth: 1,
    borderColor: `${UI.bad}88`,
    marginTop: 10,
  },
  dangerText: {
    color: UI.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  warningText: {
    color: UI.muted2,
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.5,
  },
});
