"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface VehicleCardGalleryProps {
  photos: { url: string }[];
  alt: string;
  isVendido?: boolean;
}

export function VehicleCardGallery({
  photos,
  alt,
  isVendido = false,
}: VehicleCardGalleryProps) {
  // Deduplicar URLs reales para no mostrar fotos duplicadas
  const uniquePhotos = useMemo(() => {
    const urls = (photos || []).map((p) => p.url).filter(Boolean);
    const seen = new Set<string>();
    const result: string[] = [];
    for (const u of urls) {
      if (!seen.has(u)) {
        seen.add(u);
        result.push(u);
      }
    }
    return result.length > 0 ? result : ["/brand/stroker-portada.jpg"];
  }, [photos]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    skipSnaps: false,
    duration: 20,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (emblaApi) emblaApi.scrollPrev();
    },
    [emblaApi]
  );

  const scrollNext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (emblaApi) emblaApi.scrollNext();
    },
    [emblaApi]
  );

  const scrollTo = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  // Si solo hay una foto, renderizado directo optimizado
  if (uniquePhotos.length <= 1) {
    return (
      <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={uniquePhotos[0]}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
            isVendido ? "grayscale-[30%]" : ""
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden select-none group/gallery">
      {/* Carrusel Embla deslizable */}
      <div className="overflow-hidden size-full" ref={emblaRef}>
        <div className="flex size-full touch-pan-y">
          {uniquePhotos.map((photoUrl, idx) => (
            <div
              key={`${photoUrl}-${idx}`}
              className="relative min-w-full size-full flex-[0_0_100%]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={`${alt} - Foto ${idx + 1}`}
                loading={idx === 0 ? "eager" : "lazy"}
                decoding="async"
                className={`size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
                  isVendido ? "grayscale-[30%]" : ""
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Degradado para contraste de texto y distintivos */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none z-10" />

      {/* Flechas de navegación para escritorio y tablet */}
      <button
        type="button"
        onClick={scrollPrev}
        aria-label="Foto anterior"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 grid size-9 min-h-[36px] min-w-[36px] place-items-center rounded-full bg-black/60 hover:bg-red-600 text-white backdrop-blur-md border border-white/10 hover:border-red-500/50 transition-all duration-200 opacity-0 group-hover/gallery:opacity-100 focus:opacity-100 cursor-pointer shadow-md"
      >
        <ChevronLeft className="size-4" />
      </button>

      <button
        type="button"
        onClick={scrollNext}
        aria-label="Foto siguiente"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 grid size-9 min-h-[36px] min-w-[36px] place-items-center rounded-full bg-black/60 hover:bg-red-600 text-white backdrop-blur-md border border-white/10 hover:border-red-500/50 transition-all duration-200 opacity-0 group-hover/gallery:opacity-100 focus:opacity-100 cursor-pointer shadow-md"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Indicadores de fotos en la parte inferior centrada */}
      <div className="absolute bottom-2 inset-x-0 z-20 flex items-center justify-center gap-1 pointer-events-auto">
        <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-md border border-white/10">
          {uniquePhotos.slice(0, 6).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => scrollTo(idx, e)}
              aria-label={`Ir a foto ${idx + 1}`}
              className={`h-1 rounded-full transition-all duration-200 cursor-pointer ${
                idx === selectedIndex
                  ? "w-4 bg-red-500"
                  : "w-1 bg-white/40 hover:bg-white/80"
              }`}
            />
          ))}
          {uniquePhotos.length > 6 && (
            <span className="text-[9px] font-mono text-zinc-300 ml-0.5">
              +{uniquePhotos.length - 6}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
