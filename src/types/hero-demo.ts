export interface DemoVehicle {
  id: string;
  slug: string;
  stockCode?: string | null;
  brand: string;
  model: string;
  version: string;
  year: number;
  km: number;
  price: number;
  status: "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "EN_CONSIGNACION" | "POR_CONFIRMAR";
  transmission: string;
  fuel: string;
  bodyType: string;
  color: string;
  featured?: boolean;
  minDownPayment?: number | null;
  instagramUrl?: string | null;
  features?: string[] | null;
  verificationStatus?: string | null;
  branchId: string;
  branch: {
    id: string;
    name: string;
    comuna: string;
    code?: string;
  };
  photos: {
    url: string;
  }[];
}

export interface DemoBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  comuna: string;
  region: string;
  phone: string;
  whatsapp: string;
}

export interface HeroFilterState {
  marca: string;
  modelo?: string;
  precioMin: string;
  precioMax: string;
  anio: string;
  kmMax?: string;
  transmision?: string;
  combustible?: string;
  estado?: string;
  sucursal: string;
  orden?: "destacados" | "recientes" | "precio-asc" | "precio-desc" | "anio-desc" | "anio-asc" | "km-asc";
}

export interface DemoAppointmentBooking {
  vehicleId: string;
  vehicleName: string;
  branchId: string;
  branchName: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
}

export interface DemoAppointmentConfirmation {
  code: string;
  booking: DemoAppointmentBooking;
  createdAt: string;
  isSimulated: true;
}
