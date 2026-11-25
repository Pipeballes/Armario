import type {
  BodyType,
  OccasionId,
  Category,
  Pattern,
  SkinDepth,
  StyleId,
  Undertone,
  Warmth,
} from "./catalog";

export interface Garment {
  id: string;
  /** Foto de adelante (data URL o link firmado). */
  photo: string;
  /** Foto de atrás. */
  photoBack?: string;
  /** Foto de la etiqueta (de ahí la IA lee el talle). */
  photoLabel?: string;
  /** Talle (ej: "M", "42", "Único"). */
  size?: string;
  /** Cuántas iguales hay (medias, ropa interior, mallas). Si falta, es 1. */
  quantity?: number;
  /** Si es deportiva: id de SPORTS ("general" = para cualquier deporte). */
  sport?: string;
  /** Tipo dentro de pijama / ropa interior / malla (id de KINDS). */
  kind?: string;
  /** Si el tipo es "otro": qué es (escrito). */
  kindDetail?: string;
  /** Cómo está la prenda en cada foto, para vestir bien el avatar (lo calcula la IA). */
  fit?: { front?: GarmentFit; back?: GarmentFit };
  name: string;
  category: Category;
  color: string;
  pattern: Pattern;
  styles: StyleId[];
  /** 1 = muy informal, 5 = formal. */
  formality: number;
  warmth: Warmth;
  createdAt: number;
  /** Última vez que se usó (marcado con "Me lo pongo"). */
  lastWorn?: number;
}

export type Gender = "hombre" | "mujer" | "otro";

export interface Profile {
  name: string;
  /** Cómo se identifica la persona (adapta avatar, prendas sugeridas y consejos). */
  gender?: Gender | null;
  undertone: Undertone | null;
  skinDepth: SkinDepth | null;
  bodyType: BodyType | null;
  /** Altura en centímetros (opcional). */
  height: number | null;
  styles: StyleId[];
  /** Fotos de looks que te inspiran (data URLs). */
  inspiration: string[];
  /** Consejo que dio la IA al analizar una foto. */
  aiAdvice?: string;
  /** Fotos tuyas para el análisis de la IA (en la nube: rutas privadas). */
  selfies?: string[];
  /** (Viejo) un solo link de calendario. Se lee como el primero de `calendars`. */
  calendarUrl?: string;
  /** Calendarios compartidos (iCloud o Google), cada uno con su nombre y color. */
  calendars?: CalendarLink[];
  /** Cómo se ve el avatar del probador. */
  avatar?: AvatarStyle;
  /** Días del planificador fijados a mano: fecha "YYYY-MM-DD" → ids de prendas. */
  weekPlan?: Record<string, string[]>;
  /** Outfits que marcaste con 👍 / 👎 (claves de ids ordenados). */
  feedback?: { liked: string[]; disliked: string[] };
  /** Tu talle de siempre (arriba y abajo), para ver en el probador si una prenda te queda grande o chica. */
  sizes?: { top?: string; bottom?: string };
}

/** Dónde está la prenda en la foto, cuánto está girada y de qué color es la tela. */
/** Dibujo que se repite en toda la tela (no un estampado suelto ni un logo). */
export type PatternKind = "rayas" | "rayas-verticales" | "cuadros" | "lunares" | "flores" | "camuflado";

/**
 * Detalles de la prenda que la IA ve en la foto, para dibujarla como es. Todos son opcionales:
 * lo que falte se completa según el tipo de prenda (una camisa siempre lleva botones, aunque no se vean).
 */
