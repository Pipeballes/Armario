// El armario como un placard de verdad: cada prenda va a su lugar (barral, estantes, cajones,
// organizador de accesorios y zapatero), y dentro de cada lugar quedan ordenadas por tipo y color.

import { KINDS, categoryView, colorById } from "./catalog";
import type { Garment } from "./types";

export type ZoneKind = "barral" | "estante" | "cajon" | "organizador" | "zapatero";

export interface Zone {
  id: string;
  title: string;
  emoji: string;
  kind: ZoneKind;
  /** Texto corto para cuando el lugar está vacío. */
  empty: string;
  /** Categoría con la que se abre "Agregar" desde este lugar. */
  addCategory: Garment["category"];
  match: (g: Garment) => boolean;
}

/** Partes de arriba que van colgadas en percha (el resto va doblado en el estante). */
const HANGING_TOPS = new Set(["camisa", "camisa-manga-corta", "blusa", "tunica"]);
const SOCKS = new Set(["medias", "soquetes", "medias-cancan"]);

export function placardZones(gender: string | null | undefined): Zone[] {
  const ropaInterior = categoryView("interior", gender);
  const malla = categoryView("malla", gender);
  return [
    {
      id: "colgados",
      title: gender === "hombre" ? "Colgados (abrigos y camisas)" : "Colgados (abrigos, camisas y vestidos)",
      emoji: "🪝",
      kind: "barral",
      empty: "Camperas, sacos, camisas" + (gender === "hombre" ? "" : " y vestidos"),
      addCategory: "outerwear",
      match: (g) =>
        g.category === "outerwear" || g.category === "dress" || (g.category === "top" && HANGING_TOPS.has(g.kind ?? "")),
    },
    {
      id: "arriba",
      title: "Partes de arriba",
      emoji: "👕",
      kind: "estante",
      empty: "Remeras, buzos, sweaters",
      addCategory: "top",
      match: (g) => g.category === "top" && !HANGING_TOPS.has(g.kind ?? ""),
    },
    {
      id: "abajo",
      title: "Partes de abajo",
      emoji: "👖",
      kind: "estante",
      empty: gender === "mujer" ? "Jeans, pantalones, polleras" : "Jeans, pantalones, bermudas",
      addCategory: "bottom",
      match: (g) => g.category === "bottom",
    },
    {
      id: "interior",
      title: ropaInterior.label,
      emoji: ropaInterior.emoji,
      kind: "cajon",
      empty: gender === "mujer" ? "Bombachas, corpiños, tops" : gender === "hombre" ? "Calzoncillos, bóxers" : "Ropa interior",
      addCategory: "interior",
      match: (g) => g.category === "interior" && !SOCKS.has(g.kind ?? ""),
    },
    {
      id: "medias",
      title: "Medias",
      emoji: "🧦",
      kind: "cajon",
      empty: "Medias y soquetes",
      addCategory: "interior",
      match: (g) => g.category === "interior" && SOCKS.has(g.kind ?? ""),
    },
    {
      id: "pijamas",
      title: "Pijamas",
      emoji: "🛌",
      kind: "cajon",
      empty: "Ropa para dormir",
      addCategory: "pijama",
      match: (g) => g.category === "pijama",
    },
    {
      id: "mallas",
      title: "Mallas",
      emoji: malla.emoji,
      kind: "cajon",
      empty: gender === "mujer" ? "Bikinis y mallas enterizas" : "Shorts de baño",
      addCategory: "malla",
      match: (g) => g.category === "malla",
    },
    {
      id: "accesorios",
      title: "Accesorios",
      emoji: "🧢",
      kind: "organizador",
      empty: "Gorras, cinturones, anteojos",
      addCategory: "accessory",
      match: (g) => g.category === "accessory",
    },
    {
      id: "calzado",
      title: "Zapatero",
      emoji: "👟",
      kind: "zapatero",
      empty: "Zapatillas, zapatos, botas",
      addCategory: "shoes",
      match: (g) => g.category === "shoes",
    },
  ];
}

/** Qué tan clara es una prenda (para ordenar de claro a oscuro, como en un placard prolijo). */
function lightness(g: Garment): number {
  const hex = colorById(g.color).hex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const gr = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * gr + 0.114 * b;
}

/** Orden dentro de un lugar: primero por categoría, después por tipo (como en la lista de tipos) y por color. */
export function sortForShelf(items: Garment[]): Garment[] {
  const catOrder: Garment["category"][] = ["outerwear", "dress", "top", "bottom", "interior", "pijama", "malla", "accessory", "shoes"];
  const kindIndex = (g: Garment) => {
    const i = KINDS[g.category].findIndex((k) => k.id === g.kind);
    return i < 0 ? 999 : i;
  };
  return [...items].sort(
    (a, b) =>
      catOrder.indexOf(a.category) - catOrder.indexOf(b.category) ||
      kindIndex(a) - kindIndex(b) ||
      lightness(b) - lightness(a) ||
      a.name.localeCompare(b.name),
  );
}

export interface FilledZone {
  zone: Zone;
  items: Garment[];
  /** Cantidad de prendas contando las iguales (5 pares de medias cuentan 5). */
  units: number;
}

/** Reparte la ropa en el placard. Cada prenda va a un solo lugar. */
export function fillPlacard(garments: Garment[], gender: string | null | undefined): FilledZone[] {
  const zones = placardZones(gender);
  const placed = new Set<string>();
  return zones.map((zone) => {
    const items = sortForShelf(garments.filter((g) => !placed.has(g.id) && zone.match(g)));
    items.forEach((g) => placed.add(g.id));
    return { zone, items, units: items.reduce((n, g) => n + (g.quantity ?? 1), 0) };
  });
}
