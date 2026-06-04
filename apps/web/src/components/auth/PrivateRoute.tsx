import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";

interface PrivateRouteProps {
  children: React.ReactNode;
  roles?: Array<"ADMIN" | "SPECIALIST" | "RECEPTION">;
}

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(!accessToken);

  useEffect(() => {
    if (!accessToken) {
      const initAuth = async () => {
        try {
          const res = await apiFetch<{ accessToken: string; user: any }>("/auth/refresh", {
            method: "POST",
          });
          setAuth(res.user, res.accessToken);
          
          const redirectPath = sessionStorage.getItem("redirectPath");
          if (redirectPath) {
            sessionStorage.removeItem("redirectPath");
            navigate(redirectPath, { replace: true });
          }
        } catch (err) {
          clearAuth();
          sessionStorage.setItem("redirectPath", location.pathname + location.search);
        } finally {
          setIsInitializing(false);
        }
      };
      initAuth();
    }
  }, [accessToken, setAuth, clearAuth, location, navigate]);

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
