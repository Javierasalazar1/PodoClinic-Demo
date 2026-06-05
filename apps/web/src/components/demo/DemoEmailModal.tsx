import React from "react";
import { X, Mail, AlertCircle } from "lucide-react";

interface DemoEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: string;
}

/**
 * Modal que se muestra en modo demo cuando el usuario intenta
 * enviar un correo electrónico (recuperar contraseña, cambio de email, etc.)
 * Informa que en demo los correos no se envían realmente.
 */
export default function DemoEmailModal({ isOpen, onClose, recipient }: DemoEmailModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-email-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-800 border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-900/20 overflow-hidden">
        {/* Header amarillo */}
        <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-b border-amber-500/30 px-6 py-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2
              id="demo-email-modal-title"
              className="text-amber-300 font-semibold text-base leading-tight"
            >
              Versión Demo — Correo no enviado
            </h2>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Funcionalidad simulada en entorno de demostración
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto flex-shrink-0 text-slate-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 bg-slate-700/40 rounded-xl p-4 border border-slate-600/40">
            <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-300 text-sm leading-relaxed">
                En la versión demo el correo{" "}
                <span className="font-semibold text-white">no se envía realmente</span>.
              </p>
              <p className="text-slate-400 text-sm mt-2">
                En producción llegaría a:
              </p>
              <p className="text-cyan-400 font-mono text-sm font-medium mt-1 break-all">
                {recipient}
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            <p className="text-amber-300/90 text-xs leading-relaxed">
              💡 Para probar la aplicación completa con envío real de correos,
              configura tu propio servidor SMTP en Configuración → Clínica.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-cyan-900/30"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
