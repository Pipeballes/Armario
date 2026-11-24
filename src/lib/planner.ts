// Planificador de la semana: un outfit por día según tu agenda y el clima, sin repetir ropa.

import type { AgendaEvent } from "./agenda";
import type { OccasionId, Weather } from "./catalog";
import { outfitKey, suggestOutfits, type Feedback, type Outfit } from "./outfits";
import type { Garment, Profile } from "./types";

export interface PlanDay {
  /** Fecha local "YYYY-MM-DD". */
  date: string;
  /** El evento principal del día (si hay). */
  event: AgendaEvent | null;
  others: number;
  occasion: OccasionId;
  weather: Weather;
  outfit: Outfit | null;
  /** true si lo fijaste a mano (no cambia al volver a armar la semana). */
  pinned: boolean;
}

/** Qué evento manda en el día: el más arreglado (un casamiento pesa más que una clase). */
const PRIORITY: OccasionId[] = ["formal", "cita", "noche", "trabajo", "familia", "deporte", "casual"];

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mainEvent(events: AgendaEvent[]): AgendaEvent | null {
  if (!events.length) return null;
  return [...events].sort((a, b) => PRIORITY.indexOf(a.occasion) - PRIORITY.indexOf(b.occasion))[0];
}

/** Prendas "principales" (las que no conviene repetir en la semana). */
const isCore = (g: Garment) => g.category === "top" || g.category === "bottom" || g.category === "dress";

export function planWeek(opts: {
  garments: Garment[];
  profile: Profile;
  events: AgendaEvent[];
  start: Date;
  days?: number;
  /** Clima de cada día (si hay pronóstico). */
  weatherFor?: (date: Date, event: AgendaEvent | null) => Weather | null;
  feedback?: Feedback;
  /** Días fijados a mano: fecha → ids de prendas. */
  pinned?: Record<string, string[]>;
  /** Para pedir "otra opción" en un día: fecha → outfits descartados (claves). */
  skips?: Record<string, string[]>;
}): PlanDay[] {
  const n = opts.days ?? 7;
  const byId = new Map(opts.garments.map((g) => [g.id, g]));
  const out: PlanDay[] = [];
  const used = new Set<string>();
  const usedOutfits: string[] = Object.values(opts.pinned ?? {}).map((ids) => [...ids].sort().join("+"));

  // Primero se reservan las prendas de los días fijados.
  for (const ids of Object.values(opts.pinned ?? {})) {
    for (const id of ids) {
      const g = byId.get(id);
      if (g && isCore(g)) used.add(id);
    }
  }

  for (let i = 0; i < n; i++) {
    const day = new Date(opts.start);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + i);
    const key = dateKey(day);
    const todays = opts.events.filter((e) => dateKey(new Date(e.start)) === key);
    const event = mainEvent(todays);
    const occasion: OccasionId = event?.occasion ?? "casual";
    const weather = opts.weatherFor?.(day, event) ?? "templado";

    const pinnedIds = opts.pinned?.[key];
    if (pinnedIds?.length) {
      const items = pinnedIds.map((id) => byId.get(id)).filter((g): g is Garment => !!g);
      if (items.length) {
        out.push({
          date: key,
          event,
          others: Math.max(0, todays.length - 1),
          occasion,
          weather,
          outfit: { items, score: 0, reasons: ["Lo fijaste vos 📌"] },
          pinned: true,
        });
        continue;
      }
    }

    // No se repite el mismo outfit en la semana, ni los descartados con "otra opción" ese día.
    const skipped = opts.skips?.[key] ?? [];
    const pick = (exclude: string[]) =>
      suggestOutfits(opts.garments, {
        occasion,
        weather,
        profile: opts.profile,
        count: 1,
        avoidIds: [...used],
        feedback: { liked: opts.feedback?.liked ?? [], disliked: [...(opts.feedback?.disliked ?? []), ...exclude] },
        // Para no penalizar ropa por "usada hace poco" en días futuros.
        now: day.getTime() + 12 * 3_600_000,
      });
    let res = pick([...skipped, ...usedOutfits]);
    // Si ya no quedan combinaciones nuevas, se permite repetir (pero no lo descartado ese día).
    if (!res.outfits.length && !skipped.length) res = pick([]);
    const outfit = res.outfits[0] ?? null;
    outfit?.items.filter(isCore).forEach((g) => used.add(g.id));
    if (outfit) usedOutfits.push(outfitKey(outfit.items));
    out.push({ date: key, event, others: Math.max(0, todays.length - 1), occasion, weather, outfit, pinned: false });
  }
  return out;
}

/** Ropa que hay que tener lista (lavada, planchada) en la semana, con los días en que se usa. */
export function prepList(plan: PlanDay[]): { garment: Garment; dates: string[] }[] {
  const m = new Map<string, { garment: Garment; dates: string[] }>();
  for (const d of plan) {
    for (const g of d.outfit?.items ?? []) {
      const e = m.get(g.id) ?? { garment: g, dates: [] };
      e.dates.push(d.date);
      m.set(g.id, e);
    }
  }
  return [...m.values()].sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}
