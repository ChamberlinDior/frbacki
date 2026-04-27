import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Tabs } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { UI } from '../../constants/theme';
import { useAlerts } from '../../contexts/AlertContext';
import { useAuth } from '../../contexts/AuthContext';
import { alertsApi } from '../../lib/api';

function AlertBadge({ count, collapsed }: { count: number; collapsed?: boolean }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badgeWrap, collapsed && styles.badgeWrapCollapsed]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

function DesktopSidebar({
  state,
  descriptors,
  navigation,
  totalBadge,
}: BottomTabBarProps & { totalBadge: number }) {
  const { username, role, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter((route) => route.name !== 'simulator' || role === 'TESTER'),
    [role, state.routes],
  );

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  function confirmLogout() {
    Alert.alert('Deconnexion', 'Voulez-vous fermer la session administrateur ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Deconnecter', style: 'destructive', onPress: () => void handleLogout() },
    ]);
  }

  return (
    <View style={[styles.sidebarShell, collapsed && styles.sidebarShellCollapsed]}>
      <LinearGradient
        colors={['rgba(5,12,24,0.98)', 'rgba(11,20,38,0.97)', 'rgba(8,16,30,0.98)']}
        style={[styles.sidebarCard, collapsed && styles.sidebarCardCollapsed]}
      >
        <View style={styles.sidebarGlowTop} />
        <View style={styles.sidebarGlowBottom} />

        <View style={styles.sidebarHeader}>
          <View style={[styles.brandOrbWrap, collapsed && styles.brandOrbWrapCollapsed]}>
            <View style={styles.brandOrbOuter}>
              <View style={styles.brandOrbInner}>
                <Ionicons name="shield-half-outline" size={collapsed ? 18 : 20} color="#dbeafe" />
              </View>
            </View>
          </View>

          {!collapsed ? (
            <View style={styles.brandCopy}>
              <Text style={styles.brandEyebrow}>TPE monitoring</Text>
              <Text style={styles.brandTitle}>Control wall</Text>
              <Text style={styles.brandSub}>Supervision, geofence et alertes critiques</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.collapseBtn, collapsed && styles.collapseBtnCollapsed]}
            onPress={() => setCollapsed((value) => !value)}
          >
            <Ionicons
              name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'}
              size={18}
              color="#d7e6f3"
            />
          </Pressable>
        </View>

        {!collapsed ? (
          <BlurView intensity={18} tint="dark" style={styles.operatorCard}>
            <Text style={styles.operatorLabel}>Session active</Text>
            <Text style={styles.operatorName} numberOfLines={1}>{username ?? 'Operateur'}</Text>
            <Text style={styles.operatorRole} numberOfLines={1}>{role ?? 'ADMIN'}</Text>
          </BlurView>
        ) : null}

        <ScrollView
          style={styles.sidebarScroll}
          contentContainerStyle={styles.sidebarScrollContent}
          showsVerticalScrollIndicator
        >
          <View style={styles.navList}>
            {visibleRoutes.map((route, index) => {
              const descriptor = descriptors[route.key];
              const options = descriptor.options;
              const isFocused = state.index === state.routes.findIndex((item) => item.key === route.key);
              const color = isFocused ? '#f8fbff' : '#8aa3bb';
              const size = collapsed ? 22 : 20;
              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : typeof options.title === 'string'
                    ? options.title
                    : route.name;

              const icon =
                route.name === 'index'
                  ? 'grid-outline'
                  : route.name === 'telemetry'
                    ? 'pulse-outline'
                    : route.name === 'alerts'
                      ? 'notifications-outline'
                      : route.name === 'profile'
                        ? 'person-outline'
                        : 'flask-outline';

              return (
                <Pressable
                  key={route.key}
                  onPress={() => navigation.navigate(route.name)}
                  style={[
                    styles.navItem,
                    collapsed && styles.navItemCollapsed,
                    isFocused && styles.navItemActive,
                    isFocused && collapsed && styles.navItemActiveCollapsed,
                  ]}
                >
                  <View style={[styles.navIconWell, isFocused && styles.navIconWellActive]}>
                    <Ionicons name={icon as any} size={size} color={color} />
                    {route.name === 'alerts' ? (
                      <AlertBadge count={totalBadge} collapsed={collapsed} />
                    ) : null}
                  </View>

                  {!collapsed ? (
                    <View style={styles.navCopy}>
                      <Text style={[styles.navLabel, isFocused && styles.navLabelActive]}>{label}</Text>
                      <Text style={[styles.navHint, isFocused && styles.navHintActive]}>
                        {route.name === 'index'
                          ? 'Parc et terminaux'
                          : route.name === 'telemetry'
                            ? 'Flux et etat live'
                            : route.name === 'alerts'
                              ? 'Centre d intervention'
                              : route.name === 'profile'
                                ? 'Compte et securite'
                                : 'Scenario de test'}
                      </Text>
                    </View>
                  ) : null}

                  {!collapsed && isFocused ? <View style={styles.navActiveEdge} /> : null}
                  {!collapsed && index < visibleRoutes.length - 1 ? <View style={styles.navDivider} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sidebarFooter}>
            <Pressable
              style={[styles.logoutCard, collapsed && styles.logoutCardCollapsed]}
              onPress={confirmLogout}
            >
              <View style={styles.logoutIconWell}>
                <Ionicons name="log-out-outline" size={20} color="#fca5a5" />
              </View>
              {!collapsed ? (
                <View style={styles.logoutCopy}>
                  <Text style={styles.logoutLabel}>Deconnexion</Text>
                  <Text style={styles.logoutHint}>Fermer la session securisee</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

export default function TabLayout() {
  const { role } = useAuth();
  const isTester = role === 'TESTER';
  const { width } = useWindowDimensions();
  const [alertCount, setAlertCount] = useState(0);
  const { triggeredCount } = useAlerts();
  const useSidebar = Platform.OS === 'web' && width >= 1120;

  useEffect(() => {
    let alive = true;

    async function fetchCount() {
      try {
        const page = await alertsApi.list(0, 1);
        if (alive) setAlertCount(page.totalElements);
      } catch {}
    }

    void fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const totalBadge = alertCount + triggeredCount;
  const customTabBar = useSidebar
    ? (props: BottomTabBarProps) => <DesktopSidebar {...props} totalBadge={totalBadge} />
    : undefined;

  return (
    <Tabs
      tabBar={customTabBar}
      screenOptions={{
        tabBarPosition: useSidebar ? 'left' : 'bottom',
        tabBarStyle: useSidebar
          ? { display: 'none' }
          : {
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              borderRadius: 22,
              backgroundColor: 'rgba(10, 28, 43, 0.92)',
              borderTopColor: 'rgba(255,255,255,0.08)',
              borderTopWidth: 1,
              height: 68,
              paddingBottom: 8,
              paddingTop: 8,
              shadowColor: '#04111E',
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.24,
              shadowRadius: 24,
              elevation: 16,
            },
        tabBarActiveTintColor: '#F4FBFF',
        tabBarInactiveTintColor: '#7D95AA',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        headerStyle: { backgroundColor: UI.bgTop },
        headerTintColor: UI.ink,
        headerTitleStyle: { fontWeight: '800' },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
        },
        tabBarActiveBackgroundColor: 'rgba(255,255,255,0.08)',
        sceneStyle: {
          backgroundColor: UI.page,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tableau de bord',
          tabBarLabel: 'Terminaux',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="telemetry"
        options={{
          title: 'Telemetrie',
          tabBarLabel: 'Telemetrie',
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color} />,
        }}
      />

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

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="simulator"
        options={
          isTester
            ? {
                title: 'Simulateur',
                tabBarLabel: 'Simulateur',
                tabBarIcon: ({ color, size }) => <Ionicons name="flask-outline" size={size} color={color} />,
              }
            : {
                href: null,
              }
        }
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: UI.bad,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeWrapCollapsed: {
    top: -6,
    right: -6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  sidebarShell: {
    paddingLeft: 12,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: UI.page,
  },
  sidebarShellCollapsed: {
    paddingLeft: 10,
  },
  sidebarCard: {
    width: 292,
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    shadowColor: '#020617',
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 20,
  },
  sidebarCardCollapsed: {
    width: 108,
    paddingHorizontal: 12,
    overflow: 'visible',
  },
  sidebarGlowTop: {
    position: 'absolute',
    top: -60,
    right: -35,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  sidebarGlowBottom: {
    position: 'absolute',
    bottom: -40,
    left: -24,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  brandOrbWrap: {
    padding: 4,
  },
  brandOrbWrapCollapsed: {
    paddingTop: 8,
  },
  brandOrbOuter: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 8 },
    elevation: 10,
  },
  brandOrbInner: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: {
    flex: 1,
    paddingTop: 4,
  },
  brandEyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  brandTitle: {
    color: '#f8fbff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 6,
    textShadowColor: 'rgba(56,189,248,0.18)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 18,
  },
  brandSub: {
    color: '#89a0b7',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  collapseBtn: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(13,26,48,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    zIndex: 20,
  },
  collapseBtnCollapsed: {
    right: -18,
    top: 20,
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(14,31,56,0.99)',
    borderColor: 'rgba(125,211,252,0.32)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  operatorCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    marginBottom: 14,
  },
  operatorLabel: {
    color: '#8aa3bb',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  operatorName: {
    color: '#f8fbff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  operatorRole: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  navList: {
    gap: 10,
  },
  sidebarScroll: {
    flex: 1,
    marginTop: 6,
  },
  sidebarScrollContent: {
    paddingBottom: 8,
    gap: 14,
  },
  navItem: {
    position: 'relative',
    minHeight: 84,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#020617',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 6, height: 8 },
    elevation: 6,
  },
  navItemCollapsed: {
    minHeight: 72,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(96,165,250,0.18)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: -6, height: -6 },
  },
  navItemActiveCollapsed: {
    paddingHorizontal: 10,
  },
  navIconWell: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(8,15,28,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 7, height: 7 },
    elevation: 10,
  },
  navIconWellActive: {
    backgroundColor: 'rgba(12,26,49,0.96)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: -4, height: -4 },
  },
  navCopy: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  navLabel: {
    color: '#d2deea',
    fontSize: 16,
    fontWeight: '900',
  },
  navLabelActive: {
    color: '#f8fbff',
    textShadowColor: 'rgba(56,189,248,0.18)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 16,
  },
  navHint: {
    color: '#6d87a0',
    fontSize: 12,
    fontWeight: '700',
  },
  navHintActive: {
    color: '#96b2ca',
  },
  navActiveEdge: {
    position: 'absolute',
    right: 10,
    top: 20,
    bottom: 20,
    width: 4,
    borderRadius: 999,
    backgroundColor: '#7dd3fc',
  },
  navDivider: {
    position: 'absolute',
    left: 78,
    right: 14,
    bottom: -6,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  sidebarFooter: {
    paddingTop: 6,
  },
  logoutCard: {
    minHeight: 72,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(127,29,29,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoutCardCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  logoutIconWell: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: 'rgba(69,10,10,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCopy: {
    flex: 1,
    gap: 4,
  },
  logoutLabel: {
    color: '#fecaca',
    fontSize: 15,
    fontWeight: '900',
  },
  logoutHint: {
    color: '#b99191',
    fontSize: 12,
    fontWeight: '700',
  },
});
