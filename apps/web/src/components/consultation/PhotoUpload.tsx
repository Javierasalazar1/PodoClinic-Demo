import React, { useRef, useState } from "react";
import { Camera, Upload, X, Tag, Download } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import Lightbox from "./Lightbox";

export interface PhotoItem {
  id: string;
  url: string;
  thumbnail_url: string;
  label: string;
}

interface PhotoUploadProps {
  consultationId: string | null;
  photos: PhotoItem[];
  onPhotosChange: (photos: PhotoItem[]) => void;
  disabled?: boolean;
}

/**
 * Componente de carga de fotografía clínica.
 * Soporta selección de archivo y captura directa desde cámara.
 * Comprime imágenes en el cliente (Canvas API) antes de subir al servidor.
 */
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const compressImage = async (file: File): Promise<{ blob: Blob; originalSize: number; newSize: number }> => {
  return new Promise((resolve, reject) => {
    // Check if it's HEIC because Canvas doesn't support it natively in most browsers
    if (file.type.toLowerCase().includes("heic")) {
      return reject(new Error("Formato HEIC no soportado por Canvas nativo. Por favor, convierte a JPG."));
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const maxDim = 1920;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context failed"));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) return reject(new Error("Canvas toBlob failed"));
          resolve({
            blob,
            originalSize: file.size,
            newSize: blob.size,
          });
        },
        "image/jpeg",
        0.88
      );
    };
    
    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Error al cargar la imagen en el canvas (puede estar corrupta o no ser una imagen válida)."));
    };

    img.src = objectUrl;
  });
};
export default function PhotoUpload({ consultationId, photos, onPhotosChange, disabled }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [processingFiles, setProcessingFiles] = useState<{ id: string; name: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleDownloadPhoto = async (photo: PhotoItem) => {
    try {
      const res = await apiFetch<{ url: string }>(`/consultations/${consultationId}/photos/${photo.id}/download-url`);
      const imgRes = await fetch(res.url);
      const blob = await imgRes.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeLabel = (photo.label || "foto").replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];
      link.download = `paciente_${safeLabel}_${dateStr}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Descarga iniciada");
    } catch {
      toast.error("Error al descargar la imagen");
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!consultationId) {
      toast.error("Guarda el borrador antes de subir fotos");
      return;
    }

    const arrayFiles = Array.from(files);
    
    if (photos.length + arrayFiles.length + processingFiles.length > 10) {
      toast.error("Máximo 10 fotos por consulta");
      return;
    }

    const newResults: PhotoItem[] = [];

    await Promise.all(arrayFiles.map(async (file, index) => {
      if (!["image/jpeg", "image/png", "image/heic", "image/jpg", "image/webp"].includes(file.type.toLowerCase())) {
        toast.error(`Formato no soportado: ${file.name}`);
        return;
      }

      const processId = Math.random().toString(36).substring(7);
      setProcessingFiles(prev => [...prev, { id: processId, name: file.name }]);

      try {
        const { blob, originalSize, newSize } = await compressImage(file);
        
        if (blob.size > 5 * 1024 * 1024) {
          toast.error(`La imagen es demasiado grande incluso después de optimizarla (${formatBytes(blob.size)}). Intenta con otra imagen.`);
          setProcessingFiles(prev => prev.filter(p => p.id !== processId));
          return;
        }

        toast.success(`Imagen optimizada: ${formatBytes(originalSize)} → ${formatBytes(newSize)}`);

        const formData = new FormData();
        formData.append("photo", blob, file.name.replace(/\.[^/.]+$/, "") + ".jpg"); 
        formData.append("order_index", String(photos.length + index)); 

        const result = await apiFetch<PhotoItem>(`/consultations/${consultationId}/photos`, {
          method: "POST",
          body: formData,
        });

        newResults.push(result);
      } catch (err: any) {
        const errorMsg = err?.error || err?.message || "Error desconocido";
        toast.error(`Error (${file.name}): ${errorMsg}`);
      } finally {
        setProcessingFiles(prev => prev.filter(p => p.id !== processId));
      }
    }));

    if (newResults.length > 0) {
      onPhotosChange([...photos, ...newResults]);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!consultationId) return;
    try {
      await apiFetch(`/consultations/${consultationId}/photos/${photoId}`, { method: "DELETE" });
      onPhotosChange(photos.filter((p) => p.id !== photoId));
      toast.success("Foto eliminada");
    } catch {
      toast.error("Error al eliminar foto");
    }
  };

  const handleLabelChange = async (photoId: string, label: string) => {
    // Update local state immediately for responsive UI
    onPhotosChange(photos.map((p) => p.id === photoId ? { ...p, label } : p));
    setEditingLabel(null);
    // Persist to backend
    if (consultationId) {
      try {
        await apiFetch(`/consultations/${consultationId}/photos/${photoId}`, {
          method: "PATCH",
          body: JSON.stringify({ label }),
        });
      } catch {
        // Non-critical: label saved locally but not in DB
      }
    }
  };

  return (
    <div className="space-y-4">
      {!disabled && (
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length + processingFiles.length >= 10}
            id="upload-photo-btn"
          >
            <Upload size={15} className="mr-1.5" />
            Subir imagen
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={photos.length + processingFiles.length >= 10}
            id="camera-photo-btn"
          >
            <Camera size={15} className="mr-1.5" />
            Cámara
          </Button>
          <span className="text-xs text-slate-400 self-center">{photos.length}/10 fotos</span>
        </div>
      )}

      {photos.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-12 text-center">
          <Camera className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Sin fotografías clínicas</p>
          <p className="text-xs text-slate-400 mt-1">Formatos: JPG, PNG, HEIC · Máx. 5MB por imagen</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="relative cursor-pointer" onClick={() => setLightboxIndex(index)}>
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt={photo.label || "Foto clínica"}
                  className="w-full h-36 object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="rounded-full w-10 h-10 p-0"
                    onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(photo); }}
                    title="Descargar imagen"
                  >
                    <Download size={18} />
                  </Button>
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X size={12} />
                </button>
              )}
              <div className="p-2 relative z-10 bg-white dark:bg-slate-900">
                {editingLabel === photo.id ? (
                  <input
                    autoFocus
                    className="w-full text-xs border border-emerald-400 rounded px-1.5 py-0.5 outline-none"
                    defaultValue={photo.label}
                    onBlur={(e) => handleLabelChange(photo.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLabelChange(photo.id, (e.target as HTMLInputElement).value)}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 transition-colors w-full text-left"
                    onClick={() => !disabled && setEditingLabel(photo.id)}
                  >
                    <Tag size={11} />
                    {photo.label || <span className="italic">Añadir etiqueta</span>}
                  </button>
                )}
              </div>
            </div>
          ))}
          {processingFiles.map((proc) => (
            <div key={proc.id} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 animate-pulse flex flex-col items-center justify-center h-36">
              <Upload className="w-8 h-8 text-slate-400 mb-2 animate-bounce" />
              <p className="text-xs text-slate-500 font-medium px-2 text-center truncate w-full">Optimizando y subiendo...</p>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && photos.length > 0 && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownload={handleDownloadPhoto}
        />
      )}
    </div>
  );
}
