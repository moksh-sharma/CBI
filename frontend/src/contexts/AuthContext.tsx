import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPost, clearToken, setOnUnauthorized, setToken } from '../lib/api';

export type Role = 'admin' | 'developer' | 'viewer';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
  role_name: Role;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

interface AuthProviderProps {
  children: ReactNode;
  onUnauthorized?: () => void;
}

export function AuthProvider({ children, onUnauthorized }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    loading: true,
    error: null,
  });

  const logout = useCallback(() => {
    clearToken();
    setState({ user: null, token: null, loading: false, error: null });
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    setState((s) => ({ ...s, user: null, token: null }));
    onUnauthorized?.();
  }, [onUnauthorized]);

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized);
  }, [handleUnauthorized]);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem('token');
    if (!t) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiGet<User>('/api/auth/me');
      if (res.success && res.data) {
        setState({ user: res.data, token: t, loading: false, error: null });
      } else {
        clearToken();
        setState({ user: null, token: null, loading: false, error: null });
      }
    } catch {
      clearToken();
      setState({ user: null, token: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await apiPost<{ user: User; token: string }>('/api/auth/login', {
          email,
          password,
        });
        if (!res.success || !res.data?.token || !res.data?.user) {
          throw new Error(res.message || 'Login failed');
        }
        const { user, token } = res.data;
        setToken(token);
        setState({ user, token, loading: false, error: null });
        return user;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Login failed';
        setState((s) => ({
          ...s,
          loading: false,
          error: msg,
          user: null,
          token: null,
        }));
        throw e;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
