import { guard } from "@/lib/auth";
import { InPreparation } from "@/components/in-preparation";

export const metadata = { title: "Auditoría del Sistema" };

export default async function AuditoriaPage() {
  await guard("audit");
  return (
    <InPreparation
      title="Registro de Auditoría y Trazabilidad"
      section="Sistema"
      description="Historial inmutable de eventos sensibles en la automotora: cambios de precios de vehículos, modificaciones de contratos y notas de venta, accesos al sistema y ajustes financieros."
      roadmap={[
        "Bitácora cronológica con marcas de tiempo en horario de Santiago",
        "Identificación de usuario responsable, dirección IP y rol",
        "Diferencial antes y después en modificaciones de datos clave",
        "Filtros por tipo de entidad (Vehículo, Lead, Venta, Movimiento)",
      ]}
    />
  );
}
