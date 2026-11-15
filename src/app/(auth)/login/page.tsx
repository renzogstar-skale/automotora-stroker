import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { loginAction } from "../actions";
import { DemoLoginForm } from "./demo-login-form";

export const metadata = { title: "Ingresar al Panel" };

export default async function Login() {
  if (await getActor()) redirect("/panel");
  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">Ingresar a Stroker Gestión</h1>
      <p className="mb-5 text-sm text-muted">Panel privado para equipo comercial y administración.</p>
      
      <DemoLoginForm action={loginAction} />

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
