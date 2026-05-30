import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi, TOKEN_KEY, User, UserRole, getUserRole } from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isLoading: boolean;       // initial hydration from SecureStore + /me call
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate token from SecureStore, then fetch fresh user data from /me.
  // We deliberately do NOT cache the user object — calling /me ensures
  // role changes (e.g. attendee → organizer) are always reflected on app start.
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
          // Fetch fresh user — this validates the token too
          const { data } = await authApi.me();
          setUser(data);
        }
      } catch {
        // Token expired or network error — clear and start fresh
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistToken = async (accessToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    setToken(accessToken);
  };

  const clearToken = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });
    await persistToken(data.access_token);
    // Fetch fresh user after login
    const { data: userData } = await authApi.me();
    setUser(userData);
  }, []);

const register = useCallback(async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
) => {
  await authApi.register({
    email,
    password,
    first_name: firstName,
    last_name: lastName,
  });
  await login(email, password);
}, [login]);

  const logout = useCallback(async () => {
    // JWT is stateless — no server-side logout endpoint exists.
    // Simply clear the local token.
    await clearToken();
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await authApi.me();
    setUser(data);
  }, []);

  const role: UserRole | null = user ? getUserRole(user) : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
