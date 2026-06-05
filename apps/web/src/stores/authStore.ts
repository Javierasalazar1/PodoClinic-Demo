import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoggedOut: false,
      setAuth: (user, accessToken) => {
        sessionStorage.setItem("access_token", accessToken);
        set({ user, accessToken, isLoggedOut: false });
      },
      clearAuth: () => {
        sessionStorage.removeItem("access_token");
        set({ user: null, accessToken: null, isLoggedOut: true });
      },
      setAccessToken: (token) => {
        sessionStorage.setItem("access_token", token);
        set({ accessToken: token });
      },
    }),
    {
      name: "podoclinic-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);
