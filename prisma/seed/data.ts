// Datos de demostración ficticios para Automotora Stroker.
export const PASSWORD = "Stroker2026!";
export const BRANCHES = [
  { code: "SCL", name: "Stroker Santiago", address: "Av. Los Conquistadores 2150", comuna: "Providencia", region: "Metropolitana", phone: "+56 2 2345 6789", whatsapp: "+56 9 1234 5678" },
  { code: "VIN", name: "Stroker Viña del Mar", address: "Av. Libertad 980", comuna: "Viña del Mar", region: "Valparaíso", phone: "+56 32 245 6789", whatsapp: "+56 9 8765 4321" },
];
export const HOURS = { lunVie: "09:30–19:00", sab: "10:00–14:00", dom: "Cerrado" };
export const USERS = [
  { email: "dueno@stroker.demo", name: "Camila Rojas", role: "ADMIN", branches: ["SCL", "VIN"] },
  { email: "gerencia@stroker.demo", name: "Andrés Fuentes", role: "GERENCIA", branches: ["SCL"] },
  { email: "gerencia.vina@stroker.demo", name: "Felipe Araya", role: "GERENCIA", branches: ["VIN"] },
  { email: "valentina@stroker.demo", name: "Valentina Soto", role: "VENDEDOR", branches: ["SCL"], seller: true },
  { email: "matias@stroker.demo", name: "Matías Pérez", role: "VENDEDOR", branches: ["SCL"], seller: true },
  { email: "josefa@stroker.demo", name: "Josefa Muñoz", role: "VENDEDOR", branches: ["VIN"], seller: true },
  { email: "finanzas@stroker.demo", name: "Rodrigo Díaz", role: "FINANZAS", branches: ["SCL", "VIN"] },
  { email: "foto@stroker.demo", name: "Ignacia Vera", role: "FOTOGRAFO", branches: ["SCL", "VIN"] },
] as const;
/** Ficha de vendedor sin cuenta: sirve para probar «vincular ficha existente al invitar». */
export const SELLER_NO_ACCOUNT = { name: "Tomás Castro", email: "tomas@stroker.demo", phone: "+56 9 5555 0101", branch: "VIN" };

// marca, modelo, versión, precio referencial 0 km, carrocería, combustible, transmisión
export const CATALOG: [string, string, string, number, string, string, string][] = [
  ["Toyota", "RAV4", "2.0 XLE 4x2", 31990000, "SUV", "Bencina", "Automática"],
  ["Toyota", "Hilux", "2.4 SR 4x4", 33990000, "Camioneta", "Diésel", "Manual"],
  ["Toyota", "Yaris", "1.5 GLI", 15490000, "Sedán", "Bencina", "Manual"],
  ["Hyundai", "Tucson", "2.0 GL", 25990000, "SUV", "Bencina", "Automática"],
  ["Hyundai", "Accent", "1.6 GL", 14490000, "Sedán", "Bencina", "Manual"],
  ["Kia", "Sportage", "2.0 EX", 26990000, "SUV", "Bencina", "Automática"],
  ["Kia", "Rio", "1.4 EX", 13990000, "Hatchback", "Bencina", "Manual"],
  ["Chevrolet", "Sail", "1.5 LT", 11990000, "Sedán", "Bencina", "Manual"],
  ["Chevrolet", "Tracker", "1.2 Turbo LT", 19990000, "SUV", "Bencina", "Automática"],
  ["Suzuki", "Swift", "1.2 GLX", 12990000, "Hatchback", "Bencina", "Manual"],
  ["Suzuki", "Vitara", "1.6 GLX", 18990000, "SUV", "Bencina", "Automática"],
  ["Nissan", "Navara", "2.3 LE 4x4", 32990000, "Camioneta", "Diésel", "Automática"],
  ["Nissan", "Kicks", "1.6 Advance", 17990000, "SUV", "Bencina", "Automática"],
  ["Mazda", "CX-5", "2.5 R AWD", 29990000, "SUV", "Bencina", "Automática"],
  ["Mazda", "3", "2.0 V Sport", 20990000, "Hatchback", "Bencina", "Automática"],
  ["Peugeot", "2008", "1.2 Allure", 21990000, "SUV", "Bencina", "Automática"],
  ["Peugeot", "208", "1.2 Active", 15990000, "Hatchback", "Bencina", "Manual"],
  ["Volkswagen", "Tiguan", "1.4 TSI Trendline", 28990000, "SUV", "Bencina", "Automática"],
  ["Subaru", "Forester", "2.0 XS AWD", 28490000, "SUV", "Bencina", "Automática"],
  ["Ford", "Ranger", "3.2 XLT 4x4", 34990000, "Camioneta", "Diésel", "Automática"],
  ["MG", "ZS", "1.5 Comfort", 15990000, "SUV", "Bencina", "Manual"],
  ["Chery", "Tiggo 7", "1.5 Turbo GLX", 19990000, "SUV", "Bencina", "Automática"],
  ["Mitsubishi", "L200", "2.4 Katana CRT 4x4", 31990000, "Camioneta", "Diésel", "Manual"],
  ["Honda", "CR-V", "1.5 Turbo EXL", 33990000, "SUV", "Bencina", "Automática"],
  ["Jeep", "Compass", "2.4 Sport", 27990000, "SUV", "Bencina", "Automática"],
  ["Renault", "Duster", "1.6 Zen", 14990000, "SUV", "Bencina", "Manual"],
  ["Honda", "CB190R", "Std", 2990000, "Moto", "Bencina", "Manual"],
];
export const PHOTO_KEY: Record<string, string> = { "Mazda 3": "mazda3" };
export const COLORS = ["Blanco perla", "Gris plata", "Negro", "Rojo", "Azul marino", "Gris grafito", "Blanco"];
export const FIRST = ["Sofía", "Benjamín", "Isidora", "Vicente", "Florencia", "Joaquín", "Martina", "Agustín", "Antonella", "Tomás", "Catalina", "Cristóbal", "Fernanda", "Diego", "Javiera", "Lucas", "Constanza", "Nicolás", "Trinidad", "Maximiliano", "Amanda", "Sebastián", "Emilia", "Gaspar", "Renata", "Ignacio", "Paula", "Francisco", "Daniela", "Gabriel"];
export const LAST = ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández"];
export const COMUNAS_SCL = ["Providencia", "Ñuñoa", "Las Condes", "La Florida", "Maipú", "Santiago", "Vitacura", "Puente Alto", "La Reina", "Peñalolén"];
export const COMUNAS_VIN = ["Viña del Mar", "Valparaíso", "Quilpué", "Villa Alemana", "Concón", "Quillota"];
export const CANCEL_REASONS = ["Compró en otra automotora", "Sin aprobación de crédito", "Precio fuera de presupuesto", "Desistió de la compra", "No responde hace 30 días"];
export const CALL_NOTES = ["Consultó por financiamiento a 36 meses", "Pidió fotos adicionales del interior", "Quiere dejar su auto en parte de pago", "Vendrá el sábado a verlo", "Pide rebaja por pago contado", "Consultó por mantenciones al día", "Evaluando con su pareja", "Solicita cotización formal"];

