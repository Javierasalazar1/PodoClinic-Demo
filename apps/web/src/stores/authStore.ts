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
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => {
        sessionStorage.setItem("access_token", accessToken);
        set({ user, accessToken });
      },
      clearAuth: () => {
        sessionStorage.removeItem("access_token");
        set({ user: null, accessToken: null });
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
