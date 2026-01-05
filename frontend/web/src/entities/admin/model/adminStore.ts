import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/shared/api/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface AdminAuthResponse {
  accessToken: string;
  expiresAt: string;
  username: string;
}

interface AdminState {
  isAdminAuthenticated: boolean;
  adminUsername: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<boolean>;
  clearError: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      isAdminAuthenticated: false,
      adminUsername: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AdminAuthResponse>('/admin/login', {
            username,
            password,
          });
          const { accessToken, username: adminUsername } = response.data;

          localStorage.setItem('adminToken', accessToken);
          set({
            isAdminAuthenticated: true,
            adminUsername,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Invalid admin credentials';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('adminToken');
        set({
          isAdminAuthenticated: false,
          adminUsername: null,
        });
      },

      verifyToken: async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          set({ isAdminAuthenticated: false, adminUsername: null });
          return false;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/admin/verify`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({ isAdminAuthenticated: true, adminUsername: data.username });
            return true;
          } else {
            get().logout();
            return false;
          }
        } catch {
          get().logout();
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'admin-storage',
      partialize: (state) => ({
        isAdminAuthenticated: state.isAdminAuthenticated,
        adminUsername: state.adminUsername,
      }),
    }
  )
);
