// Catálogo de opciones: categorías, colores, estilos, ocasiones y perfil.
// Todo el texto visible está en español porque la app es en español.

export type Category = "top" | "bottom" | "dress" | "shoes" | "outerwear" | "accessory" | "pijama" | "interior" | "malla";
export type Warmth = "light" | "medium" | "warm";
export type Pattern = "liso" | "estampado";
export type Temp = "warm" | "cool" | "neutral";
export type Weather = "frio" | "templado" | "calor";

export const CATEGORIES: {
  id: Category;
  label: string;
  plural: string;
  emoji: string;
  /** Ícono distinto para hombre / mujer (si no, se usa emoji). */
  emojiH?: string;
  emojiM?: string;
}[] = [
  { id: "top", label: "Parte de arriba", plural: "Partes de arriba", emoji: "👕" },
  { id: "bottom", label: "Parte de abajo", plural: "Partes de abajo", emoji: "👖" },
  { id: "dress", label: "Vestido o enterito", plural: "Vestidos y enteritos", emoji: "👗" },
  { id: "shoes", label: "Calzado", plural: "Calzado", emoji: "👟" },
  { id: "outerwear", label: "Abrigo", plural: "Abrigos", emoji: "🧥" },
  { id: "accessory", label: "Accesorio", plural: "Accesorios", emoji: "🧢" },
  { id: "pijama", label: "Pijama", plural: "Pijamas", emoji: "🛌" },
  { id: "interior", label: "Ropa interior", plural: "Ropa interior", emoji: "🩲", emojiH: "🩲", emojiM: "🎀" },
  { id: "malla", label: "Malla", plural: "Mallas", emoji: "🩳", emojiH: "🩳", emojiM: "👙" },
];

/** Categorías que no entran en los outfits de todos los días. */
export const SPECIAL_CATEGORIES: Category[] = ["pijama", "interior", "malla"];

type KindGender = "hombre" | "mujer";

const isH = (g: string | null | undefined) => g === "hombre";
const isM = (g: string | null | undefined) => g === "mujer";

/** Cómo se ve una categoría según el género (ícono propio para hombre y mujer). */
export function categoryView(id: Category, gender: string | null | undefined) {
  const c = CATEGORIES.find((x) => x.id === id)!;
  return { ...c, emoji: (isH(gender) && c.emojiH) || (isM(gender) && c.emojiM) || c.emoji };
}
/** Dónde va en el avatar (solo para pijama, ropa interior y malla). */
type KindSlot = "top" | "bottom" | "outerwear" | "accessory" | null;
export interface KindDef {
  id: string;
  label: string;
  /** Si es solo para un género (con "otro" o sin género se ven todas). */
  only?: KindGender;
  /** Nombre para mujer cuando es la misma prenda con otro nombre (ej: calzoncillo / bombacha). */
  labelM?: string;
  slot?: KindSlot;
  /** Pistas para dibujarla en el avatar. */
  look?: "corta" | "larga" | "pollera" | "botas" | "gorro" | "bufanda";
  /** Sección donde se muestra (para ordenar las partes del pijama). */
  group?: string;
}

const H = "hombre" as const;
const M = "mujer" as const;
const OTHER: KindDef = { id: "otro", label: "Otro", slot: null };

const UNDERWEAR_RAW: KindDef[] = [
  { id: "calzon", label: "Calzoncillo", labelM: "Bombacha", slot: "bottom" },
  { id: "boxer", label: "Bóxer", labelM: "Culotte", slot: "bottom" },
  { id: "tanga", label: "Tanga o colaless", only: M, slot: "bottom" },
  { id: "corpino", label: "Corpiño", only: M, slot: "top" },
  { id: "corpino-deportivo", label: "Corpiño deportivo", only: M, slot: "top" },
  { id: "top-interior", label: "Top o bralette", only: M, slot: "top" },
  { id: "body-interior", label: "Body", only: M, slot: "top" },
  { id: "camiseta", label: "Camiseta", slot: "top" },
  { id: "medias", label: "Medias", slot: null },
  { id: "soquetes", label: "Soquetes", slot: null },
  { id: "medias-cancan", label: "Medias de nylon o cancan", only: M, slot: null },
];

const SOCKS = ["medias", "soquetes", "medias-cancan"];
const UNDERWEAR: KindDef[] = UNDERWEAR_RAW.map((k) => ({ ...k, group: SOCKS.includes(k.id) ? "Medias" : "Ropa interior" }));

