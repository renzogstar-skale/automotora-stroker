import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, Check, Circle, Clock, Inbox, Minus, X, Info } from "lucide-react";
import type { Tone } from "@/lib/labels";
import { clp } from "@/lib/format";

export const cx = clsx;

const TONES: Record<Tone, string> = {
  gray: "bg-stone-100 text-stone-800 border-stone-200/80 dark:bg-stone-800/80 dark:text-stone-200 dark:border-stone-700",
  blue: "bg-sky-50 text-sky-800 border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/50",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50",
  amber: "bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50",
  red: "bg-red-50 text-red-800 border-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/50",
  violet: "bg-violet-50 text-violet-800 border-violet-200/80 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/50",
  teal: "bg-teal-50 text-teal-800 border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/50",
};

const ICONS: Record<Tone, typeof Check> = {
  gray: Minus,
  blue: Circle,
  green: Check,
  amber: Clock,
  red: X,
  violet: Info,
  teal: Circle,
};

/** Estado identificable por texto e icono (no solo color) con esquinas redondeadas suaves y alto contraste. */
export function Badge({
  tone = "gray",
  children,
  icon = true,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  icon?: boolean;
  className?: string;
}) {
  const I = ICONS[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors duration-200",
        TONES[tone],
        className
      )}
    >
      {icon && <I className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export const StatusBadge = ({
  map,
  value,
}: {
  map: Record<string, [string, Tone]>;
  value: string;
}) => <Badge tone={map[value]?.[1] ?? "gray"}>{map[value]?.[0] ?? value}</Badge>;

export function Card({
  title,
  action,
  children,
  className,
  bodyClass,
  sub,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cx("card min-w-0 overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight text-ink">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx("p-5 sm:p-6", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  sub,
  href,
  icon: I,
  exact,
  tone,
  scope,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  exact?: number;
  tone?: "accent";
  /** «now» = estado actual (no depende del período); «period» = responde al período seleccionado. */
  scope?: "now" | "period";
}) {
  const body = (
    <div
      className={cx(
        "card card-hover flex h-full items-start gap-4 p-4 sm:p-5",
        href && "hover:border-accent/40"
      )}
    >
      {I && (
        <span
          className={cx(
            "grid size-11 shrink-0 place-items-center rounded-xl transition-all duration-200",
            tone === "accent"
              ? "bg-accent text-white shadow-sm"
              : "bg-accent-soft text-accent dark:bg-accent/15"
          )}
        >
          <I className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <span className="truncate">{label}</span>
          {scope && (
            <span
              className={cx("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium normal-case tracking-normal", scope === "now" ? "bg-surface-2 text-muted" : "bg-accent-soft text-accent dark:bg-accent/15")}
              title={scope === "now" ? "Estado actual: no depende del período" : "Responde al período seleccionado"}
            >
              {scope === "now" ? "Hoy" : "Período"}
            </span>
          )}
        </p>
        <p
          className="mt-1 truncate text-2xl font-extrabold tracking-tight text-ink tabular-nums"
          title={exact != null ? clp(exact) : undefined}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted leading-relaxed">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-transform duration-200">
      {body}
    </Link>
  ) : (
    body
  );
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {desc && <div className="mt-1 text-sm text-muted leading-relaxed">{desc}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Empty({
  title = "Sin registros",
  text,
  action,
  compact,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 text-center",
        compact ? "py-6" : "py-12"
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Inbox className="size-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {text && <p className="max-w-sm text-xs text-muted leading-relaxed">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "amber",
  children,
}: {
  tone?: "amber" | "red" | "blue" | "green";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed transition-all duration-200",
        TONES[tone]
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function Tabs({
  items,
}: {
  items: { href: string; label: string; active?: boolean; count?: number }[];
}) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-line pb-2" aria-label="Pestañas">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cx(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap",
            t.active
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:bg-surface-2 hover:text-ink"
          )}
        >
          {t.label}
          {t.count != null && (
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-xs tabular-nums font-bold",
                t.active ? "bg-white/20 text-white" : "bg-surface-2 text-muted"
              )}
            >
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Monto exacto en CLP visible al pasar el cursor o tocar (title). */
export const Money = ({
  v,
  className,
}: {
  v: number | null | undefined;
  className?: string;
}) => (
  <span className={cx("tabular-nums font-semibold", className)} title={v == null ? undefined : clp(v)}>
    {clp(v)}
  </span>
);

export function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (p: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3.5 text-xs">
      <span className="text-muted font-medium">
        Página <b className="text-ink">{page}</b> de <b className="text-ink">{pages}</b>
      </span>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link className="btn btn-sm" href={href(page - 1)}>
            Anterior
          </Link>
        )}
        {page < pages && (
          <Link className="btn btn-sm" href={href(page + 1)}>
            Siguiente
          </Link>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cx("block min-w-0 space-y-1.5", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted leading-tight">{hint}</span>}
    </label>
  );
}

export const Table = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cx("overflow-x-auto rounded-xl border border-line", className)}>
    <table className="tbl">{children}</table>
  </div>
);
