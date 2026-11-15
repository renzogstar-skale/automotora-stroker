import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { loginAction } from "../actions";
import { DemoLoginForm, type DemoAccess } from "./demo-login-form";

export const metadata = { title: "Ingresar al Panel", robots: { index: false } };

// Cuentas de la semilla: solo se exponen en desarrollo o con DEMO_LOGIN=1 explícito.
const demoAccess = (): DemoAccess | null =>
  process.env.NODE_ENV !== "production" || process.env.DEMO_LOGIN === "1"
    ? {
        password: "Stroker2026!",
        accounts: [
          { label: "Dueña / Admin", email: "dueno@stroker.demo" },
          { label: "Gerencia", email: "gerencia@stroker.demo" },
          { label: "Ventas", email: "valentina@stroker.demo" },
          { label: "Ventas 2", email: "josefa@stroker.demo" },
          { label: "Finanzas", email: "finanzas@stroker.demo" },
        ],
      }
    : null;

export default async function Login() {
  if (await getActor()) redirect("/panel");
  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">Ingresar a Stroker Gestión</h1>
      <p className="mb-5 text-sm text-muted">Panel privado para equipo comercial y administración.</p>
      
      <DemoLoginForm action={loginAction} demo={demoAccess()} />

      <div className="mt-4 flex justify-between text-sm">
        <Link href="/recuperar" className="link text-xs">
          Olvidé mi contraseña
        </Link>
        <Link href="/" className="text-xs text-muted hover:text-ink">
          ← Volver a la vitrina
        </Link>
      </div>
    </>
  );
}