/**
 * Qué tipo de prenda es dentro de cada categoría, con lo que usan hombres y mujeres
 * (nombres como se dicen en Argentina).
 */
export const KINDS: Record<Category, KindDef[]> = {
  top: [
    { id: "remera", label: "Remera", look: "corta" },
    { id: "remera-manga-larga", label: "Remera manga larga", look: "larga" },
    { id: "musculosa", label: "Musculosa", look: "corta" },
    { id: "camisa", label: "Camisa", look: "larga" },
    { id: "camisa-manga-corta", label: "Camisa manga corta", look: "corta" },
    { id: "chomba", label: "Chomba", look: "corta" },
    { id: "buzo", label: "Buzo", look: "larga" },
    { id: "hoodie", label: "Buzo con capucha", look: "larga" },
    { id: "sweater", label: "Sweater o pulóver", look: "larga" },
    { id: "polera", label: "Polera (cuello alto)", look: "larga" },
    { id: "cardigan", label: "Cárdigan", look: "larga" },
    { id: "chaleco-tejido", label: "Chaleco tejido", look: "corta" },
    { id: "camiseta-equipo", label: "Camiseta de fútbol o de equipo", look: "corta" },
    { id: "blusa", label: "Blusa", only: M, look: "larga" },
    { id: "top", label: "Top", only: M, look: "corta" },
    { id: "crop-top", label: "Crop top", only: M, look: "corta" },
    { id: "body", label: "Body", only: M, look: "corta" },
    { id: "corset", label: "Corset", only: M, look: "corta" },
    { id: "tunica", label: "Túnica o camisola", only: M, look: "larga" },
    OTHER,
  ],
  bottom: [
    { id: "jean", label: "Jean" },
    { id: "pantalon-vestir", label: "Pantalón de vestir" },
    { id: "chino", label: "Chino o gabardina" },
    { id: "jogging", label: "Jogging" },
    { id: "cargo", label: "Cargo" },
    { id: "pantalon-lino", label: "Pantalón de lino" },
    { id: "short", label: "Short", look: "corta" },
    { id: "bermuda", label: "Bermuda", look: "corta" },
    { id: "calza", label: "Calza" },
    { id: "calza-corta", label: "Calza corta o biker", only: M, look: "corta" },
    { id: "pollera-mini", label: "Pollera corta", only: M, look: "pollera" },
    { id: "pollera-midi", label: "Pollera midi", only: M, look: "pollera" },
    { id: "pollera-larga", label: "Pollera larga", only: M, look: "pollera" },
    { id: "short-pollera", label: "Short pollera", only: M, look: "pollera" },
    { id: "palazzo", label: "Palazzo o pantalón ancho", only: M },
    { id: "oxford", label: "Oxford", only: M },
    { id: "babucha", label: "Babucha", only: M },
    OTHER,
  ],
  dress: [
    { id: "vestido-corto", label: "Vestido corto", look: "corta" },
    { id: "vestido-midi", label: "Vestido midi", look: "corta" },
    { id: "vestido-largo", label: "Vestido largo", look: "larga" },
    { id: "vestido-fiesta", label: "Vestido de fiesta", look: "larga" },
    { id: "solero", label: "Solero", look: "corta" },
    { id: "enterito", label: "Enterito o mono", look: "larga" },
    { id: "jardinero", label: "Jardinero", look: "larga" },
    OTHER,
  ],
  shoes: [
    { id: "zapatillas", label: "Zapatillas" },
    { id: "zapatillas-deportivas", label: "Zapatillas deportivas o running" },
    { id: "botines", label: "Botines de fútbol" },
    { id: "zapatos", label: "Zapatos" },
    { id: "mocasines", label: "Mocasines" },
    { id: "nauticos", label: "Náuticos" },
    { id: "borcegos", label: "Borcegos", look: "botas" },
    { id: "botas", label: "Botas o botinetas", look: "botas" },
    { id: "alpargatas", label: "Alpargatas" },
    { id: "sandalias", label: "Sandalias" },
    { id: "ojotas", label: "Ojotas" },
    { id: "pantuflas", label: "Pantuflas" },
    { id: "tacos", label: "Tacos o stilettos", only: M },
    { id: "sandalias-taco", label: "Sandalias con taco", only: M },
    { id: "plataformas", label: "Plataformas", only: M },
    { id: "chatitas", label: "Chatitas o balerinas", only: M },
    { id: "botas-altas", label: "Botas altas o bucaneras", only: M, look: "botas" },
    { id: "zuecos", label: "Zuecos o mules", only: M },
    OTHER,
  ],
  outerwear: [
    { id: "campera", label: "Campera" },
    { id: "campera-jean", label: "Campera de jean" },
    { id: "campera-cuero", label: "Campera de cuero" },
    { id: "campera-inflable", label: "Campera inflable o puffer" },
    { id: "rompevientos", label: "Rompevientos" },
    { id: "parka", label: "Parka" },
    { id: "tapado", label: "Tapado" },
    { id: "piloto", label: "Piloto o trench" },
    { id: "saco", label: "Saco o blazer" },
    { id: "chaleco", label: "Chaleco" },
    { id: "polar", label: "Polar o micropolar" },
    { id: "poncho", label: "Poncho o ruana" },
    { id: "kimono", label: "Kimono", only: M },
    { id: "capa", label: "Capa", only: M },
    { id: "torera", label: "Torera o bolero", only: M },
    OTHER,
  ],
  accessory: [
    { id: "gorra", label: "Gorra", look: "gorro" },
    { id: "gorro", label: "Gorro de lana", look: "gorro" },
    { id: "sombrero", label: "Sombrero o piluso", look: "gorro" },
    { id: "bufanda", label: "Bufanda o cuello", look: "bufanda" },
    { id: "guantes", label: "Guantes" },
    { id: "cinturon", label: "Cinturón" },
    { id: "anteojos-sol", label: "Anteojos de sol" },
    { id: "reloj", label: "Reloj" },
    { id: "mochila", label: "Mochila" },
    { id: "rinonera", label: "Riñonera" },
    { id: "billetera", label: "Billetera" },
    { id: "collar", label: "Cadena o collar" },
    { id: "pulsera", label: "Pulsera" },
    { id: "anillo", label: "Anillo" },
    { id: "aros", label: "Aros" },
    { id: "corbata", label: "Corbata", only: H },
    { id: "mono", label: "Moño (corbata)", only: H },
    { id: "tiradores", label: "Tiradores", only: H },
    { id: "gemelos", label: "Gemelos", only: H },
    { id: "cartera", label: "Morral", labelM: "Cartera" },
    { id: "bolso", label: "Bolso o tote", only: M },
    { id: "sobre", label: "Sobre o clutch", only: M },
    { id: "panuelo", label: "Pañuelo", only: M, look: "bufanda" },
    { id: "vincha", label: "Vincha", only: M },
    { id: "accesorio-pelo", label: "Hebilla, colita o scrunchie", only: M },
    OTHER,
  ],
  pijama: [
    { id: "remera", label: "Remera", slot: "top", look: "corta", group: "Parte de arriba" },
    { id: "remera-manga-larga", label: "Remera manga larga", slot: "top", look: "larga", group: "Parte de arriba" },
    { id: "musculosa-pijama", label: "Musculosa", slot: "top", look: "corta", group: "Parte de arriba" },
    { id: "camisa-pijama", label: "Camisa de pijama", slot: "top", look: "larga", group: "Parte de arriba" },
    { id: "top-pijama", label: "Top", only: M, slot: "top", look: "corta", group: "Parte de arriba" },
    { id: "short", label: "Short", slot: "bottom", look: "corta", group: "Parte de abajo" },
    { id: "pantalon", label: "Pantalón", slot: "bottom", group: "Parte de abajo" },
    { id: "bermuda-pijama", label: "Bermuda", only: H, slot: "bottom", look: "corta", group: "Parte de abajo" },
    { id: "calza-pijama", label: "Calza", only: M, slot: "bottom", group: "Parte de abajo" },
    { id: "enterito-pijama", label: "Enterito o mameluco", slot: "top", look: "larga", group: "Enterito" },
    { id: "camison", label: "Camisón", only: M, slot: "top", look: "corta", group: "Enterito" },
    { id: "babydoll", label: "Babydoll", only: M, slot: "top", look: "corta", group: "Enterito" },
    { id: "buzo", label: "Buzo", slot: "outerwear", group: "Para abrigarse" },
    { id: "bata", label: "Bata", slot: "outerwear", group: "Para abrigarse" },
    { id: "kimono-pijama", label: "Kimono", only: M, slot: "outerwear", group: "Para abrigarse" },
    ...UNDERWEAR,
    { id: "pantuflas", label: "Pantuflas", slot: null, group: "Calzado" },
    { id: "ojotas-pijama", label: "Ojotas de casa", slot: null, group: "Calzado" },
    { id: "accesorio", label: "Antifaz", slot: "accessory", group: "Accesorios" },
    { id: "gorro-dormir", label: "Gorro para dormir", slot: "accessory", group: "Accesorios" },
    { id: "accesorio-otro", label: "Otro accesorio", slot: "accessory", group: "Accesorios" },
    { ...OTHER, group: "Otra cosa" },
  ],
  interior: [...UNDERWEAR, OTHER],
  malla: [
    { id: "malla-abajo", label: "Short de baño", labelM: "Bikini (abajo)", slot: "bottom", look: "corta" },
    { id: "sunga", label: "Sunga", only: H, slot: "bottom", look: "corta" },
    { id: "bikini-arriba", label: "Bikini (arriba)", only: M, slot: "top", look: "corta" },
    { id: "enteriza", label: "Malla enteriza", only: M, slot: "top", look: "corta" },
    { id: "trikini", label: "Trikini", only: M, slot: "top", look: "corta" },
    { id: "pareo", label: "Pareo o salida de baño", only: M, slot: "outerwear" },
    { id: "remera-uv", label: "Remera de agua (UV)", slot: "top", look: "corta" },
    OTHER,
  ],
};

