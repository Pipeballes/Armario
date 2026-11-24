// Texto de la notificación de la mañana: qué tenés hoy, el clima y qué ponerte.

import { OCCASIONS, WEATHERS } from "./catalog";
import type { PlanDay } from "./planner";
import type { WeatherReading } from "./weather";

export interface ReminderMessage {
  title: string;
  body: string;
}

/** Hora a la que llega si no elegiste otra. */
export const DEFAULT_REMINDER_HOUR = 8;

const MAX_BODY = 160;

export function reminderMessage(day: PlanDay, reading?: WeatherReading | null): ReminderMessage {
  const occ = OCCASIONS.find((o) => o.id === day.occasion);
  const what = day.event ? day.event.title : (occ?.label ?? "Día casual");
  const w = WEATHERS.find((x) => x.id === (reading?.weather ?? day.weather));
  const parts = [`${occ?.emoji ?? "☀️"} ${what}`];
  if (reading) parts.push(`${w?.emoji ?? ""} ${reading.feels}°${reading.rain >= 50 ? " ☔" : ""}`.trim());
  const title = `👕 Hoy: ${parts.join(" · ")}`;

  let body: string;
  if (day.outfit) {
    const names = day.outfit.items.map((g) => g.name.trim()).filter(Boolean);
    body = `Ponete: ${names.join(", ")}.`;
    if (reading && reading.rain >= 50) body += " Llevá paraguas.";
  } else {
    body = "Entrá a ver qué te ponés hoy.";
  }
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1).trimEnd() + "…";
  return { title, body };
}

/** Mensajes para cada día del plan, por fecha ("YYYY-MM-DD"). */
export function reminderMessages(
  plan: PlanDay[],
  readingFor?: (day: PlanDay) => WeatherReading | null,
): Record<string, ReminderMessage> {
  const out: Record<string, ReminderMessage> = {};
  for (const day of plan) out[day.date] = reminderMessage(day, readingFor?.(day) ?? null);
  return out;
}
