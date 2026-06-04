import React, { useRef, useEffect } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/Button";
import { RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  existingDataUrl?: string;
  disabled?: boolean;
  isActive?: boolean;
}

/**
 * Componente de firma digital.
 * El paciente firma con dedo (móvil) o mouse (escritorio).
 */
export default function SignaturePad({ onSave, existingDataUrl, disabled, isActive }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onSaveRef = useRef(onSave);
  const lastLoadedUrlRef = useRef<string>("");

  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // Resize canvas to match display size
    const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "#1e293b",
      minWidth: 1.5,
      maxWidth: 3,
    });
    const handleEndStroke = () => {
      if (!pad.isEmpty()) {
        const dataUrl = pad.toDataURL();
        lastLoadedUrlRef.current = dataUrl;
        onSaveRef.current(dataUrl);
      }
    };
    pad.addEventListener("endStroke", handleEndStroke);
    padRef.current = pad;

    if (existingDataUrl) {
      pad.fromDataURL(existingDataUrl);
      lastLoadedUrlRef.current = existingDataUrl;
    } else {
      lastLoadedUrlRef.current = "";
    }

    if (disabled) {
      pad.off();
    }

    return () => {
      pad.off();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, isActive]);

  useEffect(() => {
    if (padRef.current && existingDataUrl && existingDataUrl !== lastLoadedUrlRef.current) {
      padRef.current.fromDataURL(existingDataUrl);
      lastLoadedUrlRef.current = existingDataUrl;
    }
  }, [existingDataUrl]);

  const clear = () => {
    if (padRef.current) {
      padRef.current.clear();
      lastLoadedUrlRef.current = "";
      onSaveRef.current("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: 180 }}
        />
        {!disabled && (
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-400 pointer-events-none">
            Firme aquí con dedo o mouse
          </p>
        )}
      </div>
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <RotateCcw size={13} className="mr-1" />
          Borrar firma
        </Button>
      )}
    </div>
  );
}