/** Tipos para mostrar según el género (sin género o "otro": todos). */
export function kindsFor(category: Category, gender: string | null | undefined): KindDef[] {
  return KINDS[category]
    .filter((k) => !k.only || (!isH(gender) && !isM(gender)) || k.only === gender)
    .map((k) => ({ ...k, label: kindLabelFor(k, gender) }));
}

/** Nombre según el género: "Calzoncillo" (hombre), "Bombacha" (mujer), "Calzoncillo / Bombacha" (otro). */
/** Agrupa los tipos por sección (si tienen), manteniendo el orden. */
export function groupKinds(kinds: KindDef[]): { group: string | null; kinds: KindDef[] }[] {
  const out: { group: string | null; kinds: KindDef[] }[] = [];
  for (const k of kinds) {
    const g = k.group ?? null;
    const last = out.find((x) => x.group === g);
    if (last) last.kinds.push(k);
    else out.push({ group: g, kinds: [k] });
  }
  return out;
}

export function kindLabelFor(k: KindDef, gender: string | null | undefined): string {
  if (!k.labelM) return k.label;
  if (isH(gender)) return k.label;
  if (isM(gender)) return k.labelM;
  return `${k.label} / ${k.labelM}`;
}

export const kindById = (category: Category, id: string | undefined) => KINDS[category].find((k) => k.id === id);

