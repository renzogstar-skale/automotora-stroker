"use client";

import { useState, useMemo } from "react";
import { Landmark, Calculator, Info, Check, ArrowRight } from "lucide-react";
import { clp } from "@/lib/format";
import { computeLoan } from "@/lib/loan";

interface FinanceCalculatorProps {
  price: number;
  vehicleName: string;
}

export function FinanceCalculator({ price, vehicleName }: FinanceCalculatorProps) {
  // Por defecto 30% de pie
  const [downPercent, setDownPercent] = useState<number>(30);
  const [months, setMonths] = useState<number>(36);
  const annualRate = 17.4; // ~1.45% mensual promedio del mercado automotriz chileno

  const downAmount = useMemo(() => {
    return Math.round((price * downPercent) / 100);
  }, [price, downPercent]);

  const loanCalculation = useMemo(() => {
    return computeLoan({
      price,
      down: downAmount,
      tradeIn: 0,
      months,
      annualRate,
    });
  }, [price, downAmount, months, annualRate]);

  const downOptions = [20, 30, 40, 50];
  const monthOptions = [12, 24, 36, 48, 60];

  const handleApplyToForm = () => {
    const el = document.getElementById("consulta-form");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      // Prellenar campo mensaje o forma de pago si el elemento existe
      const selectPay = document.querySelector('select[name="payMethod"]') as HTMLSelectElement | null;
      if (selectPay) {
        selectPay.value = "FINANCIAMIENTO";
      }
      const messageInput = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement | null;
      if (messageInput && !messageInput.value) {
        messageInput.value = `Hola, me interesa simular financiamiento para el ${vehicleName} con un pie de ${clp(downAmount)} (${downPercent}%) en ${months} cuotas de ${clp(loanCalculation.cuota)} aproximadamente.`;
      }
    }
  };

  return (
    <div id="calculadora-financiamiento" className="rounded-2xl border border-line bg-surface p-6 sm:p-7 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-6 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent font-bold">
            <Calculator className="size-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
              Simulador de Crédito Automotriz
            </h2>
            <p className="text-xs text-muted">
              Calcula tu cuota mensual estimada en cuotas fijas en pesos chilenos.
            </p>
          </div>
        </div>

        <span className="rounded-lg bg-surface-2 border border-line px-2.5 py-1 text-xs font-semibold text-muted">
          Tasa ref. 1.45% mensual
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
        {/* Controles de Selección */}
        <div className="lg:col-span-7 space-y-5">
          {/* Pie Inicial */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Pie Inicial ({downPercent}%)
              </label>
              <span className="text-sm font-extrabold text-ink tabular-nums">
                {clp(downAmount)}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {downOptions.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDownPercent(pct)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    downPercent === pct
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-line bg-surface hover:bg-surface-2 text-ink"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Plazo en Meses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Plazo del Crédito
              </label>
              <span className="text-sm font-extrabold text-ink">
                {months} meses
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {monthOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    months === m
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-line bg-surface hover:bg-surface-2 text-ink"
                  }`}
                >
                  {m} m
                </button>
              ))}
            </div>
          </div>

          {/* Desglose de montos */}
          <div className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Precio del vehículo:</span>
              <span className="font-bold text-ink tabular-nums">{clp(price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Pie ({downPercent}%):</span>
              <span className="font-bold text-ink tabular-nums">{clp(downAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <span className="text-muted">Monto total a financiar:</span>
              <span className="font-bold text-accent tabular-nums">{clp(loanCalculation.principal)}</span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Resultado de Cuota Estimada */}
        <div className="lg:col-span-5 rounded-2xl border border-accent/20 bg-gradient-to-b from-accent-soft to-transparent p-5 text-center flex flex-col justify-between h-full">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent block">
              Cuota Mensual Estimada
            </span>
            <div className="mt-2 text-3xl sm:text-4xl font-black text-ink tabular-nums">
              {clp(loanCalculation.cuota)}
              <span className="text-sm font-semibold text-muted ml-1">/ mes</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {months} cuotas fijas en pesos chilenos
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-line/60">
            <button
              type="button"
              onClick={handleApplyToForm}
              className="w-full btn btn-primary h-11 text-xs sm:text-sm font-bold shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Solicitar con este financiamiento</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Nota legal y disclaimer sin prometer aprobación */}
      <div className="mt-6 rounded-xl border border-line bg-surface-2/40 p-3.5 flex items-start gap-2.5 text-xs text-muted">
        <Info className="size-4 shrink-0 text-accent mt-0.5" />
        <p className="leading-relaxed">
          <strong>Aviso legal importante:</strong> Simulación estrictamente referencial. Los valores informados no constituyen oferta vinculante ni garantizan aprobación comercial. El otorgamiento del crédito, tasa de interés final, CAE y condiciones definitivas están sujetas a evaluación de antecedentes crediticios y políticas de riesgo de las entidades financieras en convenio.
        </p>
      </div>
    </div>
  );
}
