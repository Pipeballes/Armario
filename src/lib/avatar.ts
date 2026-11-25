// Datos del avatar 3D: proporciones del cuerpo según el perfil, color de piel y qué prenda va en cada lugar.

import { SPECIAL_CATEGORIES, colorById, kindById, type BodyType } from "./catalog";
import type { AvatarStyle, Garment, GarmentFit, Profile } from "./types";

export interface BodyDims {
  /** Forma general del cuerpo según el género elegido. */
  feminine: boolean;
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
  reloj: [0.2, 0.14, 0.2],
};

export function bodyDims(p: Profile): BodyDims {
  const heightM = p.height && p.height >= 120 && p.height <= 220 ? p.height / 100 : p.gender === "mujer" ? 1.64 : 1.72;
  const [shoulder, waist, hip] = SHAPES[p.bodyType ?? "default"];
  const feminine = p.gender === "mujer";
  // Silueta femenina: hombros un poco más angostos, cintura marcada y cadera más ancha.
  return feminine
    ? { feminine, scale: heightM / 1.72, heightM, shoulder: shoulder * 0.91, waist: waist * 0.93, hip: hip * 1.04 }
    : { feminine, scale: heightM / 1.72, heightM, shoulder, waist, hip };
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
export function slotOf(g: Garment): Slot | null {
  if (g.category === "dress") return "top";
  // Pijama, ropa interior y malla: según el tipo (remera arriba, short abajo, medias en ningún lado).
  if (SPECIAL_CATEGORIES.includes(g.category)) return kindById(g.category, g.kind)?.slot ?? null;
  return g.category as Slot;
}

export type Selection = Partial<Record<Slot, string>>;

/** Arma la selección a partir de una lista de prendas (ej: un outfit sugerido). */
export function selectionFrom(items: Garment[]): Selection {
  const sel: Selection = {};
  for (const g of items) {
    const slot = slotOf(g);
    if (slot) sel[slot] = g.id;
  }
  return sel;
}

/** Cómo dibujar cada prenda en el avatar. */
export interface TopLook {
  color: string;
  striped: boolean;
  sleeves: "none" | "short" | "long";
  /** Cuello: redondo, camisero, alto (polera), con capucha, o tiras (musculosa, corpiño). */
  neck: "round" | "collar" | "turtle" | "hood" | "straps";
  /** Largo del torso: normal, corto (crop), corpiño o malla enteriza. */
  cut: "normal" | "crop" | "bra" | "swimsuit";
  /** Botones al frente (camisa: muchos; chomba: dos). */
  buttons: 0 | 2 | 5;
  /** Bolsillo canguro (buzo con capucha). */
  pocket: boolean;
  /** Puños y cintura elastizados (buzos, sweaters). */
  ribbed: boolean;
  /** Vestido: largo de la pollera. */
  dress: "none" | "short" | "midi" | "long";
  /** La prenda real: fotos y el ajuste de la IA, para dibujar el estampado como calcomanía. */
  print?: { front: string; back?: string; fitFront?: GarmentFit; fitBack?: GarmentFit };
}

export interface BottomLook {
  color: string;
  striped: boolean;
  kind: "pants" | "shorts" | "bermuda" | "skirt" | "brief";
  /** Pollera: corta, midi o larga. */
  length: "mini" | "midi" | "long";
  /** Botamanga con puño (jogging, babucha). */
  cuffs: boolean;
  /** Pierna ancha (palazzo, oxford). */
  wide: boolean;
  /** Pegado al cuerpo (calza). */
  tight: boolean;
}

export interface ShoesLook {
  color: string;
  kind: "sneaker" | "boot" | "tallboot" | "formal" | "sandal" | "heel" | "slipper";
}

export interface OuterLook {
  color: string;
  striped: boolean;
  kind: "jacket" | "blazer" | "coat" | "vest" | "puffer";
  hood: boolean;
}

export interface AccessoryLook {
  color: string;
  kind: "cap" | "beanie" | "hat" | "scarf" | "other";
}

export interface Look {
  top: TopLook | null;
  bottom: BottomLook | null;
  shoes: ShoesLook | null;
  outerwear: OuterLook | null;
  accessory: AccessoryLook | null;
}

/** Si no elegiste nada, el avatar lleva una remera y un short básicos. */
export const DEFAULT_TOP: TopLook = {
  color: "#d6d0c6",
  striped: false,
  sleeves: "short",
  neck: "round",
  cut: "normal",
  buttons: 0,
  pocket: false,
  ribbed: false,
  dress: "none",
};
export const DEFAULT_BOTTOM: BottomLook = {
  color: "#8f8a82",
  striped: false,
  kind: "shorts",
  length: "mini",
  cuffs: false,
  wide: false,
  tight: false,
};

/** Lo que el avatar tiene puesto arriba y abajo (con un vestido no lleva nada abajo). */
export function wornTop(look: Look): TopLook {
  return look.top ?? DEFAULT_TOP;
}
export function wornBottom(look: Look): BottomLook | null {
  return look.bottom ?? (look.top && look.top.dress !== "none" ? null : DEFAULT_BOTTOM);
}

const hex = (g: Garment) => colorById(g.color).hex;

const NO_SLEEVES = new Set(["musculosa", "top", "crop-top", "body", "corset", "musculosa-pijama", "top-pijama", "solero", "camison", "babydoll", "corpino", "corpino-deportivo", "top-interior", "bikini-arriba", "enteriza", "trikini", "body-interior", "chaleco-tejido"]);
const LONG_SLEEVES = new Set(["remera-manga-larga", "camisa", "buzo", "hoodie", "sweater", "polera", "cardigan", "blusa", "tunica", "vestido-largo", "enterito", "enterito-pijama", "camisa-pijama", "remera-uv"]);
const COLLAR = new Set(["camisa", "camisa-manga-corta", "chomba", "camisa-pijama"]);
const BUTTONS: Record<string, 0 | 2 | 5> = { camisa: 5, "camisa-manga-corta": 5, "camisa-pijama": 5, cardigan: 5, chomba: 2 };
const RIBBED = new Set(["buzo", "hoodie", "sweater", "cardigan", "polera"]);

function topLook(g: Garment): TopLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const look = kindById(g.category, g.kind)?.look;
  const sleeves: TopLook["sleeves"] = NO_SLEEVES.has(k)
    ? "none"
    : LONG_SLEEVES.has(k) || look === "larga"
      ? "long"
      : look === "corta" || g.warmth === "light" || /musculosa|remera|top\b/.test(name)
        ? "short"
        : k
          ? "short"
          : "long";
  const cut: TopLook["cut"] =
    k === "crop-top" || k === "top" || k === "top-pijama"
      ? "crop"
      : ["corpino", "corpino-deportivo", "top-interior", "bikini-arriba"].includes(k)
        ? "bra"
        : ["enteriza", "trikini", "body", "body-interior"].includes(k)
          ? "swimsuit"
          : "normal";
  const dress: TopLook["dress"] =
    g.category !== "dress" || k === "enterito" || k === "jardinero"
      ? ["camison", "babydoll"].includes(k)
        ? "short"
        : "none"
      : k === "vestido-midi"
        ? "midi"
        : k === "vestido-largo" || k === "vestido-fiesta" || (!k && (g.formality >= 5 || /largo/.test(name)))
          ? "long"
          : "short";
  return {
    color: hex(g),
    striped: g.pattern === "estampado" && !g.photo,
    sleeves,
    neck: COLLAR.has(k) ? "collar" : k === "polera" ? "turtle" : k === "hoodie" ? "hood" : sleeves === "none" ? "straps" : "round",
    cut,
    buttons: BUTTONS[k] ?? 0,
    pocket: k === "hoodie",
    ribbed: RIBBED.has(k),
    dress,
    // Con foto se dibuja la prenda real (color de la tela y estampado); sin foto, color liso o rayas.
    print:
      g.photo && g.category !== "dress"
        ? { front: g.photo, back: g.photoBack, fitFront: g.fit?.front, fitBack: g.fit?.back }
        : undefined,
  };
}