/** Categorías que se ven según el género (los vestidos no aparecen para hombre). */
export function categoriesFor(gender: string | null | undefined) {
  return CATEGORIES.filter((c) => !isH(gender) || c.id !== "dress").map((c) => categoryView(c.id, gender));
}

export interface ColorDef {
  id: string;
  label: string;
  hex: string;
  /** Los neutros combinan con casi todo. */
  neutral: boolean;
  temp: Temp;
  /** Tono en grados (0-360) para medir armonía. Solo importa en colores no neutros. */
  hue: number;
}

export const COLORS: ColorDef[] = [
  { id: "negro", label: "Negro", hex: "#1c1c1c", neutral: true, temp: "neutral", hue: 0 },
  { id: "blanco", label: "Blanco", hex: "#f7f7f5", neutral: true, temp: "cool", hue: 0 },
  { id: "gris", label: "Gris", hex: "#8f9196", neutral: true, temp: "cool", hue: 0 },
  { id: "crema", label: "Crema", hex: "#efe6d2", neutral: true, temp: "warm", hue: 45 },
  { id: "beige", label: "Beige", hex: "#d6c3a0", neutral: true, temp: "warm", hue: 40 },
  { id: "marron", label: "Marrón", hex: "#6f4a2f", neutral: true, temp: "warm", hue: 25 },
  { id: "azul-marino", label: "Azul marino", hex: "#1f2b4a", neutral: true, temp: "cool", hue: 225 },
  { id: "denim", label: "Jean / denim", hex: "#4a6a95", neutral: true, temp: "cool", hue: 215 },
  { id: "celeste", label: "Celeste", hex: "#9cc3e6", neutral: false, temp: "cool", hue: 205 },
  { id: "azul", label: "Azul", hex: "#2f5fb3", neutral: false, temp: "cool", hue: 220 },
  { id: "verde-oliva", label: "Verde oliva", hex: "#6b6b3a", neutral: false, temp: "warm", hue: 60 },
  { id: "verde", label: "Verde", hex: "#2f8a57", neutral: false, temp: "cool", hue: 145 },
  { id: "bordo", label: "Bordó", hex: "#6e1f2e", neutral: false, temp: "neutral", hue: 345 },
  { id: "rojo", label: "Rojo", hex: "#c8312f", neutral: false, temp: "warm", hue: 2 },
  { id: "rosa", label: "Rosa", hex: "#e7a1b6", neutral: false, temp: "cool", hue: 340 },
  { id: "naranja", label: "Naranja", hex: "#e2793a", neutral: false, temp: "warm", hue: 25 },
  { id: "mostaza", label: "Mostaza", hex: "#c99a2e", neutral: false, temp: "warm", hue: 42 },
  { id: "amarillo", label: "Amarillo", hex: "#f0d24a", neutral: false, temp: "warm", hue: 52 },
  { id: "violeta", label: "Violeta", hex: "#6c4a9e", neutral: false, temp: "cool", hue: 270 },
];

