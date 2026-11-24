// Motor de outfits por reglas: combina la ropa del usuario según la ocasión,
// el clima, la armonía de colores y su perfil. No usa IA ni internet.

import {
  BODY_TYPES,
  OCCASIONS,
  UNDERTONES,
  PALETTE_BY_UNDERTONE,
  colorById,
  sportById,
  type OccasionId,
  type Weather,
} from "./catalog";
import type { Garment, Profile } from "./types";

export interface Outfit {
  items: Garment[];
  score: number;
  reasons: string[];
}

export interface Feedback {
  /** Claves de outfits (ids de prendas ordenados y unidos con "+") que te gustaron. */
  liked: string[];
  disliked: string[];
}

/** Clave de un outfit: los ids de sus prendas, ordenados. */
export function outfitKey(items: { id: string }[]): string {
  return items
    .map((i) => i.id)
    .sort()
    .join("+");
}

/** Cuánto gusta cada prenda según los 👍 / 👎 de los outfits donde aparece. */
function itemAffinity(fb: Feedback | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!fb) return m;
  for (const k of fb.liked) for (const id of k.split("+")) m.set(id, (m.get(id) ?? 0) + 1);
  for (const k of fb.disliked) for (const id of k.split("+")) m.set(id, (m.get(id) ?? 0) - 1);
  return m;
}

export interface OutfitRequest {
  occasion: OccasionId;
  weather: Weather;
  profile: Profile;
  /** Cantidad de outfits a devolver. */
  count?: number;
  /** Fuente de azar para variar resultados ("Otras opciones"). Por defecto no varía. */
  random?: () => number;
  now?: number;
  /** Prendas que ya se usan en otro día del plan: mejor no repetirlas. */
  avoidIds?: string[];
  /** Deporte del evento (si es de deporte), para elegir la ropa de ese deporte. */
  sport?: string;
  /** Lo que marcaste con 👍 / 👎. */
  feedback?: Feedback;
}

