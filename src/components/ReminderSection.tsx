"use client";

import { useEffect, useState } from "react";
import {
  enableReminder,
  getReminder,
  pushSupport,
  saveReminderMessages,
  testReminder,
  updateReminder,
  type PushSupport,
  type ReminderRow,
} from "@/lib/push";
import { DEFAULT_REMINDER_HOUR } from "@/lib/reminder";
import { buildWeekMessages } from "@/lib/reminder-sync";
import { dateKey } from "@/lib/planner";
import { getAccessToken, useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";
import { resetReminderSync } from "./ReminderSync";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // de 5 a 22 h

export default function ReminderSection() {
  const { account, garments, profile } = useArmario();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [row, setRow] = useState<ReminderRow | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Se lee en el navegador (en el servidor no se sabe qué celular es).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(pushSupport());
  }, []);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    getReminder(account.id)
      .then((r) => alive && setRow(r))
      .catch(() => alive && setRow(null));
    return () => {
      alive = false;
    };
  }, [account]);

  if (!cloudEnabled) return null;

  const title = <p className="mb-1 font-semibold">🔔 Recordatorio a la mañana</p>;

  if (!account) {
    return (
      <section className="card mb-6 p-4">
        {title}
        <p className="text-sm text-muted">
          Todas las mañanas te llega una notificación con qué ponerte según tu agenda y el clima. Primero entrá con tu
          mail (arriba).
        </p>
      </section>
    );
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Algo falló. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  const id = account.id;
  const enabled = Boolean(row?.enabled);

  const turnOn = () =>
    run("on", async () => {
      const hour = row?.hour ?? DEFAULT_REMINDER_HOUR;
      await enableReminder(id, hour);
      setRow({ enabled: true, hour, tz: row?.tz ?? "" });
      await saveReminderMessages(id, await buildWeekMessages(garments, profile)).catch(() => {});
      resetReminderSync();
      setMsg(`¡Listo! Mañana a las ${hour} h te llega qué ponerte. Tocá "Probar ahora" para ver cómo se ve.`);
    });

  const turnOff = () =>
    run("off", async () => {
      await updateReminder(id, { enabled: false });
      setRow((r) => (r ? { ...r, enabled: false } : r));
      setMsg("Listo, no te mando más recordatorios.");
    });

  const changeHour = (hour: number) =>
    run("hour", async () => {
      await updateReminder(id, { hour });
      setRow((r) => (r ? { ...r, hour } : r));
    });

  const test = () =>
    run("test", async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Entrá con tu mail para probar.");
      const messages = await buildWeekMessages(garments, profile);
      await saveReminderMessages(id, messages).catch(() => {});
      await testReminder(token, messages[dateKey(new Date())] ?? { title: "👕 Armario", body: "Así te va a llegar." });
      setMsg("Te mandé una de prueba. Si no la ves en unos segundos, revisá que el celular no esté en No molestar.");
    });

  return (
    <section className="card mb-6 p-4">
      {title}
      <p className="mb-3 text-sm text-muted">
        Todas las mañanas te llega una notificación con tu evento del día, el clima y qué ponerte. Tocándola se abre la
        app.
      </p>

      {support === "instalar" && !enabled && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="mb-2 font-semibold">En iPhone primero instalá la app:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Abrí esta página en <strong>Safari</strong>.</li>
            <li>
              Tocá <strong>Compartir</strong> (el cuadradito con la flecha) → <strong>Agregar a inicio</strong>.
            </li>
            <li>Abrí Armario desde el ícono nuevo y volvé acá a Perfil.</li>
          </ol>
        </div>
      )}

      {support === "no" && !enabled && (
        <p className="text-sm text-muted">Este navegador no permite notificaciones. Probá desde el celular con la app instalada.</p>
      )}

      {support === "ok" && !enabled && row !== undefined && (
        <button type="button" className="btn-primary w-full" disabled={busy !== null} onClick={turnOn}>
          {busy === "on" ? "Activando…" : "🔔 Activar recordatorio"}
        </button>
      )}

      {enabled && row && (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>¿A qué hora?</span>
            <select
              className="input w-auto"
              value={row.hour}
              disabled={busy !== null}
              onChange={(e) => changeHour(Number(e.target.value))}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}:00 h
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" disabled={busy !== null} onClick={test}>
              {busy === "test" ? "Mandando…" : "Probar ahora"}
            </button>
            <button type="button" className="btn-ghost flex-1" disabled={busy !== null} onClick={turnOff}>
              Desactivar
            </button>
          </div>
          {support === "ok" && (
            <button type="button" className="text-xs text-accent underline" disabled={busy !== null} onClick={turnOn}>
              ¿Cambiaste de celular? Activalo en este
            </button>
          )}
          <p className="text-xs text-muted">
            Llega al último celular donde lo activaste. Para que tenga en cuenta tu agenda y el clima de ese día, abrí la
            app de vez en cuando (se actualiza sola para los próximos 7 días).
          </p>
        </div>
      )}

      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </section>
  );
}