export const colorById = (id: string): ColorDef =>
  COLORS.find((c) => c.id === id) ?? COLORS[0];

export type StyleId =
  | "casual"
  | "clasico"
  | "elegante"
  | "urbano"
  | "deportivo"
  | "minimalista"
  | "bohemio"
  | "rockero";

export const STYLES: { id: StyleId; label: string; hint: string }[] = [
  { id: "casual", label: "Casual", hint: "Cómodo y simple, para todos los días" },
  { id: "clasico", label: "Clásico", hint: "Camisas, sacos, prendas que no pasan de moda" },
  { id: "elegante", label: "Elegante", hint: "Arreglado, para eventos y noches" },
  { id: "urbano", label: "Urbano", hint: "Zapatillas, buzos, onda calle" },
  { id: "deportivo", label: "Deportivo", hint: "Ropa de entrenar o con estética deportiva" },
  { id: "minimalista", label: "Minimalista", hint: "Pocos colores, líneas limpias" },
  { id: "bohemio", label: "Bohemio", hint: "Relajado, texturas y estampados" },
  { id: "rockero", label: "Rockero", hint: "Negro, cuero, actitud" },
];

export const WARMTH: { id: Warmth; label: string }[] = [
  { id: "light", label: "Liviana (calor)" },
  { id: "medium", label: "Media" },
  { id: "warm", label: "Abrigada (frío)" },
];

export const FORMALITY_LABELS = ["", "Muy informal", "Informal", "Intermedio", "Arreglado", "Formal"];

export type OccasionId =
  | "casual"
  | "trabajo"
  | "cita"
  | "noche"
  | "formal"
  | "familia"
  | "deporte";

export interface Occasion {
  id: OccasionId;
  label: string;
  emoji: string;
  /** Rango de formalidad ideal (1 a 5). */
  formality: [number, number];
  styles: StyleId[];
}

export const OCCASIONS: Occasion[] = [
  { id: "casual", label: "Día casual", emoji: "☀️", formality: [1, 3], styles: ["casual", "urbano", "minimalista"] },
  { id: "trabajo", label: "Trabajo / facu", emoji: "💼", formality: [3, 4], styles: ["clasico", "minimalista", "elegante"] },
  { id: "cita", label: "Cita", emoji: "❤️", formality: [2, 4], styles: ["elegante", "minimalista", "clasico", "casual"] },
  { id: "noche", label: "Salir de noche", emoji: "🌙", formality: [2, 4], styles: ["urbano", "rockero", "elegante"] },
  { id: "formal", label: "Evento formal", emoji: "🥂", formality: [4, 5], styles: ["elegante", "clasico"] },
  { id: "familia", label: "Reunión familiar", emoji: "🏡", formality: [2, 3], styles: ["casual", "clasico", "minimalista"] },
  { id: "deporte", label: "Deporte", emoji: "🏃", formality: [1, 1], styles: ["deportivo"] },
];

