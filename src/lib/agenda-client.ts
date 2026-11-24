"use client";

import type { AgendaEvent } from "./agenda";
import { getAccessToken } from "./store";
import type { CalendarLink } from "./types";

export interface CalendarResult {
  events: AgendaEvent[];
  calendar: { name: string | null; color: string | null };
}

const cache = new Map<string, { at: number; result: CalendarResult }>();
const TTL = 5 * 60 * 1000;

/** Lee un calendario (guarda el resultado 5 minutos). */
export async function fetchCalendar(url: string, force = false): Promise<CalendarResult> {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.result;
  const token = await getAccessToken();
  if (!token) throw new Error("Iniciá sesión para ver tu calendario.");
  const res = await fetch("/api/calendario", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pude leer tu calendario.");
  const result: CalendarResult = { events: data.events ?? [], calendar: data.calendar ?? { name: null, color: null } };
  cache.set(url, { at: Date.now(), result });
  return result;
}

/** Junta los eventos de todos los calendarios, cada uno con su nombre y color. */
export async function fetchAgenda(
  calendars: CalendarLink[],
): Promise<{ events: AgendaEvent[]; failed: string[] }> {
  const results = await Promise.allSettled(calendars.map((c) => fetchCalendar(c.url)));
  const events: AgendaEvent[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    const cal = calendars[i];
    if (r.status === "rejected") {
      failed.push(cal.name);
      return;
    }
    for (const e of r.value.events) {
      // Si el nombre del evento no dice qué es, se usa la ocasión elegida para ese calendario.
      const occasion = e.occasion === "casual" && cal.defaultOccasion ? cal.defaultOccasion : e.occasion;
      events.push({ ...e, occasion, id: `${cal.id}:${e.id}`, calendarName: cal.name, calendarColor: cal.color });
    }
  });
  events.sort((a, b) => a.start.localeCompare(b.start));
  return { events, failed };
}
