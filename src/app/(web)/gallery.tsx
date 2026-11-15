"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const list = photos.length ? photos : ["/demo/placeholder.svg"];

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setI((prev) => (prev + 1) % list.length);
      } else if (e.key === "ArrowLeft") {
        setI((prev) => (prev - 1 + list.length) % list.length);
      } else if (e.key === "Escape" && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [list.length, isLightboxOpen]);

  const prevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setI((prev) => (prev - 1 + list.length) % list.length);
  };

  const nextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setI((prev) => (prev + 1) % list.length);
  };

  // Gestos táctiles de deslizamiento (Swipe) para pantallas móviles
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - (touchStartY.current ?? 0);

    // Solo activar si el gesto horizontal es dominante y supera 40px
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        nextPhoto();
      } else {
        prevPhoto();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="space-y-3">
      {/* Contenedor Principal de la Imagen con Soporte Táctil Swipe */}
      <div
        className="relative group overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-sm aspect-[16/10] sm:aspect-[16/10] select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={list[i]}
          alt={`${alt} · foto ${i + 1}`}
          className="size-full object-cover transition-transform duration-500 ease-out cursor-pointer"
          onClick={() => setIsLightboxOpen(true)}
          draggable={false}
        />

        {/* Indicador de Foto Actual */}
        <div className="absolute top-3.5 left-3.5 rounded-lg bg-black/75 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm pointer-events-none">
          {i + 1} / {list.length} fotos
        </div>

        {/* Botón Pantalla Completa / Expandir (Área táctil ≥44px) */}
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          aria-label="Ver en pantalla completa"
          className="absolute top-3.5 right-3.5 grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-black/60 hover:bg-black/85 text-white backdrop-blur-md transition-all duration-200 cursor-pointer opacity-90 hover:opacity-100"
        >
          <Maximize2 className="size-4" />
        </button>

        {/* Flechas de navegación Anterior / Siguiente sobre la imagen (Áreas táctiles ≥44px) */}
        {list.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md shadow-md transition-all duration-200 cursor-pointer opacity-80 group-hover:opacity-100 hover:scale-105"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              aria-label="Siguiente foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md shadow-md transition-all duration-200 cursor-pointer opacity-80 group-hover:opacity-100 hover:scale-105"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* Tira de Miniaturas */}
      {list.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {list.map((u, k) => (
            <button
              key={u}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Ver foto ${k + 1}`}
              className={`relative shrink-0 overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer min-h-[48px] min-w-[48px] ${
                k === i
                  ? "border-accent ring-2 ring-accent scale-[1.02] shadow-sm"
                  : "border-line opacity-70 hover:opacity-100 hover:border-muted"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt=""
                className="h-16 w-24 sm:h-20 sm:w-28 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Modal Lightbox de Pantalla Completa */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Cerrar vista completa"
            className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
          >
            <X className="size-5" />
          </button>

          <div
            className="relative max-h-[85vh] max-w-5xl overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={list[i]}
              alt={`${alt} · foto ${i + 1}`}
              className="max-h-[85vh] w-auto max-w-full object-contain mx-auto rounded-xl"
            />

            {list.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPhoto}
                  aria-label="Foto anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full bg-black/75 hover:bg-black text-white shadow-xl transition-all cursor-pointer"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={nextPhoto}
                  aria-label="Siguiente foto"
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full bg-black/75 hover:bg-black text-white shadow-xl transition-all cursor-pointer"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-xs font-semibold text-white">
              {i + 1} de {list.length} fotos · {alt}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
