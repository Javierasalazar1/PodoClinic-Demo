import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";

// Inactivity limits
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutos
const COUNTDOWN_MS = 60 * 1000; // 60 seconds

export default function SessionManager() {
  const navigate = useNavigate();
  const { clearAuth, accessToken, updateActivity } = useAuthStore();
  
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  // Handle session-expired custom event (from apiFetch 401 interceptor)
  useEffect(() => {
    const handleSessionExpired = () => {
      toast.error("Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
      navigate("/login", { replace: true });
    };

    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, [navigate]);

  // Inactivity Timer Logic
  useEffect(() => {
    if (!accessToken) return;

    let inactivityTimeout: ReturnType<typeof setTimeout>;
    let countdownInterval: ReturnType<typeof setInterval>;

    const logout = async () => {
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } catch {
        // silent
      }
      clearAuth();
      toast.error("Tu sesión ha expirado por inactividad.");
      navigate("/login", { replace: true });
      setShowWarning(false);
    };

    const resetTimer = () => {
      if (showWarning) return; // Don't reset if warning is already showing
      updateActivity();
      
      clearTimeout(inactivityTimeout);
      clearInterval(countdownInterval);

      inactivityTimeout = setTimeout(() => {
        setShowWarning(true);
        setTimeLeft(60);
        
        countdownInterval = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              logout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, INACTIVITY_LIMIT_MS);
    };

    // Events that reset inactivity timer
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    
    events.forEach(event => document.addEventListener(event, resetTimer));
    resetTimer(); // init

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimer));
      clearTimeout(inactivityTimeout);
      clearInterval(countdownInterval);
    };
  }, [accessToken, showWarning, navigate, clearAuth]);

  const handleContinue = async () => {
    try {
      // Refresh token silently to ensure session is valid
      await apiFetch("/auth/refresh", { method: "POST" });
      setShowWarning(false);
      toast.success("Sesión renovada", { duration: 2000 });
    } catch {
      setShowWarning(false);
      clearAuth();
      window.dispatchEvent(new CustomEvent("session-expired"));
    }
  };

  if (!showWarning) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center gap-4 mb-4 text-amber-500">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Inactividad Detectada</h2>
        </div>
        
        <p className="text-slate-300 mb-6 leading-relaxed">
          Tu sesión está a punto de expirar por inactividad. ¿Deseas continuar?
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-2xl font-mono font-bold text-amber-400">
            00:{timeLeft.toString().padStart(2, "0")}
          </span>
          <Button 
            onClick={handleContinue}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20"
          >
            Continuar sesión
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
