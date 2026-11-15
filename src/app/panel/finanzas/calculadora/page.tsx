import { guard } from "@/lib/auth";
import { db } from "@/lib/db";
import { oppScope } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { Calculator } from "@/components/client/calculator";
import { saveSimulation } from "./actions";

export default async function Calc({ searchParams }: { searchParams: Promise<{ opp?: string; price?: string; vehicle?: string }> }) {
  const a = await guard("calculator");
  const s = await searchParams;
  const v = s.vehicle ? await db.vehicle.findUnique({ where: { id: s.vehicle } }) : null;
  const opps = await db.opportunity.findMany({ where: { ...oppScope(a), deletedAt: null, closedAt: null }, include: { contact: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Calculadora Financiera" desc="Ejemplo editable: $15.990.000, pie $3.000.000, 36 meses, 8,5% anual. Puedes precargar el precio desde la ficha del vehículo." />
      <Calculator initialPrice={v?.price ?? (s.price ? +s.price : undefined)} defaultOpp={s.opp} opps={opps.map((o) => ({ id: o.id, name: o.contact.name }))} save={saveSimulation} />
    </>
  );
}
