"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, Sparkles, Phone, MapPin, Gauge } from "lucide-react";
import { BUSINESS, DEMO_INVENTORY, waUrl } from "@/lib/business";

interface DemoNavbarProps {
  actor: { name: string; email: string } | null;
}

export function DemoNavbar({ actor }: DemoNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* Barra superior de identificación DEMO */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-b border-white/5 py-1 px-4 text-center">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between text-[11px] sm:text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold text-zinc-200">
              Encuentra tu Próximo Vehículo
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-zinc-400">
            <a
              href={BUSINESS.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <MapPin className="size-3 text-red-500" /> Av. Jaime Guzmán 4050, Antofagasta
            </a>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">Despachos a todo Chile</span>
          </div>
          <a href={BUSINESS.tel} className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors">
            <Phone className="size-3 text-red-500" /> {BUSINESS.phone}
          </a>
        </div>
      </div>

      {/* Navbar principal fijo con glassmorphism prémium */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-zinc-950/90 backdrop-blur-md border-b border-white/10 shadow-xl"
            : "bg-zinc-950/75 backdrop-blur-md border-b border-white/10"
        }`}
      >
        <div className="mx-auto flex h-16 sm:h-20 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Automotora Stroker */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg p-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/stroker-emblem.jpg"
              alt="Automotora Stroker"
              className="h-10 sm:h-12 w-auto object-contain rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-red-400 transition-colors">
                  STROKER
                </span>
              </div>
              <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-400">
                Automotora · Chile
              </span>
            </div>
          </Link>

          {/* Menú de navegación escritorio */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
            <Link
              href="/"
              className="hover:text-white transition-colors duration-200 relative py-1 hover:after:w-full after:w-0 after:h-0.5 after:bg-red-600 after:absolute after:bottom-0 after:left-0 after:transition-all"
            >
              Inicio
            </Link>
            <a
              href="#vitrina"
              className="hover:text-white transition-colors duration-200 relative py-1 hover:after:w-full after:w-0 after:h-0.5 after:bg-red-600 after:absolute after:bottom-0 after:left-0 after:transition-all"
            >
              Catálogo
            </a>
            <a
              href="#nosotros"
              className="hover:text-white transition-colors duration-200 relative py-1 hover:after:w-full after:w-0 after:h-0.5 after:bg-red-600 after:absolute after:bottom-0 after:left-0 after:transition-all"
            >
              Sobre nosotros
            </a>
            <a
              href="#servicios"
              className="hover:text-white transition-colors duration-200 relative py-1 hover:after:w-full after:w-0 after:h-0.5 after:bg-red-600 after:absolute after:bottom-0 after:left-0 after:transition-all"
            >
              Servicios
            </a>
            <a
              href="#contacto"
              className="hover:text-white transition-colors duration-200 relative py-1 hover:after:w-full after:w-0 after:h-0.5 after:bg-red-600 after:absolute after:bottom-0 after:left-0 after:transition-all"
            >
              Contacto
            </a>
          </nav>

          {/* Acciones y Acceso al Panel */}
          <div className="hidden sm:flex items-center gap-3">
            {actor ? (
              <Link
                href="/panel"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold text-xs sm:text-sm px-4 h-10 shadow-lg shadow-red-950/50 hover:shadow-red-800/40 transition-all duration-200 active:scale-[0.98]"
              >
                <Gauge className="size-4" />
                <span>Panel ({actor.name.split(" ")[0]})</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold text-xs sm:text-sm px-4.5 h-10 shadow-lg shadow-red-950/50 hover:shadow-red-800/40 transition-all duration-200 active:scale-[0.98]"
              >
                <span>Acceso al Panel</span>
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>

          {/* Botón hamburguesa móvil con área táctil óptima (≥44px) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Desplegable móvil optimizado para touch y safe-areas */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl px-4 py-5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-2 text-base font-semibold text-zinc-200">
              <Link
                href="/"
                onClick={closeMenu}
                className="px-3.5 min-h-[44px] flex items-center rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Inicio
              </Link>
              <a
                href="#vitrina"
                onClick={closeMenu}
                className="px-3.5 min-h-[44px] flex items-center rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Catálogo
              </a>
              <a
                href="#nosotros"
                onClick={closeMenu}
                className="px-3.5 min-h-[44px] flex items-center rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Sobre nosotros
              </a>
              <a
                href="#servicios"
                onClick={closeMenu}
                className="px-3.5 min-h-[44px] flex items-center rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Servicios
              </a>
              <a
                href="#contacto"
                onClick={closeMenu}
                className="px-3.5 min-h-[44px] flex items-center rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Contacto
              </a>
              <div className="my-2 border-t border-white/10 pt-2 grid grid-cols-2 gap-2 text-xs">
                <a
                  href={BUSINESS.tel}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <Phone className="size-3.5 text-red-400" />
                  <span>Llamar</span>
                </a>
                <a
                  href={waUrl("Hola, quiero más información.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 py-2.5 font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                >
                  <span>WhatsApp</span>
                </a>
              </div>
              <div className="pt-3 mt-1 border-t border-white/10">
                {actor ? (
                  <Link
                    href="/panel"
                    onClick={closeMenu}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm min-h-[44px] h-11 w-full shadow-md transition-colors"
                  >
                    <Gauge className="size-4" />
                    Ir al Panel ({actor.name.split(" ")[0]})
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold text-sm min-h-[44px] h-11 w-full shadow-md transition-colors"
                  >
                    Acceso al Panel Stroker <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