export interface OutfitResult {
  outfits: Outfit[];
  /** Qué falta cargar si no se pudo armar nada. */
  missing: string[];
  tip: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Puntaje de armonía para un conjunto de colores, con explicación. */
export function colorHarmony(colorIds: string[]): { score: number; reason: string | null } {
  const colors = colorIds.map(colorById);
  const unique = [...new Map(colors.map((c) => [c.id, c])).values()];
  const accents = unique.filter((c) => !c.neutral);

  if (accents.length === 0) {
    return { score: 1.5, reason: "Base de colores neutros: una combinación que nunca falla." };
  }
  if (accents.length === 1) {
    return {
      score: 2.5,
      reason: `El ${accents[0].label.toLowerCase()} es el único color protagonista y el resto lo acompaña.`,
    };
  }
  if (accents.length === 2) {
    const d = hueDistance(accents[0].hue, accents[1].hue);
    const names = `${accents[0].label.toLowerCase()} y ${accents[1].label.toLowerCase()}`;
    if (d <= 45) return { score: 1.5, reason: `El ${names} son colores vecinos y combinan suave.` };
    if (d >= 135) return { score: 1, reason: `El ${names} hacen un contraste complementario.` };
    return { score: -2.5, reason: null };
  }
  return { score: -4, reason: null };
}

function formalityPenalty(f: number, [min, max]: [number, number]): number {
  if (f < min) return min - f;
  if (f > max) return f - max;
  return 0;
}

function scoreOutfit(items: Garment[], req: OutfitRequest): Outfit {
  const occasion = OCCASIONS.find((o) => o.id === req.occasion)!;
  const reasons: string[] = [];
  let score = 0;
  const core = items.filter((i) => i.category !== "accessory");

  // Formalidad: cada prenda dentro del rango de la ocasión y parejas entre sí.
  const offRange = core.reduce((acc, i) => acc + formalityPenalty(i.formality, occasion.formality), 0);
  score -= offRange * 2;
  const fs = core.map((i) => i.formality);
  const spread = Math.max(...fs) - Math.min(...fs);
  if (spread >= 3) score -= 3;
  else if (spread >= 2) score -= 1;
  if (offRange === 0 && spread <= 1) {
    reasons.push(`El nivel de arreglo es justo para ${occasion.label.toLowerCase()}.`);
    score += 1;
  }

  // Colores.
  const harmony = colorHarmony(items.map((i) => i.color));
  score += harmony.score;
  if (harmony.reason) reasons.push(harmony.reason);

  // Estampados: con uno alcanza.
  const patterned = items.filter((i) => i.pattern === "estampado").length;
  if (patterned >= 2) score -= 2.5;
  else if (patterned === 1) {
    score += 0.3;
    reasons.push("Una sola prenda estampada, así el look no se recarga.");
  }

  // Estilo: el de la ocasión y el que te gusta.
  const occasionStyleHits = core.filter((i) => i.styles.some((s) => occasion.styles.includes(s))).length;
  score += (occasionStyleHits / core.length) * 1.5;
  const liked = req.profile.styles;
  if (liked.length > 0) {
    const likedHits = core.filter((i) => i.styles.some((s) => liked.includes(s))).length;
    score += (likedHits / core.length) * 1.5;
    if (likedHits / core.length >= 0.5) reasons.push("Va con el estilo que elegiste en tu perfil.");
  }

  // Clima.
  const hasOuter = items.some((i) => i.category === "outerwear");
  if (req.weather === "frio") {
    const warmPieces = core.filter((i) => i.warmth === "warm").length;
    if (!hasOuter && warmPieces === 0) score -= 3;
    else reasons.push("Tiene abrigo suficiente para el frío.");
    score -= core.filter((i) => i.warmth === "light" && i.category !== "shoes").length * 0.8;
  } else if (req.weather === "calor") {
    if (hasOuter) score -= 3;
    const heavy = core.filter((i) => i.warmth === "warm").length;
    score -= heavy * 2;
    if (heavy === 0 && !hasOuter) reasons.push("Son prendas livianas para el calor.");
  } else {
    score -= core.filter((i) => i.warmth === "warm" && i.category !== "outerwear").length * 0.7;
  }

  // Tono de piel: los colores cerca de la cara (arriba, vestido, abrigo).
  const undertone = req.profile.undertone;
  if (undertone) {
    const palette = PALETTE_BY_UNDERTONE[undertone];
    const nearFace = items.filter((i) => ["top", "dress", "outerwear"].includes(i.category));
    const good = nearFace.filter((i) => palette.includes(i.color));
    if (good.length > 0) {
      score += 1;
      const c = colorById(good[0].color).label.toLowerCase();
      const tone = UNDERTONES.find((u) => u.id === undertone)!.label.toLowerCase();
      reasons.push(`El ${c} cerca de la cara favorece tu tono de piel ${tone}.`);
    }
  }

  // Ropa de un deporte: para ese deporte sí, para otra cosa no (los botines no van a una cita).
  const specific = core.filter((i) => i.sport && i.sport !== "general");
  if (req.occasion === "deporte") {
    const sportsy = core.filter((i) => i.sport).length;
    score += (sportsy / core.length) * 1.5;
    if (req.sport) {
      const match = specific.filter((i) => i.sport === req.sport).length;
      score += match * 1.5 - (specific.length - match) * 2.5;
      if (match > 0) reasons.push(`Tiene ropa para ${sportById(req.sport)?.label.toLowerCase() ?? "ese deporte"}.`);
    }
  } else {
    score -= specific.length * 2;
  }

  // Ropa usada hace poco: mejor rotar.
  const now = req.now ?? Date.now();
  const recent = items.filter((i) => i.lastWorn && now - i.lastWorn < 2 * DAY).length;
  score -= recent * 1.2;

  // Que no se repita ropa entre días del plan.
  // Pesa más que un 👍 para que el plan de la semana no repita el outfit favorito todos los días.
  if (req.avoidIds?.length) score -= items.filter((i) => req.avoidIds!.includes(i.id)).length * 4;

  // Lo que te gustó y lo que no.
  if (req.feedback) {
    const key = outfitKey(items);
    if (req.feedback.liked.includes(key)) {
      score += 3;
      reasons.unshift("Este outfit te gustó antes 👍");
    }
    const aff = itemAffinity(req.feedback);
    score += items.reduce((n, i) => n + Math.max(-2, Math.min(2, aff.get(i.id) ?? 0)) * 0.4, 0);
  }

  if (req.random) score += req.random() * 2.5;

  return { items, score, reasons };
}

function sortByCategory(items: Garment[]): Garment[] {
  const order = ["outerwear", "top", "dress", "bottom", "shoes", "accessory"];
  return [...items].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

export function suggestOutfits(garments: Garment[], req: OutfitRequest): OutfitResult {
  const count = req.count ?? 3;
  const by = (c: Garment["category"]) => garments.filter((g) => g.category === c);
  const tops = by("top");
  const bottoms = by("bottom");
  const dresses = by("dress");
  const shoes = by("shoes");
  const outers = by("outerwear");
  const accessories = by("accessory");

  const missing: string[] = [];
  if (dresses.length === 0) {
    if (tops.length === 0) missing.push("al menos una parte de arriba");
    if (bottoms.length === 0) missing.push("al menos una parte de abajo");
  }
  if (shoes.length === 0) missing.push("al menos un calzado");

  const bases: Garment[][] = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of dresses) bases.push([d]);

  const bodyTip = req.profile.bodyType
    ? BODY_TYPES.find((b) => b.id === req.profile.bodyType)?.tip ?? null
    : null;

  if (bases.length === 0 || shoes.length === 0) {
    return { outfits: [], missing, tip: bodyTip };
  }

  // Combinaciones base + calzado; el abrigo y el accesorio se suman si mejoran el look.
  const candidates: Outfit[] = [];
  for (const base of bases) {
    for (const s of shoes) {
      let best = scoreOutfit([...base, s], req);
      for (const o of outers) {
        const withOuter = scoreOutfit([...base, s, o], req);
        if (withOuter.score > best.score) best = withOuter;
      }
      for (const a of accessories) {
        const withAcc = scoreOutfit([...best.items, a], req);
        if (withAcc.score > best.score + 0.2) best = withAcc;
      }
      candidates.push(best);
    }
  }

  const disliked = new Set(req.feedback?.disliked ?? []);
  candidates.sort((a, b) => b.score - a.score);
  if (disliked.size) {
    const kept = candidates.filter((c) => !disliked.has(outfitKey(c.items)));
    candidates.length = 0;
    candidates.push(...kept);
  }

  // Elegir variados: que no repitan la misma base.
  const chosen: Outfit[] = [];
  const usedBases = new Set<string>();
  const usage = new Map<string, number>();
  for (const c of candidates) {
    if (chosen.length >= count) break;
    const key = c.items
      .filter((i) => ["top", "bottom", "dress"].includes(i.category))
      .map((i) => i.id)
      .sort()
      .join("+");
    if (usedBases.has(key)) continue;
    const reused = c.items.filter((i) => (usage.get(i.id) ?? 0) >= 2).length;
    if (reused > 0 && candidates.length > count * 3) continue;
    usedBases.add(key);
    c.items.forEach((i) => usage.set(i.id, (usage.get(i.id) ?? 0) + 1));
    chosen.push({ ...c, items: sortByCategory(c.items) });
  }

  return { outfits: chosen, missing: [], tip: bodyTip };
}
