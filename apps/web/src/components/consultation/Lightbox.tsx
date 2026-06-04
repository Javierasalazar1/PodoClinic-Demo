import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import type { PhotoItem } from "./PhotoUpload";

interface LightboxProps {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
  onDownload: (photo: PhotoItem) => void;
}

export default function Lightbox({ photos, initialIndex, onClose, onDownload }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const currentPhoto = photos[currentIndex];

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    setScale(1);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    setScale(1);
  }, [photos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious, onClose]);

  // Bloquear scroll de la página principal
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    // Si el desplazamiento es mayor a 50px, navegamos
    if (diff > 50) handleNext();
    if (diff < -50) handlePrevious();
    
    setTouchStart(null);
  };

  if (!currentPhoto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-50"
      >
        <X size={24} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-50"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-50"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      <div 
        className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentPhoto.url}
          alt={currentPhoto.label || "Fotografía clínica"}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
        />
        
        {/* Controles de zoom móvil/desktop */}
        <div className="absolute top-4 left-4 flex gap-2 z-50">
          <button onClick={() => setScale(s => Math.min(s + 0.5, 3))} className="p-2 bg-black/40 text-white rounded-full hover:bg-black/60 backdrop-blur-md">
            <ZoomIn size={18} />
          </button>
          <button onClick={() => setScale(s => Math.max(s - 0.5, 1))} className="p-2 bg-black/40 text-white rounded-full hover:bg-black/60 backdrop-blur-md">
            <ZoomOut size={18} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center">
        <p className="text-white text-lg font-medium mb-4">
          {currentPhoto.label || "Sin etiqueta"}
        </p>
        <button
          onClick={() => onDownload(currentPhoto)}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-medium transition-colors shadow-lg"
        >
          <Download size={18} />
          Descargar imagen
        </button>
        {photos.length > 1 && (
          <p className="text-white/50 text-sm mt-4">
            {currentIndex + 1} de {photos.length}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
