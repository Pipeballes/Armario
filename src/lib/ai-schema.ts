// Qué le pedimos a la IA y cómo validamos lo que responde (se usa en el servidor y en el navegador).

import {
  BODY_TYPES,
  CATEGORIES,
  COLORS,
  SKIN_DEPTHS,
  STYLES,
  UNDERTONES,
  WARMTH,
  type BodyType,
  type Category,
  type Pattern,
  type SkinDepth,
  type StyleId,
  type Undertone,
  type Warmth,
} from "./catalog";

export interface GarmentAnalysis {
  name: string;
  category: Category;
  color: string;
  pattern: Pattern;
  styles: StyleId[];
  formality: number;
  warmth: Warmth;
}

export interface ProfileAnalysis {
  undertone: Undertone | null;
  skinDepth: SkinDepth | null;
  bodyType: BodyType | null;
  advice: string;
}

const ids = <T extends { id: string }>(xs: readonly T[]) => xs.map((x) => x.id);

export const GARMENT_PROMPT = `Sos un asesor de moda. Mirá la foto de UNA prenda y clasificala.
- name: nombre corto en español rioplatense (ej: "Remera blanca básica", "Jean azul recto").
- category: top (remeras, camisas, buzos, sweaters), bottom (pantalones, shorts, polleras), dress (vestidos, enteritos), shoes, outerwear (camperas, tapados, sacos), accessory (gorras, cinturones, bolsos, bufandas).
- color: el color principal de la prenda (no del fondo), el más cercano de la lista.
- pattern: liso o estampado (rayas, cuadros, flores, logos grandes cuentan como estampado).
- styles: de 1 a 3 estilos que le correspondan.
- formality: 1 = para estar en casa o hacer deporte, 3 = casual arreglado, 5 = formal (traje, vestido de fiesta).
- warmth: light (para calor), medium, warm (abriga mucho).`;

export const GARMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    category: { type: "STRING", enum: ids(CATEGORIES) },
    color: { type: "STRING", enum: ids(COLORS) },
    pattern: { type: "STRING", enum: ["liso", "estampado"] },
    styles: { type: "ARRAY", items: { type: "STRING", enum: ids(STYLES) } },
    formality: { type: "INTEGER" },
    warmth: { type: "STRING", enum: ids(WARMTH) },
  },
  required: ["name", "category", "color", "pattern", "styles", "formality", "warmth"],
};

export const PROFILE_PROMPT = `Sos un asesor de imagen amable y respetuoso. Mirá la foto de la persona y estimá:
- undertone: subtono de piel. calido (tonos dorados o melocotón), frio (rosados o azulados) o neutro. Si la luz no deja ver bien, elegí neutro.
- skinDepth: clara, media u oscura.
- bodyType: solo si se ve el cuerpo entero o casi entero. rectangulo (hombros, cintura y cadera parejos), triangulo (cadera más ancha que hombros), triangulo-invertido (hombros más anchos que cadera), ovalo (más volumen en el centro), reloj (cintura marcada). Si no se ve, devolvé null.
- advice: 2 o 3 frases en español rioplatense, positivas y concretas, sobre qué colores y cortes le favorecen. Nunca hagas comentarios negativos sobre el cuerpo ni sobre el peso.`;

export const PROFILE_SCHEMA = {
  type: "OBJECT",
  properties: {
    undertone: { type: "STRING", enum: ids(UNDERTONES) },
    skinDepth: { type: "STRING", enum: ids(SKIN_DEPTHS) },
    bodyType: { type: "STRING", enum: ids(BODY_TYPES), nullable: true },
    advice: { type: "STRING" },
  },
  required: ["undertone", "skinDepth", "advice"],
};

const pick = <T extends string>(value: unknown, allowed: readonly string[]): T | null =>
  typeof value === "string" && allowed.includes(value) ? (value as T) : null;

/** Valida la respuesta de la IA para una prenda. Devuelve null si no sirve. */
export function parseGarment(raw: unknown): GarmentAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const category = pick<Category>(r.category, ids(CATEGORIES));
  const color = pick<string>(r.color, ids(COLORS));
  const warmth = pick<Warmth>(r.warmth, ids(WARMTH));
  if (!category || !color || !warmth) return null;
  const styles = Array.isArray(r.styles)
    ? [...new Set(r.styles.map((s) => pick<StyleId>(s, ids(STYLES))).filter((s): s is StyleId => !!s))].slice(0, 3)
    : [];
  const f = Math.round(Number(r.formality));
  return {
    name: typeof r.name === "string" ? r.name.trim().slice(0, 60) : "",
    category,
    color,
    pattern: r.pattern === "estampado" ? "estampado" : "liso",
    styles: styles.length ? styles : ["casual"],
    formality: Number.isFinite(f) ? Math.min(5, Math.max(1, f)) : 2,
    warmth,
  };
}

/** Valida la respuesta de la IA para el perfil. */
export function parseProfile(raw: unknown): ProfileAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    undertone: pick<Undertone>(r.undertone, ids(UNDERTONES)),
    skinDepth: pick<SkinDepth>(r.skinDepth, ids(SKIN_DEPTHS)),
    bodyType: pick<BodyType>(r.bodyType, ids(BODY_TYPES)),
    advice: typeof r.advice === "string" ? r.advice.trim().slice(0, 600) : "",
  };
}
