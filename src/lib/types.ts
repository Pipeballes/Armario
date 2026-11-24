import type {
  BodyType,
  Category,
  Pattern,
  SkinDepth,
  StyleId,
  Undertone,
  Warmth,
} from "./catalog";

export interface Garment {
  id: string;
  /** Foto achicada guardada como data URL (JPEG). */
  photo: string;
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

export interface Profile {
  name: string;
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
