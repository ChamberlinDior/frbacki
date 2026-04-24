/**
 * contexts/AuthContext.tsx — Contexte d'authentification global
 * Fournit : isLoading, isAuthenticated, username, role, login(), logout()
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authApi } from '../lib/api';
import * as tokenStore from '../lib/tokenStore';
import type { AuthResponse } from '../lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Type du contexte
// ─────────────────────────────────────────────────────────────────────────────

export type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  username: string | null;
  role: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading]           = useState(true);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [username, setUsername]             = useState<string | null>(null);
  const [role, setRole]                     = useState<string | null>(null);

  // Vérifie le token stocké au démarrage
  useEffect(() => {
    (async () => {
      const valid = await tokenStore.isAdminTokenValid();
      if (valid) {
        const [u, r] = await Promise.all([
          tokenStore.getAdminUsername(),
          tokenStore.getAdminRole(),
        ]);
        setUsername(u);
        setRole(r);
        setAuthenticated(true);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const res: AuthResponse = await authApi.login({ username: user, password });
    await tokenStore.saveAdminToken(res.token, res.expiresInMs, res.username, res.role);
    setUsername(res.username);
    setRole(res.role);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await tokenStore.clearAll();
    setAuthenticated(false);
    setUsername(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, username, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
