import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@cgp/shared';
import { api, ApiError, type MeResponse } from '../services/api';
import { useTheme } from './ThemeContext';

interface AuthContextValue {
  user: UserDTO | null;
  activeRoadmapId: string | null;
  isLoading: boolean;
  /** Set when the session check failed for a reason other than "not logged in". */
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await api.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false, staleTime: 60_000 });

  // Apply the saved theme preference once the user is known.
  const savedTheme = me.data?.user.preferences.theme;
  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme, setTheme]);

  const afterAuth = async () => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    await queryClient.refetchQueries({ queryKey: ['me'] });
  };

  const loginMutation = useMutation({ mutationFn: (v: { email: string; password: string }) => api.login(v), onSuccess: afterAuth });
  const registerMutation = useMutation({ mutationFn: (v: { name: string; email: string; password: string }) => api.register(v), onSuccess: afterAuth });

  const value: AuthContextValue = {
    user: me.data?.user ?? null,
    activeRoadmapId: me.data?.activeRoadmapId ?? null,
    isLoading: me.isPending,
    error: me.error,
    login: async (email, password) => {
      await loginMutation.mutateAsync({ email, password });
    },
    register: async (name, email, password) => {
      await registerMutation.mutateAsync({ name, email, password });
    },
    logout: async () => {
      await api.logout().catch(() => undefined);
      queryClient.clear();
      queryClient.setQueryData(['me'], null);
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
