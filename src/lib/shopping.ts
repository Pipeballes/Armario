// Qué prenda te conviene comprar: prueba básicos "virtuales" y cuenta cuántos outfits buenos nuevos suman.

import { OCCASIONS, type Category, type OccasionId, type StyleId, type Warmth } from "./catalog";
import { suggestOutfits } from "./outfits";
import type { Garment, Profile } from "./types";

interface Basic {
  name: string;
  emoji: string;
  category: Category;
  color: string;
  formality: number;
  styles: StyleId[];
  warmth: Warmth;
}

const BASICS: Basic[] = [
  { name: "Remera blanca lisa", emoji: "👕", category: "top", color: "blanco", formality: 2, styles: ["casual", "minimalista"], warmth: "light" },
  { name: "Remera negra lisa", emoji: "👕", category: "top", color: "negro", formality: 2, styles: ["casual", "urbano", "rockero"], warmth: "light" },
  { name: "Camisa blanca", emoji: "👔", category: "top", color: "blanco", formality: 4, styles: ["clasico", "elegante"], warmth: "medium" },
  { name: "Camisa celeste", emoji: "👔", category: "top", color: "celeste", formality: 3, styles: ["clasico", "casual"], warmth: "medium" },
  { name: "Sweater gris", emoji: "🧶", category: "top", color: "gris", formality: 3, styles: ["clasico", "minimalista"], warmth: "warm" },
  { name: "Jean azul", emoji: "👖", category: "bottom", color: "denim", formality: 2, styles: ["casual", "urbano"], warmth: "medium" },
  { name: "Jean negro", emoji: "👖", category: "bottom", color: "negro", formality: 3, styles: ["casual", "rockero", "minimalista"], warmth: "medium" },
  { name: "Chino beige", emoji: "👖", category: "bottom", color: "beige", formality: 3, styles: ["clasico", "casual"], warmth: "medium" },
  { name: "Pantalón de vestir negro", emoji: "👖", category: "bottom", color: "negro", formality: 5, styles: ["elegante", "clasico"], warmth: "medium" },
  { name: "Zapatillas blancas", emoji: "👟", category: "shoes", color: "blanco", formality: 2, styles: ["casual", "urbano", "minimalista"], warmth: "medium" },
  { name: "Zapatos marrones", emoji: "👞", category: "shoes", color: "marron", formality: 4, styles: ["clasico", "elegante"], warmth: "medium" },
  { name: "Zapatos negros", emoji: "👞", category: "shoes", color: "negro", formality: 5, styles: ["elegante"], warmth: "medium" },
  { name: "Campera de jean", emoji: "🧥", category: "outerwear", color: "denim", formality: 2, styles: ["casual", "urbano"], warmth: "medium" },
  { name: "Blazer azul marino", emoji: "🧥", category: "outerwear", color: "azul-marino", formality: 4, styles: ["clasico", "elegante"], warmth: "medium" },
  { name: "Vestido negro", emoji: "👗", category: "dress", color: "negro", formality: 4, styles: ["elegante", "minimalista"], warmth: "medium" },
];

const GOOD = 3.5;
const CHECK: OccasionId[] = ["casual", "trabajo", "cita", "noche", "formal", "familia"];

/** Outfits buenos (sin repetir la misma base) por ocasión. */
function goodByOccasion(garments: Garment[], profile: Profile): Map<OccasionId, number> {
  const m = new Map<OccasionId, number>();
  for (const occasion of CHECK) {
    const r = suggestOutfits(garments, { occasion, weather: "templado", profile, count: 60, now: 0 });
    m.set(occasion, r.outfits.filter((o) => o.score >= GOOD).length);
  }
  return m;
}

export interface Suggestion {
  name: string;
  emoji: string;
  color: string;
  /** Outfits buenos nuevos que suma. */
  gain: number;
  /** Ocasiones donde hoy no tenés nada y con esto sí. */
  unlocks: string[];
}

export function shoppingSuggestions(garments: Garment[], profile: Profile, limit = 3): Suggestion[] {
  if (garments.length < 3) return [];
  const base = goodByOccasion(garments, profile);
  const baseTotal = [...base.values()].reduce((a, b) => a + b, 0);
  const hasDress = garments.some((g) => g.category === "dress") || profile.gender === "mujer";
  const out: Suggestion[] = [];

  for (const b of BASICS) {
    if (b.category === "dress" && !hasDress) continue;
    // Si ya tenés algo igual (mismo tipo, color y nivel de arreglo parecido), no lo sugiere.
    if (garments.some((g) => g.category === b.category && g.color === b.color && Math.abs(g.formality - b.formality) <= 1)) continue;
    const virtual: Garment = {
      id: `virtual-${b.name}`,
      photo: "",
      name: b.name,
      category: b.category,
      color: b.color,
      pattern: "liso",
      styles: b.styles,
      formality: b.formality,
      warmth: b.warmth,
      createdAt: 0,
    };
    const after = goodByOccasion([...garments, virtual], profile);
    const total = [...after.values()].reduce((a, c) => a + c, 0);
    const gain = total - baseTotal;
    if (gain <= 0) continue;
    const unlocks = CHECK.filter((o) => (base.get(o) ?? 0) === 0 && (after.get(o) ?? 0) > 0).map(
      (o) => OCCASIONS.find((x) => x.id === o)!.label,
    );
    out.push({ name: b.name, emoji: b.emoji, color: b.color, gain, unlocks });
  }
  // Primero lo que destraba ocasiones nuevas, después lo que más combinaciones suma.
  return out.sort((a, b) => b.unlocks.length - a.unlocks.length || b.gain - a.gain).slice(0, limit);
}
