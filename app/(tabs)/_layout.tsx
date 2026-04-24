/**
 * app/(tabs)/_layout.tsx — Navigation à 4 onglets
 * Tableau de bord · Télémétrie · Alertes · Profil
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { alertsApi } from '../../lib/api';
import { UI } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useAlerts } from '../../contexts/AlertContext';

// Badge rouge pour le nombre d'alertes actives
function AlertBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badge.wrap}>
      <Text style={badge.text}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -4, right: -8,
    backgroundColor: UI.bad,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

export default function TabLayout() {
  const { role } = useAuth();
  const isTester = role === 'TESTER';
  const [alertCount, setAlertCount] = useState(0);
  const { triggeredCount } = useAlerts();

  // Comptage des alertes actives au montage (rafraîchi toutes les 60 s)
  useEffect(() => {
    let alive = true;

    async function fetchCount() {
      try {
        const page = await alertsApi.list(0, 1);
        if (alive) setAlertCount(page.totalElements);
      } catch { /* silencieux */ }
    }

    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const totalBadge = alertCount + triggeredCount;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: UI.bgTop,
          borderTopColor:  UI.stroke,
          borderTopWidth:  1,
          height: 60,
          paddingBottom: 6,
        },
        tabBarActiveTintColor:   UI.ink,
        tabBarInactiveTintColor: UI.muted2,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle:      { backgroundColor: UI.bgTop },
        headerTintColor:  UI.ink,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {/* ── Tableau de bord ──────────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tableau de bord',
          tabBarLabel: 'Terminaux',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ── Télémétrie ───────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="telemetry"
        options={{
          title: 'Télémétrie',
          tabBarLabel: 'Télémétrie',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ── Alertes (avec badge) ─────────────────────────────────────────── */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertes',
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications-outline" size={size} color={color} />
              <AlertBadge count={totalBadge} />
            </View>
          ),
        }}
      />

      {/* ── Profil ───────────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ── Simulateur (TESTER uniquement) ───────────────────────────────── */}
      <Tabs.Screen
        name="simulator"
        options={isTester ? {
          title: 'Simulateur',
          tabBarLabel: 'Simulateur',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flask-outline" size={size} color={color} />
          ),
        } : {
          // Caché pour les autres rôles — l'entrée existe mais sans icône/label
          href: null,
        }}
      />
    </Tabs>
  );
}
