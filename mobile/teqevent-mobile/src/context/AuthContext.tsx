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
  activeRole: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
const ACTIVE_ROLE_KEY = 'teqevent_active_role';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  // Hydrate token from SecureStore, then fetch fresh user data from /me.
  // We deliberately do NOT cache the user object — calling /me ensures
  // role changes (e.g. attendee → organizer) are always reflected on app start.
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
          const { data } = await authApi.me();
          setUser(data);
          // Restore saved active role, but validate it's still valid for this user
          const storedRole = await SecureStore.getItemAsync(ACTIVE_ROLE_KEY) as UserRole | null;
          const highestRole = getUserRole(data);
          const validRoles: UserRole[] = ['attendee'];
          if (data.is_organizer) validRoles.push('organizer');
          if (data.is_admin) validRoles.push('admin');
          const resolvedRole = storedRole && validRoles.includes(storedRole) ? storedRole : highestRole;
          setActiveRole(resolvedRole);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY);
        setToken(null);
        setUser(null);
        setActiveRole(null);
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
    const { data: userData } = await authApi.me();
    setUser(userData);
    // Default to highest role on fresh login, same as web
    const highestRole = getUserRole(userData);
    await SecureStore.setItemAsync(ACTIVE_ROLE_KEY, highestRole);
    setActiveRole(highestRole);
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
    await SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY);
    setActiveRole(null);
    await clearToken();
  }, []);

  const switchRole = useCallback(async (newRole: UserRole) => {
    await SecureStore.setItemAsync(ACTIVE_ROLE_KEY, newRole);
    setActiveRole(newRole);
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
        activeRole,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        refreshUser,
        switchRole,
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
