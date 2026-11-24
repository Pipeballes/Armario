// Eventos del calendario y cómo adivinar la ocasión a partir del nombre del evento.

import type { OccasionId } from "./catalog";

export interface AgendaEvent {
  id: string;
  title: string;
  /** Fecha y hora de inicio (ISO). */
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  occasion: OccasionId;
}

const RULES: [RegExp, OccasionId][] = [
  [/casamiento|boda|civil|egreso|gala|graduaci|fiesta de 15|quince|bautismo|comuni[oó]n|velorio|funeral/i, "formal"],
  [/gym|gimnasio|entren|f[uú]tbol|futbol|padel|p[aá]del|tenis|correr|running|yoga|pilates|crossfit|nataci|bici|partido/i, "deporte"],
  [/cita|date|cena rom|aniversario/i, "cita"],
  [/boliche|fiesta|previa|joda|recital|show|bar\b|after|salida|cumple/i, "noche"],
  [/familia|abuel|almuerzo familiar|asado|mam[aá]|pap[aá]|t[ií]os?\b|primos?/i, "familia"],
  [/reuni[oó]n|meeting|oficina|trabajo|laburo|cliente|entrevista|presentaci|call|zoom|meet|clase|facu|parcial|examen|final\b/i, "trabajo"],
];

/** Adivina la ocasión por el nombre del evento (si no reconoce nada, es un día casual). */
export function guessOccasion(title: string): OccasionId {
  for (const [re, occasion] of RULES) if (re.test(title)) return occasion;
  return "casual";
}

/** Convierte un link webcal:// en https:// y valida que sea de un calendario conocido. */
export function normalizeCalendarUrl(raw: string): URL | null {
  const text = raw.trim().replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "icloud.com" ||
    host.endsWith(".icloud.com") ||
    host === "calendar.google.com" ||
    host === "outlook.live.com" ||
    host === "outlook.office365.com";
  return allowed ? url : null;
}

/** "Hoy 10:00", "Mañana", "Jue 27 · 21:30". */
export function formatWhen(e: AgendaEvent, now = new Date()): string {
  const d = new Date(e.start);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  const label =
    diff === 0
      ? "Hoy"
      : diff === 1
        ? "Mañana"
        : d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }).replace(/^\w/, (c) => c.toUpperCase());
  if (e.allDay) return label;
  return `${label} · ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
