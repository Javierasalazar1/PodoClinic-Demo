import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(6, "La contraseña es demasiado corta"),
  totp_code: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: "ADMIN" | "SPECIALIST" | "RECEPTION";
    clinic_id: string;
    professional_title?: string;
    license_number?: string;
    totp_enabled: boolean;
  };
  requiresTotp?: boolean;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTotp, setRequiresTotp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (res.requiresTotp && !data.totp_code) {
        setRequiresTotp(true);
        toast("Ingresa tu código de autenticación de 2 factores", {
          icon: "🔐",
        });
        return;
      }

      setAuth(res.user, res.accessToken);
      toast.success(`¡Bienvenid@, ${res.user.full_name}!`);
      
      const redirectPath = sessionStorage.getItem("redirectPath");
      if (redirectPath) {
        sessionStorage.removeItem("redirectPath");
        navigate(redirectPath, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      toast.error(apiErr.error ?? "Error al iniciar sesión");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/50 mb-4">
            <svg
              className="w-9 h-9 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            PodoClinic
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Sistema de Historial Clínico Podológico
          </p>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-xl">
              {requiresTotp ? "Verificación 2FA" : "Iniciar Sesión"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {requiresTotp
                ? "Ingresa el código de 6 dígitos de tu aplicación autenticadora"
                : "Accede a tu cuenta con tus credenciales"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              id="login-form"
            >
              {!requiresTotp ? (
                <>
                  <div className="[&_label]:text-slate-300 [&_input]:bg-slate-700/60 [&_input]:border-slate-600 [&_input]:text-white [&_input::placeholder]:text-slate-500">
                    <Input
                      id="login-email"
                      label="Correo electrónico"
                      type="email"
                      placeholder="especialista@clinica.cl"
                      required
                      autoComplete="email"
                      icon={<Mail className="w-4 h-4" />}
                      error={errors.email?.message}
                      {...register("email")}
                    />
                  </div>

                  <div className="[&_label]:text-slate-300 [&_input]:bg-slate-700/60 [&_input]:border-slate-600 [&_input]:text-white [&_input::placeholder]:text-slate-500">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="login-password"
                        className="text-sm font-medium text-slate-300"
                      >
                        Contraseña{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="flex h-9 w-full rounded-md border border-slate-600 bg-slate-700/60 px-3 py-1 text-sm text-white shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 pl-9 pr-10"
                          {...register("password")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          aria-label={
                            showPassword
                              ? "Ocultar contraseña"
                              : "Mostrar contraseña"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-xs text-destructive">
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="[&_label]:text-slate-300 [&_input]:bg-slate-700/60 [&_input]:border-slate-600 [&_input]:text-white [&_input::placeholder]:text-slate-500">
                  <Input
                    id="login-totp"
                    label="Código de autenticación"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    required
                    autoComplete="one-time-code"
                    icon={<ShieldCheck className="w-4 h-4" />}
                    error={errors.totp_code?.message}
                    {...register("totp_code")}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-900/30 mt-2"
                isLoading={isSubmitting}
                id="login-submit-btn"
              >
                {requiresTotp ? "Verificar código" : "Ingresar"}
              </Button>

              {requiresTotp && (
                <button
                  type="button"
                  onClick={() => setRequiresTotp(false)}
                  className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Volver al inicio de sesión
                </button>
              )}
            </form>

            {!requiresTotp && (
              <div className="mt-4 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} PodoClinic — Sistema de gestión podológica
        </p>

        <a
          href="https://github.com/Javierasalazar1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 mt-2 text-[12px] text-slate-600 hover:text-emerald-400 transition-colors duration-200"
        >
          <span>Desarrollado por <span className="font-medium">Javiera S.</span></span>
          <svg height="13" width="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