export const WEATHERS: { id: Weather; label: string; emoji: string }[] = [
  { id: "frio", label: "Frío", emoji: "🥶" },
  { id: "templado", label: "Templado", emoji: "🌤️" },
  { id: "calor", label: "Calor", emoji: "🥵" },
];

// ---------- Perfil ----------

export type Undertone = "calido" | "frio" | "neutro";
export type BodyType = "rectangulo" | "triangulo" | "triangulo-invertido" | "ovalo" | "reloj";

export const UNDERTONES: { id: Undertone; label: string; hint: string }[] = [
  {
    id: "calido",
    label: "Cálido",
    hint: "Las venas de la muñeca se ven verdosas, te queda mejor el dorado y te bronceás fácil.",
  },
  {
    id: "frio",
    label: "Frío",
    hint: "Las venas se ven azuladas o violetas, te queda mejor el plateado y te quemás fácil.",
  },
  {
    id: "neutro",
    label: "Neutro",
    hint: "No está claro: ves venas verdes y azules, y te quedan bien el dorado y el plateado.",
  },
];

export const SKIN_DEPTHS = [
  { id: "clara", label: "Clara" },
  { id: "media", label: "Media" },
  { id: "oscura", label: "Oscura" },
] as const;
export type SkinDepth = (typeof SKIN_DEPTHS)[number]["id"];

export const BODY_TYPES: { id: BodyType; label: string; hint: string; tip: string }[] = [
  {
    id: "rectangulo",
    label: "Recto",
    hint: "Hombros, cintura y cadera de ancho parecido.",
    tip: "Las capas (camisa abierta, campera) y los contrastes entre arriba y abajo le dan forma a tu silueta.",
  },
  {
    id: "triangulo",
    label: "Más ancho abajo",
    hint: "La cadera es más ancha que los hombros.",
    tip: "Los colores claros o con detalle arriba y los oscuros abajo equilibran tu silueta.",
  },
  {
    id: "triangulo-invertido",
    label: "Más ancho arriba",
    hint: "Hombros o espalda más anchos que la cadera.",
    tip: "Arriba te favorece lo simple y oscuro, y abajo podés sumar color o un corte más recto.",
  },
  {
    id: "ovalo",
    label: "Más volumen en el centro",
    hint: "Más volumen en la panza que en hombros y cadera.",
    tip: "Los tonos parecidos de pies a cabeza y las prendas que caen rectas (sin ajustar) alargan la figura.",
  },
  {
    id: "reloj",
    label: "Cintura marcada",
    hint: "Hombros y cadera parecidos, con la cintura más angosta.",
    tip: "Lo que marca la cintura (remera por dentro, cinturón) resalta tu silueta.",
  },
];

/** Colores que más favorecen según el subtono de piel. */
export const PALETTE_BY_UNDERTONE: Record<Undertone, string[]> = {
  calido: ["crema", "beige", "marron", "verde-oliva", "mostaza", "naranja", "rojo", "bordo", "amarillo"],
  frio: ["blanco", "gris", "azul-marino", "celeste", "azul", "rosa", "violeta", "bordo", "verde", "negro"],
  neutro: ["blanco", "gris", "azul-marino", "beige", "verde", "bordo", "rosa", "celeste", "verde-oliva", "negro"],
};

/** Deportes para marcar ropa deportiva. "general" = sirve para cualquier deporte o entrenar. */
export const SPORTS: { id: string; label: string; emoji: string; re?: RegExp }[] = [
  { id: "general", label: "Cualquier deporte", emoji: "🏃" },
  { id: "futbol", label: "Fútbol", emoji: "⚽", re: /f[uú]tbol|futbol|partido|f5|f7|fulbito|picado/i },
  { id: "running", label: "Running", emoji: "👟", re: /correr|running|run\b|trote|marat[oó]n/i },
  { id: "gimnasio", label: "Gimnasio", emoji: "🏋️", re: /gym|gimnasio|pesas|crossfit|funcional|entren/i },
  { id: "padel-tenis", label: "Pádel / tenis", emoji: "🎾", re: /p[aá]del|padel|tenis/i },
  { id: "basquet", label: "Básquet", emoji: "🏀", re: /b[aá]squet|basket/i },
  { id: "rugby", label: "Rugby", emoji: "🏉", re: /rugby/i },
  { id: "hockey", label: "Hockey", emoji: "🏑", re: /hockey/i },
  { id: "natacion", label: "Natación", emoji: "🏊", re: /nataci|pileta|nadar/i },
  { id: "ciclismo", label: "Ciclismo", emoji: "🚴", re: /bici|ciclismo|spinning/i },
  { id: "yoga", label: "Yoga / pilates", emoji: "🧘", re: /yoga|pilates/i },
  { id: "otro", label: "Otro", emoji: "🥇" },
];

