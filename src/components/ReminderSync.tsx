"use client";

import { useEffect } from "react";
import { getReminder, localTz, saveReminderMessages, updateReminder } from "@/lib/push";
import { buildWeekMessages } from "@/lib/reminder-sync";
import { useArmario } from "@/lib/store";

const KEY = "armario-recordatorio-sync";
const EVERY = 3 * 3600_000;

/**
 * Cada vez que abrís la app (como mucho cada 3 horas, o si cambiaste ropa o perfil) actualiza
 * los mensajes del recordatorio de los próximos días, así a la mañana te llega lo de hoy.
 */
export default function ReminderSync() {
  const { ready, account, garments, profile } = useArmario();

  useEffect(() => {
    if (!ready || !account) return;
    const signature = `${account.id}:${garments.length}:${garments[0]?.id ?? ""}:${JSON.stringify(profile.weekPlan ?? {})}:${(profile.calendars ?? []).length}`;
    let last: { at: number; sig: string } | null = null;
    try {
      last = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {}
    if (last && last.sig === signature && Date.now() - last.at < EVERY) return;

    let alive = true;
    const t = setTimeout(async () => {
      try {
        const row = await getReminder(account.id);
        if (!alive || !row?.enabled) return;
        const messages = await buildWeekMessages(garments, profile);
        if (!alive) return;
        await saveReminderMessages(account.id, messages);
        if (row.tz !== localTz()) await updateReminder(account.id, { tz: localTz() });
        try {
          localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), sig: signature }));
        } catch {}
      } catch {
        // Sin conexión o sin permiso: se reintenta la próxima vez que abras la app.
      }
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ready, account, garments, profile]);

  return null;
}

/** Fuerza la próxima sincronización (al activar el recordatorio o cambiar la hora). */
export function resetReminderSync() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
