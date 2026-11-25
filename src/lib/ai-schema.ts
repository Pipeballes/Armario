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
import { FIT_VERSION } from "./types";

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
  /** Cuántas prendas iguales se ven en la foto (ej: 5 pares de medias apilados). */
  count?: number;
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
- count: cuántas prendas IGUALES se ven en la foto (por ejemplo 5 pares de medias iguales o 3 calzoncillos iguales juntos). Si hay una sola, 1.
- size: el talle SOLO si se lee en una etiqueta (ej: "M", "XL", "42", "10"). Si no se ve, dejalo vacío; no lo adivines. En calzado devolvé el talle US con el formato "US 9.5" (si la etiqueta solo trae el europeo, el brasileño o el argentino, pasalo a US).`;

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
    count: { type: "INTEGER" },
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
    count: Number.isInteger(Number(r.count)) && Number(r.count) > 1 ? Math.min(30, Number(r.count)) : undefined,
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
  if (!s || /^(null|n\/?a|desconocido|no se ve)$/i.test(s)) return undefined;
  // "us9.5" o "US  9,5" → "US 9.5"
  const us = /^us\s*([\d.,]+)$/i.exec(s);
  return us ? `US ${us[1].replace(",", ".")}` : s.toUpperCase();
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


/** Para "digitalizar" la prenda: color de la tela, dónde está el estampado y sus detalles, aunque la foto esté torcida. */
const FIT_BASE = `Mirá esta foto de UNA prenda (puede estar torcida, arrugada, sobre una cama o un piso). La vamos a dibujar en digital, así que necesito:
- box: [ymin, xmin, ymax, xmax] de la prenda entera (con mangas), en números de 0 a 1000 respecto de la foto.
- angle: cuántos grados está girada la prenda respecto de estar derecha con el cuello (o la cintura) arriba. Positivo si está girada en el sentido de las agujas del reloj, negativo si al revés. Entre -90 y 90. Si está derecha, 0.
- upside_down: true solo si el cuello o la cintura quedaron abajo (la prenda está al revés).
- fabric: el color principal de la tela en hexadecimal (#rrggbb), sin contar estampados, logos, sombras ni el fondo. Si la tela es blanca, que sea blanco aunque la luz la haga ver gris.
- has_print: true si tiene un estampado, dibujo, logo o texto suelto visible (no cuentan costuras, etiquetas ni arrugas, ni un dibujo que se repite por toda la tela).
- print_box: si has_print, [ymin, xmin, ymax, xmax] del estampado principal, ajustado al dibujo (0 a 1000 respecto de la foto). Si no, [0, 0, 0, 0].
- print_x: si has_print, dónde está de costado, imaginando la prenda derecha y mirándola como en la foto: -1 = borde izquierdo, 0 = centro, 1 = borde derecho. En una remera se mide sobre el cuerpo sin las mangas (un logo chico en el pecho del lado izquierdo de la foto sería -0.45); en un pantalón o short, sobre el ancho de la prenda (un logo en la pierna izquierda de la foto sería -0.5).
- print_y: si has_print, a qué altura está el centro: 0 = cuello o cintura, 0.3 = pecho, 0.5 = medio, 1 = ruedo.
- print_width: si has_print, qué tan ancho es comparado con el ancho de la prenda (0.15 = logo chico, 0.6 = estampado grande).`;

const FIT_DETAILS = `
Y los detalles, para dibujarla como es (si algo no se ve en la foto, poné lo que tiene una prenda así):
- trim: color (#rrggbb) de lo que contrasta con la tela: cuello, puños, elástico de la cintura, franjas, tiras, cordones o suela. Si nada contrasta, "".
- pattern: si TODA la tela tiene un dibujo que se repite: "rayas" (horizontales), "rayas-verticales", "cuadros", "lunares", "flores" o "camuflado". Si es lisa, o tiene un solo estampado o logo, "liso".
- pattern_color: el segundo color de ese dibujo (#rrggbb), o "".
- buttons: cuántos botones tiene al frente (0 si ninguno).
- hood: true si tiene capucha.
- drawstring: true si tiene cordón en la cintura o en la capucha.
- elastic_waist: true si la cintura es elastizada.
- side_stripes: true si tiene franjas a los costados, de arriba abajo.
- pockets: "ninguno", "pecho" (bolsillo en el pecho), "canguro", "jean" (bolsillos de jean), "cargo" (bolsillos grandes a los costados de las piernas) o "parche" (bolsillos cosidos por fuera).
- leg_length: solo en partes de abajo: "micro" (muy corto), "muslo" (a mitad del muslo), "rodilla" o "largo". Si no es una parte de abajo, "".
- sleeves: solo en partes de arriba y abrigos: "sin", "cortas" o "largas". Si no tiene mangas que mirar, "".
- strap: solo en calzado abierto: "dedo" (ojota con la tira entre los dedos), "ancha" (una tira ancha sobre el pie) o "tiras" (sandalia con varias tiras). Si no, "".
- width: qué tan ancha es: "ajustado" (pegado al cuerpo), "regular", "holgado" o "muy-holgado" (como un short de básquet). En un short o pantalón, mirá la boca de la pierna comparada con la cintura. En una remera o buzo: "holgado" si es oversize (hombros caídos, mangas que llegan casi al codo, cuerpo cuadrado), "muy-holgado" si es enorme, "ajustado" si es entallada.
- neck: solo en partes de arriba: "redondo", "v" (escote en V), "henley" (redondo con 2 o 3 botones), "bote" (ancho, casi de hombro a hombro), "camisero" (cuello de camisa), "polo" (cuello de chomba), "alto" (polera) o "capucha". Si no es una parte de arriba, "".
- body_length: solo en partes de arriba: "corto" (llega a la cintura o deja ver la panza), "normal" (a la cadera) o "largo" (tapa la cola). Si no, "".
- sleeve_color: color (#rrggbb) de las mangas si son de otro color que el cuerpo (como una remera de béisbol). Si son del mismo color, "".
- hem: cómo termina la pierna o el ruedo: "simple", "doblado" (con la botamanga doblada hacia afuera), "deshilachado" (cortado, con hilos sueltos), "elastico" o "tajo" (con un corte a los costados, como los shorts de correr).`;

/** Instrucciones para el ajuste; si se sabe qué prenda es, la IA busca mejor sus detalles. */
export function fitPrompt(context?: { category?: string; kind?: string }): string {
  const what = [context?.category, context?.kind].filter((x) => x && /^[a-z-]{1,30}$/.test(x)).join(", ");
  return FIT_BASE + FIT_DETAILS + (what ? `\nLa persona dijo que la prenda es: ${what}.` : "");
}
export const FIT_PROMPT = fitPrompt();

const FIT_BASE_PROPS = {
  box: { type: "ARRAY", items: { type: "INTEGER" } },
  angle: { type: "NUMBER" },
  upside_down: { type: "BOOLEAN" },
  fabric: { type: "STRING" },
  has_print: { type: "BOOLEAN" },
  print_box: { type: "ARRAY", items: { type: "INTEGER" } },
  print_x: { type: "NUMBER" },
  print_y: { type: "NUMBER" },
  print_width: { type: "NUMBER" },
};

export const FIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    ...FIT_BASE_PROPS,
    trim: { type: "STRING" },
    pattern: { type: "STRING", enum: ["liso", "rayas", "rayas-verticales", "cuadros", "lunares", "flores", "camuflado"] },
    pattern_color: { type: "STRING" },
    buttons: { type: "INTEGER" },
    hood: { type: "BOOLEAN" },
    drawstring: { type: "BOOLEAN" },
    elastic_waist: { type: "BOOLEAN" },
    side_stripes: { type: "BOOLEAN" },
    pockets: { type: "STRING", enum: ["ninguno", "pecho", "canguro", "jean", "cargo", "parche"] },
    leg_length: { type: "STRING", enum: ["", "micro", "muslo", "rodilla", "largo"] },
    sleeves: { type: "STRING", enum: ["", "sin", "cortas", "largas"] },
    strap: { type: "STRING", enum: ["", "dedo", "ancha", "tiras"] },
    width: { type: "STRING", enum: ["ajustado", "regular", "holgado", "muy-holgado"] },
    hem: { type: "STRING", enum: ["simple", "doblado", "deshilachado", "elastico", "tajo"] },
    neck: { type: "STRING", enum: ["", "redondo", "v", "henley", "bote", "camisero", "polo", "alto", "capucha"] },
    body_length: { type: "STRING", enum: ["", "corto", "normal", "largo"] },
    sleeve_color: { type: "STRING" },
  },
  required: ["box", "angle", "fabric", "has_print"],
};

/** Si el modelo no acepta el formato completo, se pide solo lo básico (sin detalles). */
export const FIT_SCHEMA_BASIC = {
  type: "OBJECT",
  properties: FIT_BASE_PROPS,
  required: ["box", "angle", "fabric", "has_print"],
};

const toBox = (raw: unknown): [number, number, number, number] | null => {
  const b = Array.isArray(raw) ? raw.map(Number) : [];
  if (b.length !== 4 || b.some((n) => !Number.isFinite(n))) return null;
  const [ymin, xmin, ymax, xmax] = b.map((n) => Math.min(1, Math.max(0, n / 1000)));
  if (xmax - xmin < 0.01 || ymax - ymin < 0.01) return null;
  return [xmin, ymin, xmax, ymax];
};
const clamp = (n: unknown, lo: number, hi: number, dflt: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v: unknown): string | undefined =>
  typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : undefined;
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined =>
  typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : undefined;

/** Detalles de la prenda (solo lo que vino bien formado; lo demás se completa según el tipo). */
export function parseDetails(r: Record<string, unknown>): import("./types").GarmentDetails | undefined {
  const d: import("./types").GarmentDetails = {};
  const trim = hexOr(r.trim);
  if (trim) d.trim = trim;
  const pattern = oneOf(r.pattern, ["rayas", "rayas-verticales", "cuadros", "lunares", "flores", "camuflado"] as const);
  if (pattern) {
    d.pattern = pattern;
    const pc = hexOr(r.pattern_color);
    if (pc) d.patternColor = pc;
  }
  const buttons = Number(r.buttons);
  if (Number.isFinite(buttons) && buttons > 0) d.buttons = Math.min(12, Math.round(buttons));
  if (r.hood === true) d.hood = true;
  if (r.drawstring === true) d.drawstring = true;
  if (r.elastic_waist === true) d.elastic = true;
  if (r.side_stripes === true) d.sideStripes = true;
  const pockets = oneOf(r.pockets, ["pecho", "canguro", "jean", "cargo", "parche"] as const);
  if (pockets) d.pockets = pockets;
  const leg = oneOf(r.leg_length, ["micro", "muslo", "rodilla", "largo"] as const);
  if (leg) d.legLength = leg;
  const sleeves = oneOf(r.sleeves, ["sin", "cortas", "largas"] as const);
  if (sleeves) d.sleeves = sleeves;
  const strap = oneOf(r.strap, ["dedo", "ancha", "tiras"] as const);
  if (strap) d.strap = strap;
  const width = oneOf(r.width, ["ajustado", "regular", "holgado", "muy-holgado"] as const);
  if (width) d.width = width;
  const hem = oneOf(r.hem, ["simple", "doblado", "deshilachado", "elastico", "tajo"] as const);
  if (hem && hem !== "simple") d.hem = hem;
  const neck = oneOf(r.neck, ["redondo", "v", "henley", "bote", "camisero", "polo", "alto", "capucha"] as const);
  if (neck) d.neck = neck;
  const bodyLength = oneOf(r.body_length, ["corto", "normal", "largo"] as const);
  if (bodyLength && bodyLength !== "normal") d.bodyLength = bodyLength;
  const sleeveColor = hexOr(r.sleeve_color);
  if (sleeveColor) d.sleeveColor = sleeveColor;
  return Object.keys(d).length ? d : undefined;
}

export function parseFit(raw: unknown): import("./types").GarmentFit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const box = toBox(r.box);
  if (!box || box[2] - box[0] < 0.05 || box[3] - box[1] < 0.05) return null;
  let angle = clamp(r.angle, -90, 90, 0);
  if (r.upside_down === true) angle += 180;
  const fabric = hexOr(r.fabric);
  if (!fabric) return null;
  const pbox = r.has_print === true ? toBox(r.print_box) : null;
  return {
    v: FIT_VERSION,
    angle: Math.round(angle * 10) / 10,
    box,
    fabric,
    print: pbox
      ? {
          box: pbox,
          x: Math.round(clamp(r.print_x, -1, 1, 0) * 100) / 100,
          y: Math.round(clamp(r.print_y, 0, 1, 0.35) * 100) / 100,
          width: Math.round(clamp(r.print_width, 0.05, 0.95, 0.4) * 100) / 100,
        }
      : undefined,
    details: parseDetails(r),
  };
}
