import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User) => void;
  clearUser: () => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user, loading: false, error: null }),
  clearUser: () => set({ user: null, loading: false, error: null }),
  setError: (error) => set({ error, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
