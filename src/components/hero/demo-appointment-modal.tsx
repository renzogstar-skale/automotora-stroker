"use client";

import { useEffect, useState } from "react";
import { X, Calendar, Clock, MapPin, Car, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { clp } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import { publicFormAction } from "@/app/(web)/actions";
import type { DemoVehicle, DemoBranch } from "@/types/hero-demo";

interface DemoAppointmentModalProps {
  onClose: () => void;
  vehicles: DemoVehicle[];
  branches: DemoBranch[];
  initialVehicleId?: string;
  initialBranchId?: string;
}

type Confirmation = { vehicleName: string; branchName: string; date: string; time: string; customerName: string };

const tomorrow = () => {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Solicitud de test drive desde la portada. Usa el mismo flujo que la ficha pública: crea el lead en el CRM
 * (origen Web) y agenda la cita si el horario está libre. El token evita duplicados por doble clic o reintento.
 * Se monta al abrirse (el padre lo renderiza condicionalmente), así el estado inicial sale de las props.
 */
export function DemoAppointmentModal({ onClose, vehicles, initialVehicleId }: DemoAppointmentModalProps) {
  // Una sola sede pública (Antofagasta): se listan todas las unidades; la sucursal interna la resuelve el servidor.
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => initialVehicleId ?? vehicles[0]?.id ?? "");
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("11:30");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+56 9 ");
  const [website, setWebsite] = useState("");
  const [token] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const branchVehicles = vehicles;
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) { setError("Elige un vehículo."); return; }
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    const fd = new FormData();
    fd.set("kind", "TEST_DRIVE");
    fd.set("token", token);
    fd.set("vehicleId", selectedVehicle.id);
    fd.set("date", `${date}T${time}`);
    fd.set("name", customerName.trim());
    fd.set("phone", customerPhone.trim());
    fd.set("message", "Solicitado desde la portada");
    if (website) fd.set("website", website);
    try {
      const r = await publicFormAction(null, fd);
      if (r?.ok) {
        setConfirmation({
          vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})`,
          branchName: BUSINESS.showroom,
          date, time, customerName: customerName.trim(),
        });
      } else {
        setFieldErrors(r?.errors ?? {});
        setError(r?.errors?.vehicleId ?? r?.error ?? "Revisa los datos ingresados.");
      }
    } catch {
      setError("No pudimos enviar tu solicitud. Intenta nuevamente o escríbenos por WhatsApp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full rounded-xl border border-white/15 bg-zinc-900/90 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors";
  const labelCls = "block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5";
  const fieldError = (k: string) => fieldErrors[k] && <p className="mt-1 text-xs text-red-400">{fieldErrors[k]}</p>;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300" />

      <div className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-950 p-6 sm:p-8 text-white shadow-2xl z-10 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute -top-24 -right-24 size-48 rounded-full bg-red-600/20 blur-3xl pointer-events-none" />
        <button onClick={onClose} className="absolute top-5 right-5 grid size-9 place-items-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Cerrar">
          <X className="size-5" />
        </button>

        {!confirmation ? (
          <div>
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-red-600/20 border border-red-500/30 px-2.5 py-1 text-[11px] font-bold text-red-400 mb-2">
                <Calendar className="size-3.5" />
                <span>Test drive y visita</span>
              </div>
              <h2 id="modal-title" className="text-2xl font-bold tracking-tight text-white">Agendar visita o test drive</h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-400">Elige la unidad y el horario. Un ejecutivo confirmará tu visita por teléfono o WhatsApp.</p>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                <MapPin className="size-4 shrink-0 text-red-400" />
                <span><strong className="text-white">{BUSINESS.showroom}</strong> · {BUSINESS.address}<br />{BUSINESS.hours}</span>
              </p>

              <div>
                <label htmlFor="appt-vehicle" className={labelCls}>Vehículo de interés</label>
                <div className="relative">
                  <select id="appt-vehicle" value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} required className={`${inputCls} appearance-none`}>
                    {branchVehicles.length === 0 && <option value="">Sin unidades disponibles</option>}
                    {branchVehicles.map((v) => <option key={v.id} value={v.id} className="bg-zinc-900 text-white">{v.brand} {v.model} ({v.year}) — {clp(v.price)}</option>)}
                  </select>
                  <Car className="pointer-events-none absolute right-3.5 top-3 size-4 text-zinc-400" />
                </div>
                {fieldError("vehicleId")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="appt-date" className={labelCls}>Fecha de visita</label>
                  <input id="appt-date" type="date" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} required className={`${inputCls} [color-scheme:dark]`} />
                  {fieldError("date")}
                </div>
                <div>
                  <label htmlFor="appt-time" className={labelCls}>Bloque horario</label>
                  <div className="relative">
                    <select id="appt-time" value={time} onChange={(e) => setTime(e.target.value)} required className={`${inputCls} appearance-none`}>
                      {[["10:00", "Mañana"], ["11:30", "Mañana"], ["15:00", "Tarde"], ["16:30", "Tarde"], ["18:00", "Cierre"]].map(([t, l]) => <option key={t} value={t} className="bg-zinc-900">{t} hrs ({l})</option>)}
                    </select>
                    <Clock className="pointer-events-none absolute right-3.5 top-3 size-4 text-zinc-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="appt-name" className={labelCls}>Nombre completo</label>
                  <input id="appt-name" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ej. Rodrigo Silva" required minLength={2} maxLength={100} autoComplete="name" className={inputCls} />
                  {fieldError("name")}
                </div>
                <div>
                  <label htmlFor="appt-phone" className={labelCls}>Teléfono móvil</label>
                  <input id="appt-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+56 9 8765 4321" required minLength={8} maxLength={20} autoComplete="tel" className={inputCls} />
                  {fieldError("phone")}
                </div>
              </div>
              {/* Trampa anti-bots: invisible para personas. */}
              <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button type="submit" disabled={isSubmitting || !selectedVehicle} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/60 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer">
                  {isSubmitting ? <><Loader2 className="size-4 animate-spin" /><span>Enviando…</span></> : <><Calendar className="size-4" /><span>Solicitar visita</span></>}
                </button>
                <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-5 py-3 text-sm font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer">Cancelar</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-4 animate-in fade-in zoom-in-95 duration-200" data-testid="appt-confirmation">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"><CheckCircle2 className="size-8" /></div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 mb-2">
              <ShieldCheck className="size-3.5" /><span>Solicitud recibida</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white">¡Listo, {confirmation.customerName.split(" ")[0]}!</h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-300 max-w-md mx-auto">Recibimos tu solicitud de test drive; un ejecutivo te confirmará el horario.</p>
            <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/90 p-4 text-left text-xs sm:text-sm space-y-2.5">
              {[["Vehículo", confirmation.vehicleName], ["Lugar", confirmation.branchName], ["Fecha y hora", `${confirmation.date} · ${confirmation.time} hrs`]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0"><span className="text-zinc-400">{k}:</span><span className="font-semibold text-white text-right">{v}</span></div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <button onClick={onClose} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/50 transition-all duration-200">
                <span>Volver a la vitrina</span><ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
