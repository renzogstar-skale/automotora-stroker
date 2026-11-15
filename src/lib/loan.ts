/**
 * Crédito de cuota fija (sistema francés). Tasa mensual = tasa anual nominal ÷ 12 (convención usada por las financieras
 * automotrices al informar tasa anual). Con tasa 0, cuota = monto ÷ plazo. No incluye seguros, impuestos ni gastos operacionales.
 */
export type LoanInput = { price: number; down: number; tradeIn: number; months: number; annualRate: number };
export function validateLoan(i: LoanInput) {
  const e: string[] = [];
  if (!(i.price > 0)) e.push("El precio debe ser mayor a 0.");
  if (i.down < 0 || i.tradeIn < 0) e.push("Pie y parte de pago no pueden ser negativos.");
  if (i.down + i.tradeIn >= i.price) e.push("El pie más la parte de pago cubren el precio: no hay monto a financiar.");
  if (!Number.isInteger(i.months) || i.months < 6 || i.months > 72) e.push("El plazo debe estar entre 6 y 72 meses.");
  if (i.annualRate < 0 || i.annualRate > 60) e.push("La tasa anual debe estar entre 0% y 60%.");
  return e;
}
export function computeLoan(i: LoanInput) {
  const principal = i.price - i.down - i.tradeIn;
  const r = i.annualRate / 100 / 12;
  const cuota = r === 0 ? principal / i.months : (principal * r) / (1 - Math.pow(1 + r, -i.months));
  // Con tasa 0 el total es exactamente el monto financiado (el redondeo de la cuota no debe generar intereses negativos).
  const totalCredit = r === 0 ? principal : Math.round(cuota) * i.months;
  return { principal, monthlyRate: r, cuota: Math.round(cuota), totalCredit, interest: totalCredit - principal, buyerTotal: totalCredit + i.down + i.tradeIn };
}
