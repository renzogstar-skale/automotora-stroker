"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Car,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  FileText,
  Gauge,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
  Home,
  MoreHorizontal,
} from "lucide-react";
import clsx from "clsx";
import { useStored } from "@/lib/use-stored";
import type { NavGroup } from "@/lib/nav";
import { crumbs } from "@/lib/nav";

const ICONS: Record<string, typeof Gauge> = {
  gauge: Gauge,
  users: Users,
  car: Car,
  file: FileText,
  wallet: Wallet,
  settings: Settings,
};

type AlertLite = {
  kind: string;
  reason: string;
  who: string;
  age: string;
  href: string;
  tone: string;
};

type Props = {
  nav: NavGroup[];
  user: { name: string; role: string; email: string };
  alerts: AlertLite[];
  alertCount: number;
  quick: { label: string; href: string }[];
  logout: () => Promise<void>;
  children: React.ReactNode;
};

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open, close]);
  return ref;
}

function setTheme(t: "light" | "dark") {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.cookie = `theme=${t};path=/;max-age=31536000`;
  try {
    localStorage.setItem("theme", t);
  } catch {}
}

export function Shell({
  nav,
  user,
  alerts,
  alertCount,
  quick,
  logout,
  children,
}: Props) {
  const path = usePathname();
  const router = useRouter();
  const [collapsedRaw, setCollapsedRaw] = useStored("nav-collapsed", "0");
  const collapsed = collapsedRaw === "1";
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState<"" | "bell" | "quick" | "profile">("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const close = () => setMenu("");
  const bellRef = useClickAway(menu === "bell", close);
  const quickRef = useClickAway(menu === "quick", close);
  const profRef = useClickAway(menu === "profile", close);

  // Al navegar se cierran el menú móvil y los desplegables (ajuste de estado durante el render, sin efecto).
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setMobile(false);
    setMenu("");
  }

  const toggle = () => setCollapsedRaw(collapsed ? "0" : "1");

  const active = (href: string) => {
    const [p, q] = href.split("?");
    if (q) return false;
    return p === "/panel" ? path === "/panel" : path === p || path.startsWith(p + "/");
  };

  const cr = crumbs(path);

  const side = (wide: boolean) => (
    <nav className="flex h-full flex-col select-none">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/stroker-emblem.jpg"
          alt="Automotora Stroker"
          className="size-9 rounded-xl object-contain bg-zinc-950 p-0.5 border border-white/10 shadow-sm shrink-0"
        />
        {wide && (
          <div className="min-w-0">
            <span className="block font-bold tracking-tight text-white leading-none">
              Stroker
            </span>
            <span className="text-[11px] font-medium text-white/50 tracking-wider uppercase">
              Gestión Privada
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {nav.map((g) => {
          const I = ICONS[g.icon] ?? Gauge;
          const groupActive = g.items.some((i) => active(i.href));
          const open = openGroups[g.label] ?? groupActive;

          if (!wide)
            return (
              <Link
                key={g.label}
                href={g.items[0].href}
                title={g.label}
                className={clsx(
                  "flex h-11 items-center justify-center rounded-xl transition-all duration-200",
                  groupActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <I className="size-5" />
              </Link>
            );

          return (
            <div key={g.label} className="space-y-1">
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.label]: !open }))}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
                  groupActive
                    ? "text-white bg-white/5"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
                aria-expanded={open}
              >
                <I className="size-4 shrink-0 text-white/60" />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown
                  className={clsx(
                    "size-4 text-white/50 transition-transform duration-200",
                    open && "rotate-180"
                  )}
                />
              </button>

              {open && (
                <div className="ml-5 space-y-1 border-l border-white/10 pl-3 pt-0.5">
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={clsx(
                        "block rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-200",
                        active(i.href)
                          ? "bg-accent text-white shadow-sm font-semibold"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={toggle}
        className="hidden h-12 items-center justify-center gap-2 border-t border-white/10 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors duration-200 lg:flex"
      >
        <ChevronsLeft
          className={clsx("size-4 transition-transform duration-200", collapsed && "rotate-180")}
        />
        {wide && "Plegar menú"}
      </button>
    </nav>
  );

  const toneDot: Record<string, string> = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    blue: "bg-sky-500",
  };

  // Solo accesos que el rol puede abrir (`nav` ya viene filtrado por permisos desde el layout).
  const allowed = new Set(nav.flatMap((g) => g.items.map((i) => i.href)));
  const mobileNav = [
    { href: "/panel/hoy", label: "Hoy", I: Home },
    { href: "/panel/crm", label: "CRM", I: Users },
    { href: "/panel/inventario", label: "Vehículos", I: Car },
    { href: "/panel/citas", label: "Citas", I: CalendarDays },
  ].filter((x) => x.href === "/panel/hoy" || allowed.has(x.href));

  return (
    <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden bg-bg">
      {/* Sidebar de escritorio plegable */}
      <aside
        className={clsx(
          "sticky top-0 hidden h-dvh shrink-0 bg-graphite transition-[width] duration-250 ease-in-out lg:block z-30 shadow-md",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {side(!collapsed)}
      </aside>

      {/* Drawer móvil adaptado */}
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobile(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-graphite shadow-2xl transition-transform duration-200">
            <button
              onClick={() => setMobile(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-200"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
            {side(true)}
          </aside>
        </div>
      )}

      {/* Área de contenido y encabezado */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 sm:px-6 backdrop-blur-md">
          <button
            className="btn btn-ghost px-2.5 lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>

          <ol className="hidden min-w-0 items-center gap-2 text-xs font-semibold text-muted md:flex">
            {cr.map((c, i) => (
              <li
                key={i}
                className={clsx(
                  "truncate flex items-center gap-2",
                  i === cr.length - 1 && "font-bold text-ink"
                )}
              >
                {i > 0 && <span className="text-muted/40">/</span>}
                {c}
              </li>
            ))}
          </ol>

          {/* Búsqueda global */}
          <form
            action="/panel/buscar"
            className="ml-auto flex max-w-sm flex-1 items-center md:ml-6"
            role="search"
          >
            <label className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
              <input
                name="q"
                placeholder="Buscar cliente, patente, folio…"
                className="input pl-9 h-10 text-xs sm:text-sm"
                aria-label="Búsqueda global"
              />
            </label>
          </form>

          {/* Avisos */}
          <div className="relative" ref={bellRef}>
            <button
              className="btn btn-ghost relative px-2.5"
              onClick={() => setMenu(menu === "bell" ? "" : "bell")}
              aria-label={`Avisos (${alertCount})`}
            >
              <Bell className="size-5" />
              {alertCount > 0 && (
                <span className="absolute 1.5 -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-sm">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </button>

            {menu === "bell" && (
              <div className="absolute right-0 top-12 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl z-50">
                <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface-2/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink">
                    Avisos del equipo ({alertCount})
                  </p>
                  <Link href="/panel#avisos" className="text-xs link font-semibold">
                    Ver todos
                  </Link>
                </div>
                <ul className="max-h-96 overflow-y-auto divide-y divide-line">
                  {alerts.length === 0 && (
                    <li className="px-4 py-8 text-center text-xs text-muted">
                      Sin avisos pendientes. ¡Todo al día!
                    </li>
                  )}
                  {alerts.map((a, i) => (
                    <li key={i}>
                      <Link
                        href={a.href}
                        className="flex gap-3 px-4 py-3 hover:bg-surface-2 transition-colors duration-200"
                      >
                        <span
                          className={clsx(
                            "mt-1.5 size-2.5 shrink-0 rounded-full",
                            toneDot[a.tone] ?? "bg-accent"
                          )}
                        />
                        <span className="min-w-0 text-xs leading-relaxed">
                          <span className="font-bold text-ink">{a.kind}</span> ·{" "}
                          <span className="text-muted">{a.age}</span>
                          <br />
                          <span className="text-muted">
                            {a.reason} — <b className="text-ink">{a.who}</b>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Acción rápida */}
          {quick.length > 0 && (
            <div className="relative" ref={quickRef}>
              <button
                className="btn btn-primary px-3 sm:px-4"
                onClick={() => setMenu(menu === "quick" ? "" : "quick")}
                aria-haspopup="menu"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Acción rápida</span>
              </button>

              {menu === "quick" && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl z-50 divide-y divide-line/40"
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                    Crear nuevo registro
                  </div>
                  <div className="pt-1">
                    {quick.map((q) => (
                      <Link
                        role="menuitem"
                        key={q.href}
                        href={q.href}
                        className="block rounded-lg px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-2 hover:text-accent transition-colors duration-200"
                      >
                        {q.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Perfil de usuario y Tema */}
          <div className="relative" ref={profRef}>
            <button
              className="grid size-10 place-items-center rounded-xl bg-graphite text-xs font-bold text-white shadow-sm hover:ring-2 hover:ring-accent/40 transition-all duration-200"
              onClick={() => setMenu(menu === "profile" ? "" : "profile")}
              aria-label="Perfil"
            >
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </button>

            {menu === "profile" && (
              <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-2xl z-50">
                <div className="border-b border-line px-3 py-2.5 mb-1 bg-surface-2/50 rounded-xl">
                  <p className="text-sm font-bold text-ink truncate">{user.name}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                  <span className="mt-1 inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent uppercase">
                    {user.role}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <button
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-2 transition-colors duration-200"
                    onClick={() => {
                      setTheme("light");
                      close();
                    }}
                  >
                    <Sun className="size-4 text-amber-500" />
                    Tema claro (#F8F9FA)
                  </button>
                  <button
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-2 transition-colors duration-200"
                    onClick={() => {
                      setTheme("dark");
                      close();
                    }}
                  >
                    <Moon className="size-4 text-sky-400" />
                    Tema oscuro (#171717)
                  </button>
                </div>

                <div className="mt-2 border-t border-line pt-1">
                  <form
                    action={async () => {
                      await logout();
                      router.push("/login");
                    }}
                  >
                    <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors duration-200">
                      <LogOut className="size-4" />
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Contenedor principal con ancho máximo uniforme de 1280px */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
          {children}
        </main>

        {/* Navegación móvil inferior (altura 64px, adaptada y fija) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
          aria-label="Navegación móvil"
        >
          {mobileNav.map(({ href, label, I }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200",
                active(href) ? "text-accent" : "text-muted hover:text-ink"
              )}
            >
              <I className="size-5" />
              <span>{label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMobile(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted hover:text-ink transition-colors duration-200"
          >
            <MoreHorizontal className="size-5" />
            <span>Menú</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