export const TEMPLATES = {
  VENTA: `# NOTA DE VENTA DE VEHÍCULO
Folio {{folio}} · Fecha {{fecha}}
{{empresa.nombre}}, RUT {{empresa.rut}}, con domicilio en {{empresa.direccion}}, vende a {{cliente.nombre}}, RUT {{cliente.rut}}, el vehículo que se individualiza:
Marca {{vehiculo.marca}}, modelo {{vehiculo.modelo}} {{vehiculo.version}}, año {{vehiculo.anio}}, patente {{vehiculo.patente}}, VIN {{vehiculo.vin}}, kilometraje {{vehiculo.kilometraje}}, color {{vehiculo.color}}.
Precio final de venta: {{venta.precio}} (descuento aplicado: {{venta.descuento}}). Forma de pago: {{venta.forma_pago}}. Vendedor: {{venta.vendedor}}.
[TEXTO DEMO EDITABLE] Stroker reemplazará esta sección con sus cláusulas definitivas sobre garantía, transferencia y entrega.

______________________            ______________________
Firma vendedor                     Firma comprador`,
  RESERVA: `# COMPROBANTE DE RESERVA
Folio {{folio}} · Fecha {{fecha}}
{{cliente.nombre}}, RUT {{cliente.rut}}, reserva el vehículo {{vehiculo.marca}} {{vehiculo.modelo}} {{vehiculo.anio}}, patente {{vehiculo.patente}}, con un abono de {{reserva.monto}}, válido hasta el {{reserva.vence}}.
El abono se imputa al precio final ({{vehiculo.precio}}).
[TEXTO DEMO EDITABLE] Condiciones de devolución y vencimiento de la reserva.`,
  CONSIGNACION: `# CONTRATO DE CONSIGNACIÓN
Folio {{folio}} · Fecha {{fecha}}
{{cliente.nombre}}, RUT {{cliente.rut}}, entrega en consignación a {{empresa.nombre}} el vehículo {{vehiculo.marca}} {{vehiculo.modelo}} {{vehiculo.version}} año {{vehiculo.anio}}, patente {{vehiculo.patente}}, kilometraje {{vehiculo.kilometraje}}.
Modalidad: {{consignacion.modalidad}}. Monto neto acordado para el propietario: {{consignacion.monto_acordado}}. Vigencia hasta {{consignacion.vigencia}}.
[TEXTO DEMO EDITABLE] Mandato de venta, comisiones y obligaciones de las partes.`,
};
