// Qué le pedimos a la IA y cómo validamos lo que responde (se usa en el servidor y en el navegador).

import {
  BODY_TYPES,
  CATEGORIES,
  COLORS,
  KINDS,
  SKIN_DEPTHS,
  SPECIAL_CATEGORIES,
  SPORTS,
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

const ALL_KIND_IDS = [...new Set(Object.values(KINDS).flatMap((list) => list.map((k) => k.id)))];

export interface GarmentAnalysis {
  name: string;
  category: Category;
  color: string;
  pattern: Pattern;
  styles: StyleId[];
  formality: number;
  warmth: Warmth;
  /** Talle leído de la etiqueta, si se ve. */
  size?: string;
  /** Si es ropa deportiva, de qué deporte. */
  sport?: string;
  /** Tipo dentro de pijama / ropa interior / malla. */
  kind?: string;
}

export interface ProfileAnalysis {
  undertone: Undertone | null;
  skinDepth: SkinDepth | null;
  bodyType: BodyType | null;
  advice: string;
  /** Rasgos para que el avatar 3D se parezca a la persona. */
  avatar: {
    hair: (typeof HAIR_IDS)[number] | null;
    hairColor: (typeof HAIR_COLOR_IDS)[number] | null;
    beard: boolean | null;
    glasses: (typeof GLASSES_IDS)[number] | null;
  };
}

/** Peinados, colores de pelo y anteojos que la IA puede elegir (coinciden con el avatar). */
export const HAIR_IDS = [
  "corto", "costado", "flequillo", "despeinado", "rapado", "pelado", "cresta", "rulos", "afro",
  "ondas", "melena", "largo", "colita", "rodete", "recogido", "trenzas", "rastas",
] as const;
export const HAIR_COLOR_IDS = ["negro", "castano-oscuro", "castano-claro", "rubio", "pelirrojo", "gris"] as const;
export const GLASSES_IDS = [
  "ninguno", "redondos", "cuadrados", "rectangulares", "gruesos", "aviador", "gatubelos",
  "sol", "sol-aviador", "sol-redondos", "sol-gatubelos", "sol-grandes", "sol-deportivos", "sol-espejados",
] as const;

const ids = <T extends { id: string }>(xs: readonly T[]) => xs.map((x) => x.id);

export const GARMENT_PROMPT = `Sos un asesor de moda. Mirá la foto de UNA prenda y clasificala.
- name: nombre corto en español rioplatense (ej: "Remera blanca básica", "Jean azul recto").
- category: top (remeras, camisas, buzos, sweaters), bottom (pantalones, shorts, polleras), dress (vestidos, enteritos), shoes, outerwear (camperas, tapados, sacos), accessory (gorras, cinturones, bolsos, bufandas), pijama (ropa de dormir), interior (calzoncillos o bombachas, corpiños, medias), malla (traje de baño).
- kind: qué prenda es exactamente, de la lista (ej: remera, camisa, hoodie, jean, pollera-midi, zapatillas, borcegos, campera-inflable, gorra, calzon, malla-abajo). Tiene que corresponder a la category elegida. Si ninguno encaja, "otro".
- color: el color principal de la prenda (no del fondo), el más cercano de la lista.
- pattern: liso o estampado (rayas, cuadros, flores, logos grandes cuentan como estampado).
- styles: de 1 a 3 estilos que le correspondan.
- formality: 1 = para estar en casa o hacer deporte, 3 = casual arreglado, 5 = formal (traje, vestido de fiesta).
- warmth: light (para calor), medium, warm (abriga mucho).
- sport: "ninguno" si no es ropa deportiva. Si lo es: el deporte si es claro (botines o camiseta de fútbol → futbol, calzas de running → running, raqueta/pádel → padel-tenis, etc.) o "general" si sirve para entrenar en general.
- size: el talle SOLO si se lee en una etiqueta (ej: "M", "XL", "42", "10"). Si no se ve, dejalo vacío; no lo adivines.`;

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
    size: { type: "STRING", nullable: true },
    sport: { type: "STRING", enum: ["ninguno", ...SPORTS.map((x) => x.id)] },
    kind: { type: "STRING", enum: ["ninguno", ...ALL_KIND_IDS] },
  },
  required: ["name", "category", "color", "pattern", "styles", "formality", "warmth"],
};