function bottomLook(g: Garment): BottomLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const look = kindById(g.category, g.kind)?.look;
  const brief = ["calzon", "boxer", "tanga", "bikini-abajo", "sunga"].includes(k);
  const kind: BottomLook["kind"] = brief
    ? "brief"
    : look === "pollera" || /pollera|falda/.test(name)
      ? "skirt"
      : k === "bermuda" || k === "bermuda-pijama" || (!k && /bermuda/.test(name))
        ? "bermuda"
        : look === "corta" || /short/.test(name)
          ? "shorts"
          : "pants";
  return {
    color: hex(g),
    striped: g.pattern === "estampado",
    kind,
    length: k === "pollera-larga" ? "long" : k === "pollera-midi" ? "midi" : "mini",
    cuffs: k === "jogging" || k === "babucha",
    wide: k === "palazzo" || k === "oxford" || k === "babucha" || k === "pantalon-lino",
    tight: k === "calza" || k === "calza-pijama" || k === "calza-corta",
  };
}

function shoesLook(g: Garment): ShoesLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const kind: ShoesLook["kind"] =
    k === "botas-altas"
      ? "tallboot"
      : k === "borcegos" || k === "botas" || (!k && /bota|borceg/.test(name))
        ? "boot"
        : ["tacos", "sandalias-taco", "plataformas"].includes(k)
          ? "heel"
          : ["sandalias", "ojotas", "ojotas-pijama"].includes(k)
            ? "sandal"
            : k === "pantuflas"
              ? "slipper"
              : ["zapatos", "mocasines", "nauticos", "chatitas", "zuecos"].includes(k)
                ? "formal"
                : "sneaker";
  return { color: hex(g), kind };
}