export interface GarmentDetails {
  /** Color de lo que contrasta con la tela: cuello, puños, elástico, franjas, tiras, cordones. */
  trim?: string;
  pattern?: PatternKind;
  /** Segundo color del dibujo de la tela. */
  patternColor?: string;
  /** Botones que se ven al frente. */
  buttons?: number;
  hood?: boolean;
  /** Cordón en la cintura o en la capucha. */
  drawstring?: boolean;
  /** Cintura elastizada (jogging, short deportivo, calza). */
  elastic?: boolean;
  /** Franjas a los costados, de arriba abajo. */
  sideStripes?: boolean;
  pockets?: "pecho" | "canguro" | "jean" | "cargo" | "parche";
  /** Largo de la pierna (partes de abajo). */
  legLength?: "micro" | "muslo" | "rodilla" | "largo";
  /** Largo de las mangas (partes de arriba y abrigos). */
  sleeves?: "sin" | "cortas" | "largas";
  /** Tira del calzado abierto: entre los dedos (ojota), una ancha (chancla) o varias (sandalia). */
  strap?: "dedo" | "ancha" | "tiras";
  /** Qué tan ancha es (la pierna de un short o un pantalón, el cuerpo de una remera). */
  width?: "ajustado" | "regular" | "holgado" | "muy-holgado";
  /** Cómo termina la pierna o el ruedo: simple, doblado, deshilachado, con elástico o con tajo al costado. */
  hem?: "simple" | "doblado" | "deshilachado" | "elastico" | "tajo";
}

export interface GarmentFit {
  /** Versión del cálculo (si cambia, se vuelve a pedir a la IA). */
  v?: number;
  /** Grados que está girada (positivo = en sentido horario). */
  angle: number;
  /** Caja de la prenda entera en la foto: [x0, y0, x1, y1] de 0 a 1. */
  box: [number, number, number, number];
  /** Color principal de la tela (#rrggbb). */
  fabric: string;
  /** Estampado o logo principal, para dibujarlo como calcomanía sobre la prenda digital. */
  print?: {
    /** Caja del estampado en la foto: [x0, y0, x1, y1] de 0 a 1. */
    box: [number, number, number, number];
    /** Dónde va sobre el cuerpo: x de -1 (borde izquierdo, mirando la foto) a 1; y de 0 (cuello) a 1 (ruedo). */
    x: number;
    y: number;
    /** Ancho del estampado comparado con el ancho del cuerpo (0 a 1). */
    width: number;
  };
  details?: GarmentDetails;
}

/** Versión actual del ajuste de fotos. */
export const FIT_VERSION = 4;

export type HairId =
  | "corto"
  | "costado"
  | "flequillo"
  | "despeinado"
  | "rapado"
  | "pelado"
  | "cresta"
  | "rulos"
  | "afro"
  | "ondas"
  | "melena"
  | "largo"
  | "colita"
  | "rodete"
  | "recogido"
  | "trenzas"
  | "rastas";

export type GlassesId =
  | "ninguno"
  | "redondos"
  | "cuadrados"
  | "rectangulares"
  | "gruesos"
  | "aviador"
  | "gatubelos"
  | "sol"
  | "sol-aviador"
  | "sol-redondos"
  | "sol-gatubelos"
  | "sol-grandes"
  | "sol-deportivos"
  | "sol-espejados";

export interface AvatarStyle {
  hair: HairId;
  hairColor: string;
  beard: boolean;
  glasses?: GlassesId;
  /** Color del armazón de los anteojos (si no, el de cada modelo). */
  glassesColor?: string;
  expression?: "sonrisa" | "feliz" | "serio" | "guino";
}

export interface CalendarLink {
  id: string;
  name: string;
  /** Color en formato #rrggbb (el del calendario del iPhone, o el que elijas). */
  color: string;
  url: string;
  /** Ocasión para los eventos que no dicen qué son (ej: todo lo de "Trabajo" es facu). */
  defaultOccasion?: OccasionId;
}

/** Todos los calendarios del perfil, incluido el link viejo si había uno solo. */
export function calendarsOf(p: Profile): CalendarLink[] {
  const list = p.calendars ?? [];
  if (p.calendarUrl && !list.some((c) => c.url === p.calendarUrl)) {
    return [{ id: "principal", name: "Mi calendario", color: "#b5532f", url: p.calendarUrl }, ...list];
  }
  return list;
}

export const EMPTY_PROFILE: Profile = {
  name: "",
  undertone: null,
  skinDepth: null,
  bodyType: null,
  height: null,
  styles: [],
  inspiration: [],
};