export const PROFILE_PROMPT = `Sos un asesor de imagen amable y respetuoso. Mirá la foto de la persona y estimá:
- undertone: subtono de piel. calido (tonos dorados o melocotón), frio (rosados o azulados) o neutro. Si la luz no deja ver bien, elegí neutro.
- skinDepth: clara, media u oscura.
- bodyType: solo si se ve el cuerpo entero o casi entero. rectangulo (hombros, cintura y cadera parejos), triangulo (cadera más ancha que hombros), triangulo-invertido (hombros más anchos que cadera), ovalo (más volumen en el centro), reloj (cintura marcada). Si no se ve, devolvé null.
- advice: 2 o 3 frases en español rioplatense, positivas y concretas, sobre qué colores y cortes le favorecen. Nunca hagas comentarios negativos sobre el cuerpo ni sobre el peso.
- hair: el peinado que más se parece: corto (con jopo), costado (raya al costado), flequillo, despeinado, rapado, pelado, cresta, rulos, afro, ondas (largo medio ondulado), melena (carré a la altura del mentón), largo (lacio por debajo de los hombros), colita, rodete (arriba de la cabeza), recogido (atado atrás), trenzas o rastas.
- hairColor: negro, castano-oscuro, castano-claro, rubio, pelirrojo o gris.
- beard: true si tiene barba visible, false si no.
- glasses: ninguno; recetados: redondos, cuadrados, rectangulares (finos), gruesos, aviador, gatubelos (ojo de gato); de sol: sol (clásicos), sol-aviador, sol-redondos, sol-gatubelos, sol-grandes, sol-deportivos, sol-espejados.`;

/** Agrega al pedido cómo se identifica la persona, para que los consejos se adapten. */
export function profilePromptFor(gender?: string | null): string {
  const g =
    gender === "mujer" ? "La persona se identifica como mujer." : gender === "hombre" ? "La persona se identifica como hombre." : "";
  return g ? `${PROFILE_PROMPT}\n${g} Adaptá los consejos a eso.` : PROFILE_PROMPT;
}

export const PROFILE_SCHEMA = {
  type: "OBJECT",
  properties: {
    undertone: { type: "STRING", enum: ids(UNDERTONES) },
    skinDepth: { type: "STRING", enum: ids(SKIN_DEPTHS) },
    bodyType: { type: "STRING", enum: ids(BODY_TYPES), nullable: true },
    advice: { type: "STRING" },
    hair: { type: "STRING", enum: [...HAIR_IDS] },
    hairColor: { type: "STRING", enum: [...HAIR_COLOR_IDS] },
    beard: { type: "BOOLEAN" },
    glasses: { type: "STRING", enum: [...GLASSES_IDS] },
  },
  required: ["undertone", "skinDepth", "advice", "hair", "hairColor", "beard", "glasses"],
};

const pick = <T extends string>(value: unknown, allowed: readonly string[]): T | null =>
  typeof value === "string" && allowed.includes(value) ? (value as T) : null;

/** Valida la respuesta de la IA para una prenda. Devuelve null si no sirve. */
/** Versión simple del formato (sin listas largas), por si el modelo rechaza la completa. */
export const GARMENT_SCHEMA_SIMPLE = {
  ...GARMENT_SCHEMA,
  properties: { ...GARMENT_SCHEMA.properties, kind: { type: "STRING" }, sport: { type: "STRING" } },
};

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
    size: parseSize(r.size),
    sport: SPECIAL_CATEGORIES.includes(category)
      ? undefined
      : (pick<string>(r.sport, SPORTS.map((x) => x.id)) ?? undefined),
    kind: pick<string>(r.kind, KINDS[category].map((k) => k.id)) ?? undefined,
  };
}

