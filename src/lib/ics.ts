// Lectura de calendarios .ics (iCloud, Google, Outlook) en el servidor.

import ical from "node-ical";
import { guessOccasion, type AgendaEvent } from "./agenda";

const text = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "val" in v) return String((v as { val: unknown }).val);
  return "";
};

/** Devuelve los eventos entre `from` y `to`, con los repetidos (ej: gym todos los martes) ya expandidos. */
export function eventsFromIcs(body: string, from: Date, to: Date): AgendaEvent[] {
  const data = ical.sync.parseICS(body);
  const out: AgendaEvent[] = [];
  for (const [key, item] of Object.entries(data)) {
    if (!item || item.type !== "VEVENT") continue;
    // Las excepciones de un evento repetido vienen dentro del evento principal.
    if ("recurrenceid" in item && item.recurrenceid) continue;
    let instances;
    try {
      instances = ical.expandRecurringEvent(item, { from, to, expandOngoing: true });
    } catch {
      continue;
    }
    for (const inst of instances) {
      let start = new Date(inst.start);
      if (Number.isNaN(start.getTime())) continue;
      let end = inst.end ? new Date(inst.end) : null;
      if (inst.isFullDay) {
        // Un día completo no tiene hora: se guarda al mediodía UTC de esa fecha, así en
        // cualquier zona horaria (de UTC-11 a UTC+11) se ve en el día correcto.
        const d = new Date(inst.start as Date);
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        start = new Date(Date.UTC(y, m, day, 12));
        end = null;
      }
      if ((end ?? start) < from || start > to) continue;
      const title = text(inst.summary).trim() || "(Sin título)";
      out.push({
        id: `${item.uid ?? key}-${start.getTime()}`,
        title,
        start: start.toISOString(),
        end: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
        allDay: Boolean(inst.isFullDay),
        location: text(item.location).trim() || null,
        occasion: guessOccasion(title),
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
