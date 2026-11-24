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
}

export interface AvatarStyle {
  hair: "corto" | "largo" | "rapado" | "rulos" | "recogido" | "ondas" | "cresta";
  hairColor: string;
  beard: boolean;
  glasses?: "ninguno" | "redondos" | "cuadrados" | "sol";
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
