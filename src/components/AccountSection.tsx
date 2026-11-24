"use client";

import { useState } from "react";
import { cloudEnabled } from "@/lib/supabase";
import { actions, useArmario } from "@/lib/store";

export default function AccountSection() {
  const { account, localCount } = useArmario();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!cloudEnabled) return null;

  if (account) {
    return (
      <section className="card mb-6 p-4">
        <p className="text-sm text-muted">Sesión iniciada como</p>
        <p className="mb-3 font-semibold break-all">{account.email}</p>
        <p className="mb-3 text-sm">☁️ Tu armario se guarda en la nube y lo ves desde cualquier dispositivo.</p>
        {localCount > 0 && (
          <div className="mb-3 rounded-xl bg-accent-soft p-3 text-sm">
            <p className="mb-2">
              En este navegador tenés {localCount} prenda{localCount === 1 ? "" : "s"} guardada
              {localCount === 1 ? "" : "s"} sin cuenta. ¿Las subo a tu cuenta?
            </p>
            <button
              className="btn-primary w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  const n = await actions.uploadLocal((d, t) => setMsg(`Subiendo ${d} de ${t}…`));
                  setMsg(n > 0 ? `¡Listo! Subí ${n} prenda${n === 1 ? "" : "s"}.` : "Ya estaba todo subido.");
                } catch {
                  setMsg("Se cortó la subida. Probá de nuevo: lo que ya subió no se repite.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Subiendo…" : "Subir a mi cuenta"}
            </button>
          </div>
        )}
        {msg && <p className="mb-3 text-sm">{msg}</p>}
        <button className="btn-ghost w-full" onClick={() => actions.signOut()}>
          Cerrar sesión
        </button>
      </section>
    );
  }

  return (
    <section className="card mb-6 p-4">
      <p className="mb-1 font-semibold">Guardá tu armario en la nube</p>
      <p className="mb-3 text-sm text-muted">
        Así no se pierde si cambiás de celular y lo ves desde la compu. Te mando un link a tu mail para entrar, sin
        contraseña.
      </p>
      {sent ? (
        <p className="rounded-xl bg-accent-soft p-3 text-sm">
          📬 Te mandé un mail a <strong>{email}</strong>. Abrí el link desde este mismo dispositivo. Si no llega en un
          par de minutos, mirá en spam.
        </p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            try {
              await actions.signIn(email.trim());
              setSent(true);
            } catch (err) {
              const text = err instanceof Error ? err.message : "";
              setMsg(
                /rate|seconds/i.test(text)
                  ? "Pediste muchos links seguidos. Esperá un minuto y probá de nuevo."
                  : "No se pudo mandar el mail. Revisá la dirección y probá de nuevo.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? "Mandando…" : "Mandame el link"}
          </button>
          {msg && <p className="text-sm text-danger">{msg}</p>}
        </form>
      )}
    </section>
  );
}