function outerLook(g: Garment): OuterLook {
  const k = g.kind ?? "";
  const kind: OuterLook["kind"] =
    k === "saco" || k === "torera"
      ? "blazer"
      : ["tapado", "parka", "piloto", "poncho", "kimono", "capa", "bata", "pareo"].includes(k)
        ? "coat"
        : k === "chaleco"
          ? "vest"
          : k === "campera-inflable"
            ? "puffer"
            : "jacket";
  return { color: hex(g), striped: g.pattern === "estampado", kind, hood: k === "parka" || k === "rompevientos" };
}

function accessoryLook(g: Garment): AccessoryLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const kind: AccessoryLook["kind"] =
    k === "gorra" || (!k && /gorra/.test(name))
      ? "cap"
      : k === "gorro" || k === "gorro-dormir" || (!k && /gorro/.test(name))
        ? "beanie"
        : k === "sombrero" || (!k && /sombrero|piluso/.test(name))
          ? "hat"
          : k === "bufanda" || k === "panuelo" || (!k && /bufanda|pa[ñn]uelo/.test(name))
            ? "scarf"
            : "other";
  return { color: hex(g), kind };
}

export function lookFrom(sel: Selection, garments: Garment[]): Look {
  const get = (s: Slot) => garments.find((g) => g.id === sel[s]) ?? null;
  const top = get("top");
  const jumpsuit = top?.category === "dress" && (top.kind === "enterito" || top.kind === "jardinero");
  // El vestido tapa lo de abajo; el enterito es arriba y pantalón del mismo color.
  const bottom = jumpsuit ? top : top?.category === "dress" && !jumpsuit ? null : get("bottom");
  const shoes = get("shoes");
  const outer = get("outerwear");
  const acc = get("accessory");
  return {
    top: top ? topLook(top) : null,
    bottom: bottom ? (jumpsuit ? { ...bottomLook(bottom), kind: "pants" } : bottomLook(bottom)) : null,
    shoes: shoes ? shoesLook(shoes) : null,
    outerwear: outer ? outerLook(outer) : null,
    accessory: acc ? accessoryLook(acc) : null,
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

export const DEFAULT_AVATAR: AvatarStyle = {
  hair: "corto",
  hairColor: "#3b2a20",
  beard: false,
  glasses: "ninguno",
  expression: "sonrisa",
};

export const HAIRS: { id: AvatarStyle["hair"]; label: string }[] = [
  { id: "corto", label: "Corto con jopo" },
  { id: "costado", label: "Raya al costado" },
  { id: "flequillo", label: "Con flequillo" },
  { id: "despeinado", label: "Despeinado" },
  { id: "rapado", label: "Rapado" },
  { id: "pelado", label: "Pelado" },
  { id: "cresta", label: "Cresta" },
  { id: "rulos", label: "Rulos" },
  { id: "afro", label: "Afro" },
  { id: "ondas", label: "Ondas" },
  { id: "melena", label: "Melena (carré)" },
  { id: "largo", label: "Largo lacio" },
  { id: "colita", label: "Colita" },
  { id: "rodete", label: "Rodete arriba" },
  { id: "recogido", label: "Recogido atrás" },
  { id: "trenzas", label: "Trenzas" },
  { id: "rastas", label: "Rastas" },
];

/** Peinados con pelo atrás que se ve aunque tengas gorra. */
export const HAIR_WITH_BACK: AvatarStyle["hair"][] = ["largo", "recogido", "colita", "trenzas", "melena", "rastas", "ondas"];

export interface GlassesDef {
  id: NonNullable<AvatarStyle["glasses"]>;
  label: string;
  sun: boolean;
  shape: "round" | "square" | "rect" | "thick" | "aviator" | "cateye" | "oversize" | "sport";
  /** Color del armazón por defecto. */
  frame: string;
  /** Color del vidrio. */
  lens: string;
  /** Vidrio espejado (con reflejo de color). */
  mirror?: boolean;
}

export const GLASSES: GlassesDef[] = [
  { id: "ninguno", label: "Sin anteojos", sun: false, shape: "round", frame: "#222", lens: "#cfe8ff" },
  { id: "redondos", label: "Redondos", sun: false, shape: "round", frame: "#2b2b2b", lens: "#cfe8ff" },
  { id: "cuadrados", label: "Cuadrados", sun: false, shape: "square", frame: "#2b2b2b", lens: "#cfe8ff" },
  { id: "rectangulares", label: "Rectangulares finos", sun: false, shape: "rect", frame: "#6b6b6b", lens: "#cfe8ff" },
  { id: "gruesos", label: "Armazón grueso", sun: false, shape: "thick", frame: "#151515", lens: "#cfe8ff" },
  { id: "aviador", label: "Aviador", sun: false, shape: "aviator", frame: "#c9a24a", lens: "#cfe8ff" },
  { id: "gatubelos", label: "Ojo de gato", sun: false, shape: "cateye", frame: "#5a2d1a", lens: "#cfe8ff" },
  { id: "sol", label: "Clásicos", sun: true, shape: "thick", frame: "#151515", lens: "#1d1f22" },
  { id: "sol-aviador", label: "Aviador", sun: true, shape: "aviator", frame: "#c9a24a", lens: "#3d4a3a" },
  { id: "sol-redondos", label: "Redonditos", sun: true, shape: "round", frame: "#c9a24a", lens: "#2a2320" },
  { id: "sol-gatubelos", label: "Ojo de gato", sun: true, shape: "cateye", frame: "#151515", lens: "#2a1f22" },
  { id: "sol-grandes", label: "Grandes", sun: true, shape: "oversize", frame: "#6b3f1d", lens: "#3a2a22" },
  { id: "sol-deportivos", label: "Deportivos", sun: true, shape: "sport", frame: "#ededed", lens: "#2a3550", mirror: true },
  { id: "sol-espejados", label: "Espejados", sun: true, shape: "square", frame: "#9a9a9a", lens: "#3a7bd5", mirror: true },
];

export const glassesById = (id: AvatarStyle["glasses"]) => GLASSES.find((g) => g.id === id) ?? GLASSES[0];

/** Colores para el armazón. */
export const FRAME_COLORS: { hex: string; label: string }[] = [
  { hex: "#151515", label: "Negro" },
  { hex: "#6b3f1d", label: "Carey" },
  { hex: "#c9a24a", label: "Dorado" },
  { hex: "#a9adb3", label: "Plateado" },
  { hex: "#ededed", label: "Blanco" },
  { hex: "#b3261e", label: "Rojo" },
  { hex: "#1f4e8c", label: "Azul" },
  { hex: "#e9b7c6", label: "Rosa" },
];

export const EXPRESSIONS: { id: NonNullable<AvatarStyle["expression"]>; label: string }[] = [
  { id: "sonrisa", label: "🙂 Sonrisa" },
  { id: "feliz", label: "😄 Feliz" },
  { id: "serio", label: "😐 Serio" },
  { id: "guino", label: "😉 Guiño" },
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
  const base = p.gender === "mujer" ? { ...DEFAULT_AVATAR, hair: "largo" as const } : DEFAULT_AVATAR;
  return { ...base, ...(p.avatar ?? {}) };
}

/** Colores de pelo que detecta la IA → color del avatar. */
export const HAIR_COLOR_BY_ID: Record<string, string> = {
  negro: "#1f1a17",
  "castano-oscuro": "#3b2a20",
  "castano-claro": "#7a5233",
  rubio: "#d9b46a",
  pelirrojo: "#a8482c",
  gris: "#9a9a9a",
};