export const sportById = (id: string | undefined) => SPORTS.find((s) => s.id === id);

/** Qué deporte es un evento por su nombre (ej: "Fútbol con los pibes" → futbol). */
export function sportFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return SPORTS.find((s) => s.re?.test(text))?.id;
}

/** Talles de calzado en US (el número que figura como "US" en la etiqueta). */
export function shoeSizesUS(gender: string | null | undefined): string[] {
  const [from, to] = gender === "mujer" ? [5, 11] : gender === "hombre" ? [6, 13] : [5, 13];
  const out: string[] = [];
  for (let n = from; n <= to; n += 0.5) out.push(String(n));
  return out;
}

// Equivalencias europeas → US (hombre y mujer tienen escalas US distintas).
const EU_TO_US_H: [number, number][] = [
  [38, 6], [39, 6.5], [40, 7], [41, 8], [42, 8.5], [43, 9.5], [44, 10], [45, 11], [46, 12], [47, 12.5], [48, 13.5],
];
const EU_TO_US_M: [number, number][] = [
  [35, 5], [36, 5.5], [37, 6.5], [38, 7.5], [39, 8], [40, 9], [41, 9.5], [42, 10.5], [43, 11],
];

/**
 * Pasa un talle europeo o argentino a US. El argentino es más o menos uno menos que el europeo
 * (un 41 argentino es un 42 europeo). Sin género se usa la escala de hombre (la "unisex" de US).
 */
export function toUSShoe(n: number, from: "eu" | "ar", gender: string | null | undefined): string | null {
  const eu = from === "ar" ? n + 1 : n;
  const table = gender === "mujer" ? EU_TO_US_M : EU_TO_US_H;
  if (eu < table[0][0] - 1 || eu > table[table.length - 1][0] + 1) return null;
  let us: number;
  if (eu <= table[0][0]) us = table[0][1] - (table[0][0] - eu);
  else if (eu >= table[table.length - 1][0]) us = table[table.length - 1][1] + (eu - table[table.length - 1][0]);
  else {
    const i = table.findIndex(([e]) => e >= eu);
    const [e0, u0] = table[i - 1];
    const [e1, u1] = table[i];
    us = u0 + ((u1 - u0) * (eu - e0)) / (e1 - e0);
  }
  return String(Math.round(us * 2) / 2);
}

/**
 * Prendas que se suelen tener repetidas iguales (no tiene sentido subir 7 fotos del mismo calzoncillo):
 * para estas se pregunta la cantidad.
 */
const COUNTABLE_KINDS = new Set([
  "calzon",
  "boxer",
  "tanga",
  "corpino",
  "corpino-deportivo",
  "top-interior",
  "body-interior",
  "camiseta",
  "medias",
  "soquetes",
  "medias-cancan",
  "malla-abajo",
  "sunga",
  "bikini-arriba",
  "bikini-abajo",
]);

export const isCountable = (category: Category, kind: string | undefined) =>
  Boolean(kind && (category === "interior" || category === "pijama" || category === "malla") && COUNTABLE_KINDS.has(kind));

/** Las medias se cuentan de a pares. */
export const countUnit = (kind: string | undefined, n: number) => {
  const pair = kind === "medias" || kind === "soquetes" || kind === "medias-cancan";
  return pair ? (n === 1 ? "par" : "pares") : n === 1 ? "igual" : "iguales";
};

/** Nombre automático: "Remera azul". Si el color ya está en el tipo ("Jean" + "jean / denim"), no se repite. */
export function autoName(kind: string, colorId: string): string {
  const color = (COLORS.find((c) => c.id === colorId)?.label ?? "").toLowerCase();
  const first = kind.toLowerCase().split(" ")[0];
  if (!color || color.includes(first)) return kind;
  return `${kind} ${color.split(" / ")[0]}`;
}
