import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";

/** Bandeja de correos simulados (solo desarrollo/demo): permite completar invitaciones y recuperación sin proveedor de correo. */
export default async function Mailbox() {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MAILBOX !== "1") notFound();
  const mails = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold">Correos simulados</h1>
      <p className="mb-4 text-sm text-muted">Sin proveedor de correo configurado, los mensajes quedan aquí.</p>
      <ul className="space-y-2">
        {mails.map((m) => {
          const url = m.body.match(/https?:\/\/\S+/)?.[0];
          return <li key={m.id} className="card p-3 text-sm"><p className="font-medium">{m.subject}</p><p className="text-xs text-muted">{m.to} · {dateTime(m.createdAt)}</p>{url && <a className="link break-all" href={url.replace(/^https?:\/\/[^/]+/, "")}>{url}</a>}</li>;
        })}
      </ul>
    </main>
  );
}
