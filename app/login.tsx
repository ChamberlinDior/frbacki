/**
 * app/login.tsx — Écran de connexion administrateur
 * Design dark glass morphism — Orabank / MVET
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';
import { UI } from '../constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.status === 401
            ? 'Identifiants incorrects.'
            : `Erreur serveur (${e.status}) — vérifiez la connexion.`,
        );
      } else {
        setError('Impossible de joindre le serveur. Vérifiez le réseau.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[UI.bgTop, UI.bgMid, UI.bgBot]}
      style={StyleSheet.absoluteFill}
    >
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.kav}
        >
          {/* ── Logo / En-tête ─────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.logoBox}>
              <Ionicons name="card-outline" size={40} color={UI.ok} />
            </View>
            <Text style={s.appName}>TPE Monitoring</Text>
            <Text style={s.subtitle}>Orabank — MVET</Text>
          </View>

          {/* ── Carte formulaire ───────────────────────────────────────────── */}
          <BlurView intensity={18} tint="dark" style={s.card}>
            <Text style={s.cardTitle}>Connexion</Text>

            {/* Identifiant */}
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={UI.muted2} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Nom d'utilisateur"
                placeholderTextColor={UI.faint}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Mot de passe */}
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={UI.muted2} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Mot de passe"
                placeholderTextColor={UI.faint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPwd(v => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPwd ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={UI.muted2}
                />
              </Pressable>
            </View>

            {/* Message d'erreur */}
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={UI.bad} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Bouton connexion */}
            <Pressable
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={UI.black} size="small" />
                : <Text style={s.btnText}>Se connecter</Text>
              }
            </Pressable>
          </BlurView>

          <Text style={s.hint}>Accès réservé aux administrateurs Orabank</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1 },
  kav:       { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  header:    { alignItems: 'center', marginBottom: 32 },
  logoBox:   {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: UI.okBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: `${UI.ok}44`,
  },
  appName:   { fontSize: 24, fontWeight: '800', color: UI.ink, letterSpacing: 0.5 },
  subtitle:  { fontSize: 13, color: UI.muted2, marginTop: 4 },

  card: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 24,
    borderWidth: 1,
    borderColor: UI.stroke,
    backgroundColor: UI.card,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: UI.ink, marginBottom: 20 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.stroke2,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: UI.ink,
    fontSize: 15,
  },
  eyeBtn: { padding: 4 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.badBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: { color: UI.bad, fontSize: 13, flex: 1 },

  btn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: UI.ok,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: UI.black, fontWeight: '800', fontSize: 16 },

  hint: {
    color: UI.faint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
