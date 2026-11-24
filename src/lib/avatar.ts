// Datos del avatar 3D: proporciones del cuerpo según el perfil, color de piel y qué prenda va en cada lugar.

import { colorById, type BodyType } from "./catalog";
import type { AvatarStyle, Garment, Profile } from "./types";

export interface BodyDims {
  /** Factor de escala por altura (1 = 1,72 m). */
  scale: number;
  heightM: number;
  /** Medio ancho de hombros, cintura y cadera, en metros (a 1,72 m). */
  shoulder: number;
  waist: number;
  hip: number;
}

const SHAPES: Record<BodyType | "default", [number, number, number]> = {
  default: [0.21, 0.15, 0.17],
  rectangulo: [0.2, 0.16, 0.17],
  triangulo: [0.18, 0.14, 0.21],
  "triangulo-invertido": [0.24, 0.15, 0.16],
  ovalo: [0.2, 0.2, 0.19],
  reloj: [0.2, 0.13, 0.2],
};

export function bodyDims(p: Profile): BodyDims {
  const heightM = p.height && p.height >= 120 && p.height <= 220 ? p.height / 100 : 1.72;
  const [shoulder, waist, hip] = SHAPES[p.bodyType ?? "default"];
  return { scale: heightM / 1.72, heightM, shoulder, waist, hip };
}

const SKIN: Record<string, string> = {
  "clara-calido": "#f1c9a5",
  "clara-frio": "#f3cfc6",
  "clara-neutro": "#f0caa8",
  "media-calido": "#c99068",
  "media-frio": "#c08a7a",
  "media-neutro": "#c68e6e",
  "oscura-calido": "#8a5a3b",
  "oscura-frio": "#7a4f45",
  "oscura-neutro": "#80553f",
};

export function skinColor(p: Profile): string {
  return SKIN[`${p.skinDepth ?? "media"}-${p.undertone ?? "neutro"}`] ?? "#d6a283";
}

export type Slot = "top" | "bottom" | "shoes" | "outerwear" | "accessory";

export const SLOTS: { id: Slot; label: string; emoji: string }[] = [
  { id: "top", label: "Arriba", emoji: "👕" },
  { id: "bottom", label: "Abajo", emoji: "👖" },
  { id: "shoes", label: "Calzado", emoji: "👟" },
  { id: "outerwear", label: "Abrigo", emoji: "🧥" },
  { id: "accessory", label: "Accesorio", emoji: "🧢" },
];

/** En qué lugar del avatar va cada prenda (los vestidos van "arriba" y tapan lo de abajo). */
export function slotOf(g: Garment): Slot {
  if (g.category === "dress") return "top";
  return g.category as Slot;
}

export type Selection = Partial<Record<Slot, string>>;

/** Arma la selección a partir de una lista de prendas (ej: un outfit sugerido). */
export function selectionFrom(items: Garment[]): Selection {
  const sel: Selection = {};
  for (const g of items) sel[slotOf(g)] = g.id;
  return sel;
}

/** Cómo dibujar cada prenda en el avatar. */
export interface Look {
  top: { color: string; striped: boolean; sleeves: "short" | "long"; dress: "none" | "short" | "long" } | null;
  bottom: { color: string; striped: boolean; kind: "pants" | "shorts" | "skirt" } | null;
  shoes: { color: string; boots: boolean } | null;
  outerwear: { color: string; striped: boolean } | null;
  accessory: { color: string; kind: "cap" | "scarf" | "other" } | null;
}

const hex = (g: Garment) => colorById(g.color).hex;

export function lookFrom(sel: Selection, garments: Garment[]): Look {
  const get = (s: Slot) => garments.find((g) => g.id === sel[s]) ?? null;
  const top = get("top");
  const bottom = top?.category === "dress" ? null : get("bottom");
  const shoes = get("shoes");
  const outer = get("outerwear");
  const acc = get("accessory");
  const name = (g: Garment) => g.name.toLowerCase();
  return {
    top: top
      ? {
          color: hex(top),
          striped: top.pattern === "estampado",
          sleeves: top.warmth === "light" || /musculosa|remera|top\b/.test(name(top)) ? "short" : "long",
          dress: top.category !== "dress" ? "none" : top.formality >= 5 || /largo/.test(name(top)) ? "long" : "short",
        }
      : null,
    bottom: bottom
      ? {
          color: hex(bottom),
          striped: bottom.pattern === "estampado",
          kind: /pollera|falda/.test(name(bottom)) ? "skirt" : /short|bermuda/.test(name(bottom)) ? "shorts" : "pants",
        }
      : null,
    shoes: shoes ? { color: hex(shoes), boots: /bota/.test(name(shoes)) } : null,
    outerwear: outer ? { color: hex(outer), striped: outer.pattern === "estampado" } : null,
    accessory: acc
      ? {
          color: hex(acc),
          kind: /gorra|gorro|sombrero|boina/.test(name(acc)) ? "cap" : /bufanda|pa[ñn]uelo/.test(name(acc)) ? "scarf" : "other",
        }
      : null,
  };
}

/** Dónde se para la cámara en cada vista (en metros; el avatar mide 1,72 m a escala 1). */
export type View = "frente" | "costado" | "espalda" | "cara" | "otro";

export function cameraFor(view: View, scale: number): { position: [number, number, number]; target: [number, number, number] } {
  const t: [number, number, number] = [0, 0.92 * scale, 0];
  const far = 3.7 * scale;
  switch (view) {
    case "costado":
      return { position: [far, 1.15 * scale, 0], target: t };
    case "espalda":
      return { position: [0, 1.15 * scale, -far], target: t };
    case "cara":
      // Primer plano de la cara (la cabeza está a 1,67 m en el avatar de 1,72 m).
      return { position: [0, 1.69 * scale, 0.95], target: [0, 1.66 * scale, 0] };
    case "otro":
      // Alguien de altura promedio (ojos a 1,62 m) parado a unos 2 m, un poco de costado.
      return { position: [0.8, 1.62, 2.3], target: [0, 0.95 * scale, 0] };
    default:
      return { position: [0, 1.15 * scale, far], target: t };
  }
}

/** Outfit que manda la pantalla "¿Qué me pongo?" al probador con el botón "Probar en 3D". */
export const PROBAR_KEY = "armario-probar";

export const DEFAULT_AVATAR: AvatarStyle = { hair: "corto", hairColor: "#3b2a20", beard: false };

export const HAIRS: { id: AvatarStyle["hair"]; label: string }[] = [
  { id: "corto", label: "Corto" },
  { id: "largo", label: "Largo" },
  { id: "rapado", label: "Rapado" },
  { id: "rulos", label: "Rulos" },
  { id: "recogido", label: "Recogido" },
];

export const HAIR_COLORS: { hex: string; label: string }[] = [
  { hex: "#1f1a17", label: "Negro" },
  { hex: "#3b2a20", label: "Castaño oscuro" },
  { hex: "#7a5233", label: "Castaño claro" },
  { hex: "#d9b46a", label: "Rubio" },
  { hex: "#a8482c", label: "Pelirrojo" },
  { hex: "#9a9a9a", label: "Gris" },
];

export function avatarOf(p: Profile): AvatarStyle {
  return { ...DEFAULT_AVATAR, ...(p.avatar ?? {}) };
}