/** Talle tal como figura en la etiqueta (corto y sin texto de más). */
export function parseSize(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.replace(/^\s*talle\s*:?\s*/i, "").trim().slice(0, 12);
  return s && !/^(null|n\/?a|desconocido|no se ve)$/i.test(s) ? s.toUpperCase() : undefined;
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
    avatar: {
      hair: pick(r.hair, HAIR_IDS),
      hairColor: pick(r.hairColor, HAIR_COLOR_IDS),
      beard: typeof r.beard === "boolean" ? r.beard : null,
      glasses: pick(r.glasses, GLASSES_IDS),
    },
  };
}

// ---------- Elegir el mejor outfit ----------

export interface ChooseRequest {
  occasion: string;
  weather: string;
  event?: string;
  profile: { undertone?: string | null; bodyType?: string | null; styles?: string[]; gender?: string | null };
  options: { id: string; items: { name: string; category: string; color: string; formality: number; pattern: string }[] }[];
}

export interface ChoiceResult {
  /** Ids de las opciones, de la mejor a la peor. */
  order: string[];
  /** Por qué la primera es la mejor (2-3 frases). */
  why: string;
  /** Un consejo para completar el look (accesorio, cómo usar la prenda). */
  tip: string;
}

export const CHOOSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    order: { type: "ARRAY", items: { type: "STRING" } },
    why: { type: "STRING" },
    tip: { type: "STRING" },
  },
  required: ["order", "why", "tip"],
};

export function choosePrompt(c: ChooseRequest): string {
  const opts = c.options
    .map(
      (o) =>
        `- Opción ${o.id}: ` +
        o.items.map((i) => `${i.name} (${i.category}, color ${i.color}, formalidad ${i.formality}/5${i.pattern === "estampado" ? ", estampada" : ""})`).join("; "),
    )
    .join("\n");
  return `Sos un asesor de moda con buen gusto y hablás en español rioplatense, de forma simple y amable.
Ocasión: ${c.occasion}${c.event ? ` (evento: "${c.event}")` : ""}. Clima: ${c.weather}.
Persona: ${c.profile.gender === "mujer" ? "mujer, " : c.profile.gender === "hombre" ? "hombre, " : ""}subtono de piel ${c.profile.undertone ?? "sin dato"}, silueta ${c.profile.bodyType ?? "sin dato"}, estilos que le gustan: ${c.profile.styles?.join(", ") || "sin dato"}.
Opciones (todas con ropa que la persona ya tiene):
${opts}

Ordená las opciones de la mejor a la peor para esta ocasión y esta persona (order, con los ids tal cual).
En "why" explicá en 2 o 3 frases cortas por qué la primera es la mejor (colores, ocasión, silueta). No digas "Opción" ni números: nombrá las prendas.
En "tip" dá un consejo concreto para completar el look (cómo llevarla, qué accesorio sumar). Nunca critiques el cuerpo.`;
}

export function parseChoice(raw: unknown, ids: string[]): ChoiceResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // La IA a veces contesta "Opción 1" o un número en vez del id exacto.
  const norm = (x: unknown): string | null => {
    const str = String(x).trim();
    if (ids.includes(str)) return str;
    const num = /\d+/.exec(str)?.[0];
    return num && ids.includes(num) ? num : null;
  };
  const order = Array.isArray(r.order) ? r.order.map(norm).filter((x): x is string => x !== null) : [];
  const unique = [...new Set(order)];
  if (unique.length === 0) return null;
  // Las que la IA no nombró van al final, en el orden original.
  for (const id of ids) if (!unique.includes(id)) unique.push(id);
  return {
    order: unique,
    why: typeof r.why === "string" ? r.why.trim().slice(0, 500) : "",
    tip: typeof r.tip === "string" ? r.tip.trim().slice(0, 300) : "",
  };
}
