import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
const LAST_ACTIVITY_KEY = "Podelyx-last-activity";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "ADMIN" | "SPECIALIST" | "RECEPTION";
  clinic_id: string;
  professional_title?: string;
  license_number?: string;
  totp_enabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoggedOut: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
  checkInactivity: () => boolean;
  updateActivity: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoggedOut: false,

      setAuth: (user, accessToken) => {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        set({ user, accessToken, isLoggedOut: false });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        set({ user: null, accessToken: null, isLoggedOut: true });
      },

      setAccessToken: (token) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        set({ accessToken: token });
      },

      updateActivity: () => {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      },

      checkInactivity: () => {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!lastActivity) return true; // sin registro => expirada
        return Date.now() - parseInt(lastActivity) > INACTIVITY_TIMEOUT_MS;
      },
    }),
    {
      name: "Podelyx-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);
