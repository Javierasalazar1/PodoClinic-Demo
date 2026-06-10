import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import DemoEmailModal from "@/components/demo/DemoEmailModal";

const forgotSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [demoModal, setDemoModal] = useState<{ open: boolean; recipient: string }>({
    open: false,
    recipient: "",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotForm) => {
    try {
      const res = await apiFetch<{
        message: string;
        dev_reset_url?: string;
        preview_url?: string;
        demo_blocked?: boolean;
        demo_recipient?: string;
      }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (res.demo_blocked) {
        setDemoModal({ open: true, recipient: res.demo_recipient ?? data.email });
      } else {
        toast.success(res.message);
      }
    } catch (err: any) {
      toast.error(err.error || "Error al enviar solicitud");
    }
  };

  return (
    <>
      <DemoEmailModal
        isOpen={demoModal.open}
        recipient={demoModal.recipient}
        onClose={() => setDemoModal({ open: false, recipient: "" })}
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/50 mb-4">
            <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Podelyx</h1>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-xl">Recuperar Contraseña</CardTitle>
            <CardDescription className="text-slate-400">
              Ingresa tu correo y te enviaremos las instrucciones para restablecerla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="[&_label]:text-slate-300 [&_input]:bg-slate-700/60 [&_input]:border-slate-600 [&_input]:text-white [&_input::placeholder]:text-slate-500">
                <Input
                  id="forgot-email"
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

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-900/30 mt-2"
                isLoading={isSubmitting}
              >
                Enviar enlace
              </Button>

              <div className="mt-4 text-center">
                <Link to="/login" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}
