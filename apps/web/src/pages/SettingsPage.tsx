import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Settings, Building2, Mail, Palette, CheckCircle, AlertCircle, Loader2, Save, FlaskConical, Upload, Trash2, Image as ImageIcon, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";
import DemoEmailModal from "@/components/demo/DemoEmailModal";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: z.string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[\W_]/, "Debe contener al menos un símbolo"),
  confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

const emailSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newEmail: z.string().email("Ingresa un correo electrónico válido"),
});

type EmailForm = z.infer<typeof emailSchema>;

interface ClinicSettings {
  id: string;
  name: string;
  logo_url?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  registration_number?: string;
  primary_color?: string;
  consent_text?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_configured?: boolean;
}

export default function SettingsPage() {
  const { user, clearAuth } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";
  const navigate = useNavigate();

  const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
  const [demoEmailModal, setDemoEmailModal] = useState<{ open: boolean; recipient: string }>({
    open: false,
    recipient: "",
  });

  const [clinic, setClinic] = React.useState<ClinicSettings | null>(null);
  const [loadingClinic, setLoadingClinic] = React.useState(false);
  const [savingClinic, setSavingClinic] = React.useState(false);
  const [testingSmtp, setTestingSmtp] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [confirmDeleteLogo, setConfirmDeleteLogo] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 2FA state
  const [setup2fa, setSetup2fa] = React.useState<{ qr: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [verifying2fa, setVerifying2fa] = React.useState(false);
  const [disabling2fa, setDisabling2fa] = React.useState(false);
  const [disablePassword, setDisablePassword] = React.useState("");
  const [submittingDisable, setSubmittingDisable] = React.useState(false);

  const handleEnable2faInit = async () => {
    try {
      const res = await apiFetch<{ qr: string; secret: string }>("/auth/2fa/setup", {
        method: "POST",
      });
      setSetup2fa(res);
      setTotpCode("");
      toast.success("Código QR generado. Escanéalo con tu aplicación.");
    } catch (err: any) {
      toast.error(err.error || "Error al iniciar configuración 2FA");
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      toast.error("Ingresa el código de 6 dígitos");
      return;
    }
    setVerifying2fa(true);
    try {
      await apiFetch("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: totpCode }),
      });
      toast.success("¡Autenticación de dos factores (2FA) activada correctamente!");
      
      // Update store state
      const { user: currentUser, accessToken } = useAuthStore.getState();
      if (currentUser && accessToken) {
        useAuthStore.getState().setAuth({ ...currentUser, totp_enabled: true }, accessToken);
      }
      
      setSetup2fa(null);
      setTotpCode("");
    } catch (err: any) {
      toast.error(err.error || "Código inválido. Intenta de nuevo.");
    } finally {
      setVerifying2fa(false);
    }
  };

  const handleDisable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) {
      toast.error("Ingresa tu contraseña actual");
      return;
    }
    setSubmittingDisable(true);
    try {
      await apiFetch("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ currentPassword: disablePassword }),
      });
      toast.success("Autenticación de dos factores (2FA) desactivada correctamente.");
      
      // Update store state
      const { user: currentUser, accessToken } = useAuthStore.getState();
      if (currentUser && accessToken) {
        useAuthStore.getState().setAuth({ ...currentUser, totp_enabled: false }, accessToken);
      }
      
      setDisabling2fa(false);
      setDisablePassword("");
    } catch (err: any) {
      toast.error(err.error || "La contraseña es incorrecta");
    } finally {
      setSubmittingDisable(false);
    }
  };

  const {
    register: registerPwd,
    handleSubmit: handlePwdSubmit,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: isSubmittingPwd },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onChangePassword = async (data: PasswordForm) => {
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      toast.success("Contraseña actualizada correctamente. Por favor, inicia sesión de nuevo.");
      resetPwd();
      clearAuth();
      navigate("/login");
    } catch (err: any) {
      toast.error(err.error || "Error al cambiar la contraseña");
    }
  };

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    formState: { errors: emailErrors, isSubmitting: isSubmittingEmail },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  const onChangeEmail = async (data: EmailForm) => {
    try {
      const res = await apiFetch<{
        message: string;
        dev_verify_url?: string;
        demo_blocked?: boolean;
        demo_recipient?: string;
      }>("/auth/change-email", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newEmail: data.newEmail,
        }),
      });

      if (res.demo_blocked) {
        setDemoEmailModal({ open: true, recipient: res.demo_recipient ?? data.newEmail });
      } else {
        toast.success("Enlace de confirmación enviado a tu nuevo correo.");
      }
      resetEmail();
    } catch (err: any) {
      toast.error(err.error || "Error al solicitar el cambio de correo");
    }
  };

  // Form state for clinic info
  const [clinicForm, setClinicForm] = React.useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    registration_number: "",
    primary_color: "#0F6E56",
    consent_text: "",
  });

  // Form state for SMTP (separate, password not pre-filled)
  const [smtpForm, setSmtpForm] = React.useState({
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
  });

  // Load clinic settings on mount (admin only)
  React.useEffect(() => {
    if (!isAdmin) return;
    setLoadingClinic(true);
    apiFetch<ClinicSettings>("/clinic")
      .then((c) => {
        setClinic(c);
        setClinicForm({
          name: c.name ?? "",
          address: c.address ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          website: c.website ?? "",
          registration_number: c.registration_number ?? "",
          primary_color: c.primary_color ?? "#0F6E56",
          consent_text: c.consent_text ?? "",
        });
        setSmtpForm((prev) => ({
          ...prev,
          smtp_host: c.smtp_host ?? "",
          smtp_port: c.smtp_port ? String(c.smtp_port) : "587",
          smtp_user: c.smtp_user ?? "",
          // smtp_pass never returned from API for security
        }));
      })
      .catch(() => toast.error("Error al cargar configuración de la clínica"))
      .finally(() => setLoadingClinic(false));
  }, [isAdmin]);

  const handleSaveClinic = async () => {
    setSavingClinic(true);
    try {
      const updated = await apiFetch<ClinicSettings>("/clinic", {
        method: "PATCH",
        body: JSON.stringify({
          ...clinicForm,
          // Include SMTP if filled
          ...(smtpForm.smtp_host ? {
            smtp_host: smtpForm.smtp_host,
            smtp_port: smtpForm.smtp_port ? parseInt(smtpForm.smtp_port) : 587,
            smtp_user: smtpForm.smtp_user,
            ...(smtpForm.smtp_pass ? { smtp_pass: smtpForm.smtp_pass } : {}),
          } : {}),
        }),
      });
      setClinic(updated);
      window.dispatchEvent(new Event("clinic-updated"));
      toast.success("Configuración guardada correctamente");
    } catch (e: any) {
      toast.error(e.error || "Error al guardar configuración");
    } finally {
      setSavingClinic(false);
    }
  };

  const handleTestSmtp = async () => {
    // Validate that SMTP fields are filled before attempting test
    if (!smtpForm.smtp_host || !smtpForm.smtp_user) {
      toast.error("Completa el host y usuario SMTP antes de probar la conexión");
      return;
    }
    if (!smtpForm.smtp_pass && !clinic?.smtp_configured) {
      toast.error("Ingresa la contraseña SMTP (API Key de Brevo) antes de probar");
      return;
    }

    setTestingSmtp(true);
    try {
      // First, save the current SMTP config to the DB so the test endpoint can read it
      await apiFetch<ClinicSettings>("/clinic", {
        method: "PATCH",
        body: JSON.stringify({
          smtp_host: smtpForm.smtp_host,
          smtp_port: smtpForm.smtp_port ? parseInt(smtpForm.smtp_port) : 587,
          smtp_user: smtpForm.smtp_user,
          ...(smtpForm.smtp_pass ? { smtp_pass: smtpForm.smtp_pass } : {}),
        }),
      });

      // Then run the test
      await apiFetch("/clinic/smtp/test", { method: "POST" });
      toast.success("✅ Conexión SMTP verificada correctamente");
      // Mark smtp as configured now that the test passed
      setClinic((prev) => prev ? { ...prev, smtp_configured: true } : null);
    } catch (e: any) {
      toast.error(e.error || "Error al probar la conexión SMTP");
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 300;
      const MAX_HEIGHT = 300;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setUploadingLogo(false);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setUploadingLogo(false);
          return;
        }
        
        const formData = new FormData();
        // Append as png file because PDFKit only supports PNG/JPEG
        formData.append("logo", new File([blob], file.name.replace(/\.[^/.]+$/, ".png"), { type: "image/png" }));

        try {
          const res = await apiFetch<{ logo_url: string }>("/clinic/logo", {
            method: "POST",
            body: formData,
          });
          setClinic((prev) => prev ? { ...prev, logo_url: res.logo_url } : null);
          window.dispatchEvent(new Event("clinic-updated"));
          toast.success("Logo actualizado correctamente");
        } catch (err: any) {
          toast.error(err.error || "Error al subir el logo");
        } finally {
          setUploadingLogo(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }, "image/png");
    };

    img.onerror = () => {
      setUploadingLogo(false);
      toast.error("Error al procesar la imagen");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
  };

  const handleLogoDelete = async () => {
    setConfirmDeleteLogo(false);
    setUploadingLogo(true);
    try {
      await apiFetch("/clinic/logo", { method: "DELETE" });
      setClinic((prev) => prev ? { ...prev, logo_url: undefined } : null);
      window.dispatchEvent(new Event("clinic-updated"));
      toast.success("Logo eliminado correctamente");
    } catch (err: any) {
      toast.error(err.error || "Error al eliminar el logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <>
      <DemoEmailModal
        isOpen={demoEmailModal.open}
        recipient={demoEmailModal.recipient}
        onClose={() => setDemoEmailModal({ open: false, recipient: "" })}
      />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="text-emerald-600" size={24} />
          Configuración
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Gestiona la configuración de tu cuenta y clínica</p>
      </div>

      {/* Mi perfil */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-slate-700 dark:text-slate-300">
            Mi Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Nombre</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Correo</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{user?.email}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Rol</p>
              <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                {user?.role === "ADMIN" ? "Administrador" : user?.role === "SPECIALIST" ? "Especialista" : "Recepción"}
              </p>
            </div>
            {user?.professional_title && (
              <div>
                <p className="text-slate-500 dark:text-slate-400">Título</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{user.professional_title}</p>
              </div>
            )}
            {user?.license_number && (
              <div>
                <p className="text-slate-500 dark:text-slate-400">N° Colegiación</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{user.license_number}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seguridad */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <KeyRound size={18} className="text-emerald-600" />
            Seguridad y Accesos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Formulario de Contraseña */}
            <form onSubmit={handlePwdSubmit(onChangePassword)} className="space-y-4">
              <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">Cambiar Contraseña</h3>
              <div>
                <Input
                  id="current-password"
                  type="password"
                  label="Contraseña actual"
                  {...registerPwd("currentPassword")}
                  error={pwdErrors.currentPassword?.message}
                />
              </div>
              <div>
                <Input
                  id="new-password"
                  type="password"
                  label="Nueva contraseña"
                  {...registerPwd("newPassword")}
                  error={pwdErrors.newPassword?.message}
                />
                <p className="text-xs text-slate-500 mt-1">Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.</p>
              </div>
              <div>
                <Input
                  id="confirm-password"
                  type="password"
                  label="Confirmar nueva contraseña"
                  {...registerPwd("confirmPassword")}
                  error={pwdErrors.confirmPassword?.message}
                />
              </div>
              <Button
                type="submit"
                variant="default"
                isLoading={isSubmittingPwd}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                Cambiar contraseña
              </Button>
            </form>

            {/* Formulario de Correo */}
            <form onSubmit={handleEmailSubmit(onChangeEmail)} className="space-y-4">
              <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">Cambiar Correo Electrónico</h3>
              <div>
                <Input
                  id="email-current-password"
                  type="password"
                  label="Contraseña actual"
                  {...registerEmail("currentPassword")}
                  error={emailErrors.currentPassword?.message}
                />
              </div>
              <div>
                <Input
                  id="new-email"
                  type="email"
                  label="Nuevo correo electrónico"
                  {...registerEmail("newEmail")}
                  error={emailErrors.newEmail?.message}
                />
                <p className="text-xs text-slate-500 mt-1">Se enviará un enlace de verificación a esta dirección.</p>
              </div>
              <Button
                type="submit"
                variant="default"
                isLoading={isSubmittingEmail}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                Solicitar cambio de correo
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Autenticación de Dos Factores (2FA) */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <svg
              className="w-[18px] h-[18px] text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Autenticación de Dos Factores (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Añade una capa adicional de seguridad a tu cuenta. Al iniciar sesión, se te solicitará ingresar un código de seguridad generado por una aplicación autenticadora (como Google Authenticator o Authy).
          </p>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado:</span>
            {user?.totp_enabled ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                ● Activado (Seguro)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                ○ Desactivado
              </span>
            )}
          </div>

          {!user?.totp_enabled ? (
            // 2FA is Disabled
            setup2fa ? (
              // In setup state
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50 dark:bg-slate-900/50 space-y-4">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Configuración de Autenticador</h4>
                
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  {setup2fa.qr && (
                    <div className="bg-white p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex-shrink-0">
                      <img src={setup2fa.qr} alt="Código QR 2FA" className="w-40 h-40" />
                    </div>
                  )}
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <p className="font-medium text-slate-800 dark:text-slate-200">Instrucciones:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Escanea el código QR con tu aplicación autenticadora (ej. Google Authenticator, Authy, Microsoft Authenticator).</li>
                      <li>Si no puedes escanear el QR, ingresa esta clave manualmente en tu aplicación:</li>
                    </ol>
                    <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all flex justify-between items-center">
                      <span>{setup2fa.secret}</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleVerify2fa} className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <label htmlFor="totp-setup-code" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Ingresa el código de 6 dígitos para verificar y activar:
                  </label>
                  <div className="flex gap-2 max-w-xs">
                    <Input
                      id="totp-setup-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      className="text-center tracking-[0.5em] font-mono text-lg font-bold"
                    />
                    <Button
                      type="submit"
                      isLoading={verifying2fa}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-shrink-0"
                    >
                      Activar 2FA
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSetup2fa(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar configuración
                  </button>
                </form>
              </div>
            ) : (
              // Show Enable Button
              <Button
                type="button"
                onClick={handleEnable2faInit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Configurar autenticación 2FA
              </Button>
            )
          ) : (
            // 2FA is Enabled
            disabling2fa ? (
              // Confirm disable
              <form onSubmit={handleDisable2fa} className="border border-red-200 dark:border-red-900/30 rounded-xl p-5 bg-red-50/20 dark:bg-red-950/10 space-y-4">
                <h4 className="font-semibold text-red-800 dark:text-red-400 text-sm">Desactivar Autenticación de Dos Factores</h4>
                <p className="text-xs text-slate-500">
                  Por seguridad, ingresa tu contraseña actual para confirmar la desactivación del 2FA.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-end max-w-md">
                  <div className="flex-1 w-full">
                    <Input
                      id="2fa-disable-password"
                      type="password"
                      label="Contraseña actual"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      isLoading={submittingDisable}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                      Confirmar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDisabling2fa(false);
                        setDisablePassword("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              // Show Disable Button
              <Button
                type="button"
                onClick={() => setDisabling2fa(true)}
                className="bg-red-50 dark:bg-red-950/20 hover:bg-red-100 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-semibold"
              >
                Desactivar 2FA
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Admin only */}
      {isAdmin ? (
        <>
          {/* Configuración general de clínica */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Building2 size={18} className="text-emerald-600" />
                Información de la Clínica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingClinic ? (
                <div className="flex items-center gap-2 text-slate-400 py-4">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Cargando configuración...</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-6 mb-6">
                    <div className="flex-shrink-0 flex flex-col items-center gap-3">
                      <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group">
                        {clinic?.logo_url ? (
                          <img src={clinic.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="mx-auto text-slate-400 mb-2" size={24} />
                            <p className="text-xs text-slate-500 font-medium">Sin logo cargado</p>
                          </div>
                        )}
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center backdrop-blur-sm">
                            <Loader2 size={24} className="animate-spin text-emerald-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingLogo}
                        >
                          <Upload size={14} className="mr-2" />
                          {clinic?.logo_url ? "Cambiar logo" : "Subir logo"}
                        </Button>
                        {clinic?.logo_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                            onClick={() => setConfirmDeleteLogo(true)}
                            disabled={uploadingLogo}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Eliminar logo
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 gap-4">
                      <Input
                        id="clinic-name"
                        label="Nombre de la clínica *"
                        value={clinicForm.name}
                        onChange={(e) => setClinicForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Clínica Podológica San Martín"
                      />
                      <Input
                        id="clinic-registration"
                        label="N° Registro sanitario / Colegiación"
                        value={clinicForm.registration_number}
                        onChange={(e) => setClinicForm((p) => ({ ...p, registration_number: e.target.value }))}
                        placeholder="PS-2024-00123"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="clinic-phone"
                      label="Teléfono"
                      value={clinicForm.phone}
                      onChange={(e) => setClinicForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+56 9 1234 5678"
                    />
                    <Input
                      id="clinic-email"
                      label="Correo institucional"
                      type="email"
                      value={clinicForm.email}
                      onChange={(e) => setClinicForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="info@clinica.cl"
                    />
                    <Input
                      id="clinic-website"
                      label="Sitio web"
                      value={clinicForm.website}
                      onChange={(e) => setClinicForm((p) => ({ ...p, website: e.target.value }))}
                      placeholder="https://www.clinica.cl"
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Color corporativo (PDF)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          id="clinic-color"
                          type="color"
                          value={clinicForm.primary_color}
                          onChange={(e) => setClinicForm((p) => ({ ...p, primary_color: e.target.value }))}
                          className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                          {clinicForm.primary_color}
                        </span>
                        <div
                          className="flex-1 h-8 rounded-lg border border-slate-200"
                          style={{ backgroundColor: clinicForm.primary_color }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Input
                      id="clinic-address"
                      label="Dirección"
                      value={clinicForm.address}
                      onChange={(e) => setClinicForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Av. Principal 123, Santiago, Chile"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Texto del consentimiento informado
                    </label>
                    <textarea
                      id="clinic-consent"
                      rows={6}
                      value={clinicForm.consent_text}
                      onChange={(e) => setClinicForm((p) => ({ ...p, consent_text: e.target.value }))}
                      placeholder="Yo, [nombre del paciente], declaro que he sido informado/a sobre el tratamiento podológico que se me realizará..."
                      className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-slate-400">
                      Este texto aparecerá en la sección de consentimiento informado del formulario de consulta y en el PDF.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Configuración SMTP */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Mail size={18} className="text-emerald-600" />
                Configuración de Correo SMTP
                {clinic?.smtp_configured && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5">
                    <CheckCircle size={11} /> Configurado
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configura el servidor SMTP de tu clínica para enviar correos desde tu propio dominio.
                Si no se configura, se usa Ethereal Mail en modo desarrollo.
              </p>

              {!clinic?.smtp_configured && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm">
                  <AlertCircle size={15} />
                  SMTP no configurado. Los correos se enviarán via Ethereal Mail (solo desarrollo).
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    id="smtp-host"
                    label="Servidor SMTP (host)"
                    value={smtpForm.smtp_host}
                    onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <Input
                  id="smtp-port"
                  label="Puerto"
                  type="number"
                  value={smtpForm.smtp_port}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_port: e.target.value }))}
                  placeholder="587"
                />
                <Input
                  id="smtp-user"
                  label="Usuario SMTP"
                  value={smtpForm.smtp_user}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_user: e.target.value }))}
                  placeholder="correo@clinica.cl"
                />
                <div className="sm:col-span-2">
                  <Input
                    id="smtp-pass"
                    label={clinic?.smtp_configured ? "Contraseña SMTP (dejar vacío para mantener)" : "Contraseña SMTP"}
                    type="password"
                    value={smtpForm.smtp_pass}
                    onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_pass: e.target.value }))}
                    placeholder={clinic?.smtp_configured ? "••••••••••••" : "Contraseña o App Password"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <AlertCircle size={12} />
                Para Gmail: usa una "Contraseña de aplicación" (App Password) con 2FA activado.
                Puerto 587 (TLS) o 465 (SSL).
              </div>

              {clinic?.smtp_configured && (
                <Button
                  id="test-smtp-btn"
                  variant="outline"
                  size="sm"
                  onClick={handleTestSmtp}
                  isLoading={testingSmtp}
                  className="flex items-center gap-2"
                >
                  <FlaskConical size={14} />
                  Probar conexión SMTP
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Save button */}
          {!loadingClinic && (
            <div className="flex justify-end">
              <Button
                id="save-settings-btn"
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                onClick={handleSaveClinic}
                isLoading={savingClinic}
              >
                <Save size={16} />
                Guardar configuración
              </Button>
            </div>
          )}

          {/* Personalización */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Palette size={18} className="text-emerald-600" />
                Vista previa del diseño del PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-2xl flex justify-center">
                <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 font-sans space-y-4 relative overflow-hidden transition-all duration-300">
                  
                  {/* Watermark/header indicator */}
                  <div className="absolute top-2 right-3 text-[9px] font-bold text-slate-300 dark:text-slate-700 tracking-wider uppercase select-none">
                    Esquema de Color Real del PDF
                  </div>

                  {/* Header of PDF */}
                  <div className="flex justify-between items-start pt-2">
                    {/* Logo */}
                    <div className="w-16 h-8 bg-slate-50 dark:bg-slate-900 rounded border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                      {clinic?.logo_url ? (
                        <img src={clinic.logo_url} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <span className="text-[8px] text-slate-400 font-medium">Logo</span>
                      )}
                    </div>

                    {/* Clinic Information */}
                    <div className="text-right space-y-0.5">
                      <div 
                        className="text-xs font-extrabold uppercase tracking-wide transition-colors duration-300"
                        style={{ color: clinicForm.primary_color }}
                      >
                        {clinicForm.name || "PodoClinic"}
                      </div>
                      <div className="text-[8px] text-slate-400 dark:text-slate-500 leading-tight">
                        {clinicForm.address || "Av. Providencia 1234, Santiago"} <br />
                        {clinicForm.phone ? `Tel: ${clinicForm.phone}` : "Tel: +56 2 1234 5678"}
                      </div>
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className="border-b border-slate-200 dark:border-slate-800 w-full" />

                  {/* Title of PDF */}
                  <div className="text-center space-y-1">
                    <div 
                      className="text-base font-black tracking-wide transition-colors duration-300"
                      style={{ color: clinicForm.primary_color }}
                    >
                      INFORME CLÍNICO PODOLÓGICO
                    </div>
                    <div className="text-[8px] text-slate-400 dark:text-slate-500">
                      Consulta: Primera vez · 27 de mayo de 2026
                    </div>
                  </div>

                  {/* Specialist / Patient info blocks */}
                  <div className="grid grid-cols-2 gap-3 text-[8px]">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded p-2 border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="font-extrabold tracking-wider text-[7px]" style={{ color: clinicForm.primary_color }}>ESPECIALISTA RESPONSABLE</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{user?.full_name || "Dr. Ana González"}</div>
                      <div className="text-slate-500">{user?.professional_title || "Podóloga Clínica"}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded p-2 border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="font-extrabold tracking-wider text-[7px]" style={{ color: clinicForm.primary_color }}>PACIENTE</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">María Fernanda López</div>
                      <div className="text-slate-500">RUT: 12.345.678-9</div>
                    </div>
                  </div>

                  {/* Clinical Section Title & divider */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex flex-col">
                      <span 
                        className="text-[9px] font-black tracking-wider transition-colors duration-300 uppercase"
                        style={{ color: clinicForm.primary_color }}
                      >
                        PLAN DE TRATAMIENTO
                      </span>
                      <div 
                        className="h-[1.5px] w-full transition-colors duration-300"
                        style={{ backgroundColor: clinicForm.primary_color }}
                      />
                    </div>

                    {/* Section details */}
                    <div className="text-[8px] space-y-1">
                      <div className="flex gap-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Diagnóstico:</span>
                        <span className="text-slate-600 dark:text-slate-400">Pie plano bilateral, onicocriptosis leve en primer ortejo.</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Procedimientos:</span>
                        <span className="text-slate-600 dark:text-slate-400">Quiropodía clínica, corte espiculéctomía e hiperqueratosis.</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Esta vista previa refleja con precisión cómo el color corporativo y el logo se aplican en los títulos, bordes y cabeceras de tus informes PDF reales.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-slate-200 dark:border-slate-800 border-dashed">
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              La configuración de la clínica solo está disponible para administradores.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal Confirmar Eliminar Logo */}
      {confirmDeleteLogo && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDeleteLogo(false)}>
          <Card className="w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Eliminar Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
                ¿Estás seguro de que deseas eliminar el logo de la clínica?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirmDeleteLogo(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleLogoDelete} className="bg-red-600 hover:bg-red-700 text-white">
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
    </div>
    </>
  );
}
