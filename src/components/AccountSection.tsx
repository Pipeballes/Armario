"use client";

import { useEffect, useState } from "react";
import { cloudEnabled, linkError } from "@/lib/supabase";
import { actions, useArmario } from "@/lib/store";

export default function AccountSection() {
  const { account, localCount } = useArmario();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(linkError);
  const [cooldown, setCooldown] = useState(0);

  // Sacar el error del link de la dirección (Next.js la restaura al cargar, por eso se hace acá).
  useEffect(() => {
    if (linkError && /error/.test(window.location.hash + window.location.search)) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      await actions.signIn(email.trim());
      setSent(true);
      setCode("");
      setCooldown(60);
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      const status = (err as { status?: number })?.status;
      setMsg(
        /rate|seconds|limit/i.test(text)
          ? "Se pidieron muchos mails seguidos. Esperá unos minutos y probá de nuevo (si ya tenés un código, usalo)."
          : /invalid.*email|email.*invalid/i.test(text)
            ? "Esa dirección de mail no es válida. Revisala y probá de nuevo."
            : status && status >= 500
              ? "No pude mandar el mail por un problema del servicio de envío (no es tu dirección). Probá en un rato."
              : "No se pudo mandar el mail. Revisá tu conexión y probá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

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
    <section id="cuenta" className="card mb-6 scroll-mt-4 p-4">
      <p className="mb-1 font-semibold">Guardá tu armario en la nube</p>
      <p className="mb-3 text-sm text-muted">
        Así no se pierde si cambiás de celular y lo ves desde la compu. Te mando un código a tu mail para entrar, sin
        contraseña.
      </p>
      {msg && <p className="mb-3 rounded-xl bg-accent-soft p-3 text-sm">{msg}</p>}
      {sent ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            try {
              await actions.verifyCode(email.trim(), code);
            } catch {
              setMsg("Ese código no es correcto o ya venció. Revisalo o pedí uno nuevo.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm">
            📬 Te mandé un mail de <strong>Armario</strong> a <strong className="break-all">{email}</strong> con un{" "}
            <strong>código de 6 números</strong>. Escribilo acá. Si no aparece en un par de minutos, mirá en spam o
            promociones.
          </p>
          <input
            className="input text-center text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={10}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Código del mail"
          />
          <button className="btn-primary" disabled={busy || code.length < 6}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
          <p className="text-xs text-muted">
            El mail también trae un botón para entrar: sirve una sola vez y solo en este mismo dispositivo.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" disabled={busy || cooldown > 0} onClick={send}>
              {cooldown > 0 ? `Reenviar (${cooldown}s)` : "Reenviar mail"}
            </button>
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => {
                setSent(false);
                setMsg(null);
              }}
            >
              Cambiar mail
            </button>
          </div>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
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
            {busy ? "Mandando…" : "Mandame el código"}
          </button>
        </form>
      )}
    </section>
  );
}
