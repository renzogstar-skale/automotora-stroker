// Etiquetas y tonos de estado: cada estado se identifica por texto + icono, no solo por color.
export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "teal";

export const STAGES = [
  ["NUEVO", "Nuevo", "blue"], ["NO_CONTESTA", "No contesta", "gray"], ["SEGUIMIENTO", "En seguimiento", "teal"],
  ["BUSCANDO", "Buscando vehículo", "violet"], ["EN_ESPERA", "En espera", "gray"], ["NEGOCIANDO", "Negociando", "amber"],
  ["AGENDADO", "Agendado", "blue"], ["PARA_CIERRE", "Para cierre", "amber"], ["CONCRETADO", "Negocio concretado", "green"],
  ["CANCELADO", "Cancelado", "red"],
] as const;
export type StageKey = (typeof STAGES)[number][0];
export const STAGE_LABEL = Object.fromEntries(STAGES.map(([k, l]) => [k, l])) as Record<string, string>;
export const STAGE_TONE = Object.fromEntries(STAGES.map(([k, , t]) => [k, t])) as Record<string, Tone>;
export const STAGE_ORDER = Object.fromEntries(STAGES.map(([k], i) => [k, i])) as Record<string, number>;
export const ACTIVE_STAGES = STAGES.map((s) => s[0]).filter((s) => s !== "CONCRETADO" && s !== "CANCELADO");
/** Etapas que cuentan como «avance a negociación». */
export const NEGOTIATION_STAGES = ["NEGOCIANDO", "AGENDADO", "PARA_CIERRE", "CONCRETADO"];

export const SOURCE_LABEL: Record<string, string> = {
  WEB: "Vitrina web", WHATSAPP: "WhatsApp", TELEFONO: "Teléfono", REDES: "Redes sociales",
  REFERIDO: "Referido", PRESENCIAL: "Visita presencial", N8N: "Automatización (n8n)",
};
export const OPP_TYPE_LABEL: Record<string, string> = { VENTA: "Venta", CONSIGNACION: "Consignación", PISO: "Cliente de piso" };
export const PAY_LABEL: Record<string, string> = { CONTADO: "Contado", FINANCIAMIENTO: "Financiamiento", PARTE_PAGO: "Auto en parte de pago" };
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Dueño / Administrador", GERENCIA: "Gerencia / Jefe de ventas", VENDEDOR: "Vendedor", FINANZAS: "Finanzas", FOTOGRAFO: "Fotógrafo",
};
export const VEHICLE_STATUS: Record<string, [string, Tone]> = {
  DISPONIBLE: ["Disponible", "green"],
  RESERVADO: ["Reservado", "amber"],
  VENDIDO: ["Vendido", "red"],
  EN_CONSIGNACION: ["En consignación", "violet"],
  POR_CONFIRMAR: ["Por confirmar", "gray"],
  RETIRADO: ["Retirado", "gray"],
};
export const APPT_TYPE: Record<string, string> = { TEST_DRIVE: "Test drive", REUNION: "Reunión", ENTREGA: "Entrega", SERVICIO: "Servicio" };
export const APPT_STATUS: Record<string, [string, Tone]> = {
  PROGRAMADA: ["Programada", "blue"], CONFIRMADA: ["Confirmada", "teal"], COMPLETADA: ["Completada", "green"], CANCELADA: ["Cancelada", "red"],
};
export const RES_STATUS: Record<string, [string, Tone]> = {
  ACTIVA: ["Activa", "amber"], CONVERTIDA: ["Convertida en venta", "green"], EXPIRADA: ["Expirada", "gray"], ANULADA: ["Anulada", "red"],
};
export const CONS_STATUS: Record<string, [string, Tone]> = {
  VIGENTE: ["Vigente", "green"], VENDIDA: ["Vendida", "blue"], RETIRADA: ["Retirada", "gray"], CERRADA: ["Cerrada", "violet"],
};
export const DELIVERY: Record<string, [string, Tone]> = { PENDIENTE: ["Entrega pendiente", "amber"], PROGRAMADA: ["Entrega programada", "blue"], ENTREGADA: ["Entregado", "green"] };
export const DOC_STATUS: Record<string, [string, Tone]> = { BORRADOR: ["Borrador", "gray"], EMITIDO: ["Emitido", "green"], ANULADO: ["Anulado", "red"] };
export const DOC_TYPE: Record<string, string> = { VENTA: "Nota de venta", RESERVA: "Comprobante de reserva", CONSIGNACION: "Contrato de consignación" };
export const POST_STATUS: Record<string, [string, Tone]> = { BORRADOR: ["Borrador", "gray"], PROGRAMADA: ["Programada", "blue"], PUBLICADA: ["Publicada", "green"], ERROR: ["Error", "red"] };
export const INTEGRATION_STATUS: Record<string, [string, Tone]> = {
  SIN_CONFIGURAR: ["Sin configurar", "gray"], CONECTADO: ["Conectado", "green"], ERROR: ["Error recuperable", "red"], DESCONECTADO: ["Desconectado", "amber"], DEMO: ["Modo demo", "violet"],
};
export const BODY_TYPES = ["SUV", "Sedán", "Hatchback", "Camioneta", "Station wagon", "Furgón", "Moto"];
export const FUELS = ["Bencina", "Diésel", "Híbrido", "Eléctrico"];
export const TRANSMISSIONS = ["Manual", "Automática"];
export const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Tarjeta", "Vale vista", "Crédito automotriz", "Parte de pago"];
