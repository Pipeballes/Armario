// Catálogo de opciones: categorías, colores, estilos, ocasiones y perfil.
// Todo el texto visible está en español porque la app es en español.

export type Category = "top" | "bottom" | "dress" | "shoes" | "outerwear" | "accessory";
export type Warmth = "light" | "medium" | "warm";
export type Pattern = "liso" | "estampado";
export type Temp = "warm" | "cool" | "neutral";
export type Weather = "frio" | "templado" | "calor";

export const CATEGORIES: { id: Category; label: string; plural: string; emoji: string }[] = [
  { id: "top", label: "Parte de arriba", plural: "Partes de arriba", emoji: "👕" },
  { id: "bottom", label: "Parte de abajo", plural: "Partes de abajo", emoji: "👖" },
  { id: "dress", label: "Vestido / enterito", plural: "Vestidos y enteritos", emoji: "👗" },
  { id: "shoes", label: "Calzado", plural: "Calzado", emoji: "👟" },
  { id: "outerwear", label: "Abrigo", plural: "Abrigos", emoji: "🧥" },
  { id: "accessory", label: "Accesorio", plural: "Accesorios", emoji: "🧢" },
];

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
  { id: "trabajo", label: "Trabajo / oficina", emoji: "💼", formality: [3, 4], styles: ["clasico", "minimalista", "elegante"] },
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
