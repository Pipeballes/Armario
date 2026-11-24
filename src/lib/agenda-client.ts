"use client";

import type { AgendaEvent } from "./agenda";
import { getAccessToken } from "./store";

const cache = new Map<string, { at: number; events: AgendaEvent[] }>();
const TTL = 5 * 60 * 1000;

/** Trae los eventos de los próximos días (guarda el resultado 5 minutos). */
export async function fetchAgenda(url: string, force = false): Promise<AgendaEvent[]> {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.events;
  const token = await getAccessToken();
  if (!token) throw new Error("Iniciá sesión para ver tu calendario.");
  const res = await fetch("/api/calendario", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pude leer tu calendario.");
  cache.set(url, { at: Date.now(), events: data.events });
  return data.events as AgendaEvent[];
}
