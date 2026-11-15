import { describe, expect, it } from "vitest";
import { addDays, fmtPlate, normPhone, normalizePlate, parseYmd, startOfMonth, validRut, ymd } from "./format";
import { computeLoan, validateLoan } from "./loan";
import { hmacHex, safeEqual, sha256 } from "./crypto";

describe("validRut", () => {
  it("acepta RUT válidos con y sin formato", () => {
    expect(validRut("11.111.111-1")).toBe(true);
    expect(validRut("12345678-5")).toBe(true);
    expect(validRut("10.000.013-K")).toBe(true);
  });
  it("rechaza dígito verificador incorrecto o vacío", () => {
    expect(validRut("12345678-9")).toBe(false);
    expect(validRut("")).toBe(false);
  });
});

describe("patentes y teléfonos", () => {
  it("normaliza patentes de auto y moto", () => {
    expect(normalizePlate("bb-cd 12")).toEqual({ plate: "BBCD12", kind: "AUTO" });
    expect(normalizePlate("AB1234")?.kind).toBe("AUTO");
    expect(normalizePlate("ABC12")?.kind).toBe("MOTO");
    expect(normalizePlate("1234")).toBeNull();
    expect(fmtPlate("BBCD12")).toBe("BB·CD·12");
  });
  it("normaliza teléfonos chilenos a +56", () => {
    expect(normPhone("9 1234 5678")).toBe("+56912345678");
    expect(normPhone("+56 9 1234 5678")).toBe("+56912345678");
    expect(normPhone("")).toBeNull();
  });
});

describe("fechas en America/Santiago", () => {
  it("ida y vuelta de YYYY-MM-DD", () => expect(ymd(parseYmd("2026-03-15"))).toBe("2026-03-15"));
  it("cambio de mes y de año", () => {
    expect(ymd(addDays(parseYmd("2026-01-31"), 1))).toBe("2026-02-01");
    expect(ymd(startOfMonth(parseYmd("2026-12-20"), 1))).toBe("2027-01-01");
  });
});

describe("crédito automotriz", () => {
  it("cuota francesa y tasa cero", () => {
    const l = computeLoan({ price: 10_000_000, down: 2_000_000, tradeIn: 0, months: 36, annualRate: 0 });
    expect(l.principal).toBe(8_000_000);
    expect(l.interest).toBe(0);
    const r = computeLoan({ price: 10_000_000, down: 2_000_000, tradeIn: 0, months: 36, annualRate: 18 });
    expect(r.cuota).toBeGreaterThan(8_000_000 / 36);
    expect(r.totalCredit).toBe(r.cuota * 36);
  });
  it("valida montos y plazos", () => {
    expect(validateLoan({ price: 5, down: 5, tradeIn: 0, months: 12, annualRate: 10 })).toHaveLength(1);
    expect(validateLoan({ price: 100, down: 0, tradeIn: 0, months: 3, annualRate: 10 })).toHaveLength(1);
  });
});

describe("crypto", () => {
  it("hash y firma HMAC deterministas; comparación segura", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hmacHex("k", "x")).toBe(hmacHex("k", "x"));
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});
