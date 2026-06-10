import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";

interface PrivateRouteProps {
  children: React.ReactNode;
  roles?: Array<"ADMIN" | "SPECIALIST" | "RECEPTION">;
}

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user, accessToken, isLoggedOut, setAuth, clearAuth, checkInactivity } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(!accessToken && !isLoggedOut);

  useEffect(() => {
    // Si hay token pero hay inactividad de más de 10 minutos, hacer logout
    if (accessToken && checkInactivity()) {
      clearAuth();
      navigate("/login", { replace: true });
      return;
    }

    // Si no hay token y no fue logout explícito, intentar restaurar sesión via refresh cookie
    if (!accessToken && !isLoggedOut) {
      const initAuth = async () => {
        try {
          const res = await apiFetch<{ accessToken: string; user: unknown }>("/auth/refresh", {
            method: "POST",
          });
          setAuth(res.user as Parameters<typeof setAuth>[0], res.accessToken);

          const redirectPath = localStorage.getItem("redirectPath");
          if (redirectPath) {
            localStorage.removeItem("redirectPath");
            navigate(redirectPath, { replace: true });
          }
        } catch {
          clearAuth();
          localStorage.setItem("redirectPath", location.pathname + location.search);
        } finally {
          setIsInitializing(false);
        }
      };
      initAuth();
    }
  }, [accessToken, isLoggedOut, setAuth, clearAuth, checkInactivity, location, navigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 animate-pulse">Restaurando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
