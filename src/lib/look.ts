// Cómo se ve cada prenda en el avatar 3D. Para cada tipo de prenda, su forma y sus detalles de
// siempre (una camisa lleva cuello, tira de botones y puños; un short deportivo, cintura elástica
// y cordón; una ojota, la tira entre los dedos), aunque en la foto no se vean bien. Encima va lo
// que la IA vio en las fotos: el color real de la tela, el dibujo, el estampado y otros detalles.

import type { Selection, Slot } from "./avatar";
import { colorById, kindById } from "./catalog";
import { sizeDiff } from "./sizes";
import type { Garment, GarmentDetails, GarmentFit, PatternKind } from "./types";

/** Dibujo que cubre toda la tela. */
export interface FabricPattern {
  kind: PatternKind;
  color: string;
}

/**
 * La prenda real, para dibujar su estampado: las fotos, el ajuste de la IA y qué buscar en ellas.
 * Si la IA marcó dónde está el estampado, se recorta de ahí; si no, se mira la foto.
 */
export interface PrintRef {
  front: string;
  back?: string;
  fitFront?: GarmentFit;
  fitBack?: GarmentFit;
  /** La persona (o la IA al cargarla) dijo que es estampada. */
  estampado: boolean;
  /** La IA vio un dibujo que se repite por toda la tela: se usa un pedazo de la tela real. */
  allover: boolean;
  /** Qué parte del ancho de la foto es el cuerpo de la prenda (en una remera, sin las mangas). */
  body: number;
}

export interface TopLook {
  color: string;
  pattern: FabricPattern | null;
  /** Color de cuello, puños y ruedo. */
  trim: string;
  sleeves: "none" | "short" | "long";
  /**
   * Cuello: redondo, en V, henley (redondo con botoncitos), bote (ancho), camisero, de chomba,
   * alto (polera), con capucha, o tiras (musculosa, corpiño).
   */
  neck: "round" | "v" | "henley" | "boat" | "collar" | "polo" | "turtle" | "hood" | "straps";
  /** Largo del torso: normal, corto (crop), corpiño o malla enteriza. */
  cut: "normal" | "crop" | "bra" | "swimsuit";
  /** Tira de botones: hasta abajo (camisa), corta (chomba) o abierta (cárdigan). */
  placket: "none" | "full" | "short" | "open";
  buttons: number;
  buttonColor: string;
  /** Bolsillo en el pecho (camisas). */
  chestPocket: boolean;
  /** Bolsillo canguro (buzo con capucha). */
  pocket: boolean;
  /** Cordones de la capucha. */
  drawstring: boolean;
  /** Puños y cintura elastizados (buzos, sweaters). */
  ribbed: boolean;
  /** Puños de camisa en las mangas largas. */
  cuffs: boolean;
  /** Franjas a los costados (camisetas de equipo, ropa deportiva). */
  sideStripes: boolean;
  /** Vestido: largo de la pollera. */
  dress: "none" | "short" | "midi" | "long";
  /** Metida adentro del pantalón (con cinturón, o si la metés con el botón del probador). */
  tucked: boolean;
  /** Talles más grande (+) o más chica (−) que el tuyo (0 si es el tuyo o no se sabe). */
  ease: number;
  /** Qué tan ancha es: entallada, normal, oversize o muy grande (hombros caídos, mangas largas). */
  width: "ajustado" | "regular" | "holgado" | "muy-holgado";
  /** Largo del cuerpo: corta (a la cintura), normal (a la cadera) o larga. */
  length: "corto" | "normal" | "largo";
  /** Color de las mangas (el del cuerpo, salvo en una remera de béisbol). */
  sleeveColor: string;
  /** Medidas tomadas de la foto (si se pudieron medir): ver lib/photo-shape. */
  measured?: TopMeasured;
  /** La foto de adelante, para medir el largo, el ancho y las mangas de verdad. */
  source?: { src: string; fit?: GarmentFit };
  print?: PrintRef;
}

/** Proporciones de la remera medidas en su foto, comparadas con el ancho del pecho. */
export interface TopMeasured {
  /** Largo (del hombro al ruedo) sobre el ancho del pecho. */
  length: number;
  /** Cuánto salen las mangas de cada lado, sobre el ancho del pecho. */
  sleeve: number;
  /** Boca de la manga (aplanada) sobre el ancho del pecho. */
  opening: number;
  /** Ancho del ruedo sobre el ancho del pecho (más de 1: se abre abajo). */
  hem: number;
}

export interface BottomLook {
  color: string;
  pattern: FabricPattern | null;
  /** Color del elástico, las franjas y las costuras a la vista (en el jean, el hilo naranja). */
  trim: string;
  kind: "pants" | "shorts" | "bermuda" | "skirt" | "brief";
  /** Pollera: corta, midi o larga. */
  length: "mini" | "midi" | "long";
  /** Hasta dónde baja la pierna de un short por el muslo (0 = cadera, 1 = rodilla). */
  legT: number;
  /** Botamanga con puño (jogging, babucha). */
  cuffs: boolean;
  /** Pierna ancha (palazzo, oxford). */
  wide: boolean;
  /** Pegado al cuerpo (calza). */
  tight: boolean;
  /** Cintura con presillas y botón (jean, chino), elástica (jogging, deportivo) o lisa. */
  waist: "belt" | "elastic" | "plain";
  drawstring: boolean;
  /** Bragueta a la vista. */
  fly: boolean;
  /** Bolsillos: de jean, en diagonal (chino), en la costura del costado (deportivo) o cargo. */
  pockets: "none" | "jean" | "slant" | "side" | "cargo";
  sideStripes: boolean;
  /** Raya planchada adelante (pantalón de vestir). */
  crease: boolean;
  /** Cuánto más ancha que la pierna es la boca del short (en metros, sobre la holgura de la tela). */
  legWidth: number;
  /** Radio de la boca de la pierna medido en la foto (si se pudo medir), en metros. */
  hemR?: number;
  /** Cómo termina la pierna: simple, botamanga doblada, deshilachada, elástico o tajo al costado. */
  hem: "simple" | "doblado" | "deshilachado" | "elastico" | "tajo";
  /** Talles más grande (+) o más chica (−) que el tuyo (0 si es el tuyo o no se sabe). */
  ease: number;
  /** La foto de adelante, para medir el largo y el ancho de verdad. */
  source?: { src: string; fit?: GarmentFit };
  print?: PrintRef;
}

export interface ShoesLook {
  color: string;
  /** Suela (o tira, en las ojotas). */
  trim: string;
  kind:
    | "sneaker"
    | "boot"
    | "tallboot"
    | "formal"
    | "loafer"
    | "boat"
    | "flat"
    | "espadrille"
    | "sandal"
    | "flipflop"
    | "slide"
    | "heel"
    | "slipper"
    | "clog";
  laces: boolean;
  /** Tapones (botines de fútbol). */
  studs: boolean;
  /** Taco con tiras (sandalia de taco) o plataforma. */
  heelStyle: "pump" | "strappy" | "platform";
}

export interface OuterLook {
  color: string;
  pattern: FabricPattern | null;
  trim: string;
  kind: "jacket" | "denim" | "leather" | "fleece" | "windbreaker" | "blazer" | "coat" | "vest" | "puffer" | "cape";
  hood: boolean;
  closure: "zip" | "buttons" | "open";
  print?: PrintRef;
}

export interface AccessoryLook {
  color: string;
  trim: string;
  kind:
    | "cap"
    | "beanie"
    | "hat"
    | "scarf"
    | "belt"
    | "sunglasses"
    | "watch"
    | "bracelet"
    | "necklace"
    | "earrings"
    | "tie"
    | "bowtie"
    | "backpack"
    | "bag"
    | "clutch"
    | "waistbag"
    | "gloves"
    | "headband"
    | "suspenders"
    | "hairclip"
    | "other";
}

export interface Look {
  top: TopLook | null;
  bottom: BottomLook | null;
  shoes: ShoesLook | null;
  outerwear: OuterLook | null;
  accessory: AccessoryLook | null;
  /** La parte de arriba va metida adentro del pantalón (se ven la cintura y los bolsillos). */
  tuck?: boolean;
}

// ───────────────────────── Colores ─────────────────────────

const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Qué tan clara es (0 = negro, 1 = blanco). */
export function lightness(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Aclara (+) u oscurece (−) un color. */
export function adjust(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Un color que se distinga sobre la tela (más oscuro si es clara, más claro si es oscura). */
export function contrast(hex: string, amount = 0.3): string {
  return lightness(hex) > 0.55 ? adjust(hex, -amount) : adjust(hex, amount + 0.1);
}

/** Color de la tela: el que vio la IA en la foto, o el elegido en la lista. */
export function fabricOf(g: Garment): string {
  return g.fit?.front?.fabric ?? g.fit?.back?.fabric ?? colorById(g.color).hex;
}

/** Detalles que vio la IA (los de adelante mandan; la capucha o las franjas pueden verse atrás). */
export function detailsOf(g: Garment): GarmentDetails {
  const f = g.fit?.front?.details ?? {};
  const b = g.fit?.back?.details ?? {};
  return {
    ...b,
    ...f,
    hood: f.hood || b.hood || undefined,
    sideStripes: f.sideStripes || b.sideStripes || undefined,
    drawstring: f.drawstring || b.drawstring || undefined,
  };
}

function patternOf(d: GarmentDetails, color: string): FabricPattern | null {
  if (!d.pattern) return null;
  return { kind: d.pattern, color: d.patternColor ?? contrast(color, 0.45) };
}

function printOf(g: Garment, body: number): PrintRef | undefined {
  if (!g.photo) return undefined;
  const d = detailsOf(g);
  const estampado = g.pattern === "estampado";
  if (!estampado && !d.pattern && !g.fit?.front?.print && !g.fit?.back?.print) return undefined;
  return { front: g.photo, back: g.photoBack, fitFront: g.fit?.front, fitBack: g.fit?.back, estampado, allover: Boolean(d.pattern), body };
}

// ───────────────────────── Parte de arriba ─────────────────────────

const NO_SLEEVES = new Set([
  "musculosa",
  "top",
  "crop-top",
  "body",
  "corset",
  "musculosa-pijama",
  "top-pijama",
  "solero",
  "camison",
  "babydoll",
  "corpino",
  "corpino-deportivo",
  "top-interior",
  "bikini-arriba",
  "enteriza",
  "trikini",
  "body-interior",
  "chaleco-tejido",
]);
const LONG_SLEEVES = new Set([
  "remera-manga-larga",
  "camisa",
  "buzo",
  "hoodie",
  "sweater",
  "polera",
  "cardigan",
  "blusa",
  "tunica",
  "vestido-largo",
  "enterito",
  "enterito-pijama",
  "camisa-pijama",
  "remera-uv",
]);
const SHIRTS = new Set(["camisa", "camisa-manga-corta", "camisa-pijama"]);
/** Prendas que pueden tener cualquier cuello común (redondo, en V, henley, bote): manda lo que vio la IA. */
const FREE_NECK = new Set(["remera", "remera-manga-larga", "buzo", "sweater", "blusa", "tunica", "body", "remera-pijama", "camiseta-equipo"]);
const AI_NECK = { redondo: "round", v: "v", henley: "henley", bote: "boat" } as const;
const RIBBED = new Set(["buzo", "hoodie", "sweater", "cardigan", "polera", "chaleco-tejido"]);

function topLook(g: Garment): TopLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const d = detailsOf(g);
  const color = fabricOf(g);
  const look = kindById(g.category, g.kind)?.look;
  const known = Boolean(k) && k !== "otro";
  // El tipo de prenda manda; lo que vio la IA completa (o decide, si el tipo no se sabe).
  const aiSleeves = d.sleeves === "sin" ? "none" : d.sleeves === "cortas" ? "short" : d.sleeves === "largas" ? "long" : null;
  const sleeves: TopLook["sleeves"] = NO_SLEEVES.has(k)
    ? "none"
    : LONG_SLEEVES.has(k) || look === "larga"
      ? "long"
      : !known && aiSleeves
        ? aiSleeves
        : look === "corta" || g.warmth === "light" || /musculosa|remera|top\b/.test(name)
          ? "short"
          : known
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
  const shirt = SHIRTS.has(k) || (!known && /camisa/.test(name));
  const hood = k === "hoodie" || Boolean(d.hood);
  // Cuello que vio la IA (en una remera o buzo, o si no se sabe qué prenda es).
  const aiNeck = d.neck && d.neck in AI_NECK ? AI_NECK[d.neck as keyof typeof AI_NECK] : null;
  const freeNeck = (FREE_NECK.has(k) || !known) && sleeves !== "none";
  const neck: TopLook["neck"] = freeNeck && aiNeck
    ? aiNeck
    : shirt
    ? "collar"
    : k === "chomba"
      ? "polo"
      : k === "polera"
        ? "turtle"
        : hood
          ? "hood"
          : k === "cardigan" || k === "chaleco-tejido" || k === "camiseta-equipo"
            ? "v"
            : sleeves === "none"
              ? "straps"
              : "round";
  // Una camisa siempre tiene tira de botones (aunque en la foto no se vean); si la IA contó más, esos.
  const defaultButtons =
    neck === "henley" ? 3 : k === "camisa" || k === "camisa-pijama" ? 7 : shirt ? 6 : k === "chomba" ? 3 : k === "cardigan" ? 5 : 0;
  const buttons = neck === "henley" ? Math.min(4, Math.max(defaultButtons, d.buttons ?? 0)) : Math.max(defaultButtons, d.buttons ?? 0);
  const placket: TopLook["placket"] = shirt
    ? "full"
    : k === "chomba" || neck === "henley"
      ? "short"
      : k === "cardigan"
        ? "open"
        : buttons > 0 && cut === "normal"
          ? "full"
          : "none";
  const ribbed = RIBBED.has(k);
  return {
    color,
    pattern: patternOf(d, color),
    trim: d.trim ?? (k === "camiseta-equipo" ? contrast(color, 0.5) : adjust(color, -0.06)),
    sleeves,
    neck,
    cut,
    placket,
    buttons: placket === "none" ? 0 : buttons,
    buttonColor: contrast(color, 0.3),
    chestPocket: (shirt && k !== "camisa-pijama") || d.pockets === "pecho",
    pocket: k === "hoodie" || d.pockets === "canguro",
    drawstring: hood && (k === "hoodie" || Boolean(d.drawstring)),
    ribbed,
    cuffs: shirt && sleeves === "long",
    sideStripes: Boolean(d.sideStripes),
    dress,
    tucked: false,
    ease: 0,
    width: d.width ?? "regular",
    length: d.bodyLength ?? (cut === "crop" ? "corto" : "normal"),
    sleeveColor: d.sleeveColor ?? color,
    source: g.photo ? { src: g.photo, fit: g.fit?.front } : undefined,
    print: printOf(g, 0.62),
  };
}

// ───────────────────────── Parte de abajo ─────────────────────────

const SPORT_NAME = /deport|running|correr|f[uú]tbol|basquet|b[aá]sket|training|gym|nike|adidas|puma|under armour/;
/** Cuánto baja cada largo de short por el muslo. */
const LEG_T = { micro: 0.28, muslo: 0.45, rodilla: 1 } as const;

function bottomLook(g: Garment, gender?: string | null): BottomLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const d = detailsOf(g);
  const color = fabricOf(g);
  const look = kindById(g.category, g.kind)?.look;
  const sport = Boolean(g.sport) || SPORT_NAME.test(name);
  const pijama = g.category === "pijama";
  // La "malla de abajo" es short de baño para él y bikini para ella.
  const swimShort = k === "malla-abajo" && gender !== "mujer";
  const brief =
    ["calzon", "tanga", "sunga", "bikini-abajo"].includes(k) ||
    (k === "malla-abajo" && gender === "mujer") ||
    (k === "boxer" && gender === "mujer");
  const boxer = k === "boxer" && gender !== "mujer";
  let kind: BottomLook["kind"] = brief
    ? "brief"
    : look === "pollera" || /pollera|falda/.test(name)
      ? "skirt"
      : k === "bermuda" || k === "bermuda-pijama" || (!k && /bermuda/.test(name))
        ? "bermuda"
        : boxer || swimShort || look === "corta" || /short/.test(name)
          ? "shorts"
          : "pants";
  if (kind === "shorts" && d.legLength === "rodilla") kind = "bermuda";
  if (kind === "shorts" && d.legLength === "largo") kind = "pants";
  const elasticKind =
    ["jogging", "calza", "calza-corta", "babucha", "pantalon-lino", "calza-pijama"].includes(k) ||
    pijama ||
    swimShort ||
    boxer ||
    (k === "short" && sport);
  const waist: BottomLook["waist"] =
    kind === "skirt" || kind === "brief"
      ? "plain"
      : elasticKind || d.elastic
        ? "elastic"
        : ["jean", "chino", "cargo", "pantalon-vestir", "bermuda", "oxford", "short"].includes(k) || !k || k === "otro"
          ? "belt"
          : "plain";
  const tight = ["calza", "calza-pijama", "calza-corta"].includes(k);
  const pockets: BottomLook["pockets"] =
    d.pockets === "cargo" || k === "cargo"
      ? "cargo"
      : d.pockets === "jean" || k === "jean"
        ? "jean"
        : waist === "belt" && kind !== "skirt"
          ? "slant"
          : kind === "shorts" && sport && !tight
            ? "side"
            : kind === "pants" && waist === "elastic" && !tight
              ? "side"
              : "none";
  const legT =
    kind !== "shorts"
      ? 1
      : boxer
        ? 0.22
        : tight
          ? 0.42
          : d.legLength === "micro" || d.legLength === "muslo"
            ? LEG_T[d.legLength]
            : swimShort
              ? 0.4
              : sport
                ? 0.42
                : 0.5;
  return {
    color,
    pattern: patternOf(d, color),
    // El jean lleva costuras de hilo naranja; el resto, el color de los detalles (o la tela un poco más oscura).
    trim: d.trim ?? (pockets === "jean" ? "#c98a3a" : adjust(color, -0.08)),
    kind,
    length: k === "pollera-larga" ? "long" : k === "pollera-midi" ? "midi" : "mini",
    legT,
    cuffs: k === "jogging" || k === "babucha",
    wide: k === "palazzo" || k === "oxford" || k === "babucha" || k === "pantalon-lino",
    tight,
    waist,
    drawstring: waist === "elastic" && !tight && !boxer && (Boolean(d.drawstring) || k === "jogging" || swimShort || sport || pijama),
    fly: waist === "belt" && kind !== "brief",
    pockets,
    sideStripes: Boolean(d.sideStripes),
    crease: k === "pantalon-vestir",
    // Ancho de la pierna: lo que vio la IA, o lo de siempre para ese tipo (el deportivo, suelto).
    legWidth:
      d.width ? LEG_WIDTH[d.width] : boxer || tight ? 0.002 : swimShort ? 0.02 : sport ? 0.024 : pockets === "jean" ? 0.01 : 0.013,
    hem: d.hem ?? (boxer || tight ? "elastico" : "simple"),
    ease: 0,
    source: g.photo ? { src: g.photo, fit: g.fit?.front } : undefined,
    print: printOf(g, 1),
  };
}

/** Cuánto más ancha que la pierna es la boca del short según lo ancho que lo vio la IA. */
const LEG_WIDTH = { ajustado: 0.003, regular: 0.013, holgado: 0.027, "muy-holgado": 0.045 } as const;

// ───────────────────────── Calzado ─────────────────────────

function shoesLook(g: Garment): ShoesLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const d = detailsOf(g);
  const color = fabricOf(g);
  let kind: ShoesLook["kind"] =
    k === "botas-altas"
      ? "tallboot"
      : k === "borcegos" || k === "botas" || (!k && /bota|borceg/.test(name))
        ? "boot"
        : ["tacos", "sandalias-taco", "plataformas"].includes(k)
          ? "heel"
          : k === "sandalias"
            ? "sandal"
            : k === "ojotas" || k === "ojotas-pijama" || (!k && /ojota|chancla|chinela/.test(name))
              ? "flipflop"
              : k === "pantuflas"
                ? "slipper"
                : k === "mocasines"
                  ? "loafer"
                  : k === "nauticos"
                    ? "boat"
                    : k === "chatitas"
                      ? "flat"
                      : k === "alpargatas"
                        ? "espadrille"
                        : k === "zuecos"
                          ? "clog"
                          : k === "zapatos"
                            ? "formal"
                            : "sneaker";
  // La IA puede ver que la "ojota" es en realidad una chancla (tira ancha) o una sandalia.
  if (kind === "flipflop" || kind === "sandal") {
    if (d.strap === "ancha") kind = "slide";
    else if (d.strap === "tiras") kind = "sandal";
    else if (d.strap === "dedo") kind = "flipflop";
  }
  const soleDefault =
    kind === "sneaker"
      ? "#f4f2ee"
      : kind === "boot" || kind === "tallboot"
        ? "#2b2622"
        : kind === "boat"
          ? "#f1ede4"
          : kind === "espadrille"
            ? "#d8c39a"
            : adjust(color, -0.25);
  return {
    color,
    trim: d.trim ?? soleDefault,
    kind,
    laces: kind === "sneaker" || kind === "formal" || kind === "boat" || k === "borcegos",
    studs: k === "botines",
    heelStyle: k === "sandalias-taco" ? "strappy" : k === "plataformas" ? "platform" : "pump",
  };
}

// ───────────────────────── Abrigo ─────────────────────────

function outerLook(g: Garment): OuterLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const d = detailsOf(g);
  const color = fabricOf(g);
  const kind: OuterLook["kind"] =
    k === "saco" || k === "torera"
      ? "blazer"
      : k === "campera-jean"
        ? "denim"
        : k === "campera-cuero"
          ? "leather"
          : k === "polar"
            ? "fleece"
            : k === "rompevientos"
              ? "windbreaker"
              : k === "poncho" || k === "capa"
                ? "cape"
                : ["tapado", "parka", "piloto", "kimono", "bata", "pareo"].includes(k)
                  ? "coat"
                  : k === "chaleco"
                    ? "vest"
                    : k === "campera-inflable"
                      ? "puffer"
                      : "jacket";
  const closure: OuterLook["closure"] =
    kind === "cape" || k === "kimono" || k === "bata" || k === "pareo"
      ? "open"
      : kind === "blazer" || kind === "denim" || k === "tapado" || k === "piloto" || (d.buttons ?? 0) > 0
        ? "buttons"
        : "zip";
  return {
    color,
    pattern: patternOf(d, color),
    trim: d.trim ?? (kind === "denim" ? "#c98a3a" : adjust(color, -0.12)),
    kind,
    hood: Boolean(d.hood) || k === "parka" || k === "rompevientos" || /capucha/.test(name),
    closure,
    print: printOf(g, 0.6),
  };
}

// ───────────────────────── Accesorios ─────────────────────────

const ACCESSORY: Record<string, AccessoryLook["kind"]> = {
  gorra: "cap",
  gorro: "beanie",
  "gorro-dormir": "beanie",
  sombrero: "hat",
  bufanda: "scarf",
  panuelo: "scarf",
  cinturon: "belt",
  "anteojos-sol": "sunglasses",
  reloj: "watch",
  pulsera: "bracelet",
  collar: "necklace",
  aros: "earrings",
  corbata: "tie",
  mono: "bowtie",
  mochila: "backpack",
  cartera: "bag",
  bolso: "bag",
  sobre: "clutch",
  rinonera: "waistbag",
  guantes: "gloves",
  vincha: "headband",
  tiradores: "suspenders",
  "accesorio-pelo": "hairclip",
};

function accessoryLook(g: Garment): AccessoryLook {
  const k = g.kind ?? "";
  const name = g.name.toLowerCase();
  const d = detailsOf(g);
  const color = fabricOf(g);
  const kind: AccessoryLook["kind"] =
    ACCESSORY[k] ??
    (/gorra/.test(name)
      ? "cap"
      : /gorro/.test(name)
        ? "beanie"
        : /sombrero|piluso/.test(name)
          ? "hat"
          : /bufanda|pa[ñn]uelo/.test(name)
            ? "scarf"
            : /cintur[oó]n/.test(name)
              ? "belt"
              : /reloj/.test(name)
                ? "watch"
                : /anteojos|lentes/.test(name)
                  ? "sunglasses"
                  : "other");
  // Hebillas, cristales y relojes: dorado o plateado si la IA no vio otro color.
  const metal = lightness(color) > 0.5 ? "#8a8f96" : "#c9a64a";
  return { color, trim: d.trim ?? (kind === "belt" || kind === "watch" || kind === "suspenders" ? metal : adjust(color, -0.15)), kind };
}

// ───────────────────────── El look completo ─────────────────────────

/** Si no elegiste nada, el avatar lleva una remera y un short básicos. */
export const DEFAULT_TOP: TopLook = {
  color: "#d6d0c6",
  pattern: null,
  trim: "#c9c3b9",
  sleeves: "short",
  neck: "round",
  cut: "normal",
  placket: "none",
  buttons: 0,
  buttonColor: "#8f8a82",
  chestPocket: false,
  pocket: false,
  drawstring: false,
  ribbed: false,
  cuffs: false,
  sideStripes: false,
  dress: "none",
  tucked: false,
  ease: 0,
  width: "regular",
  length: "normal",
  sleeveColor: "#d6d0c6",
};
export const DEFAULT_BOTTOM: BottomLook = {
  color: "#8f8a82",
  pattern: null,
  trim: "#837e77",
  kind: "shorts",
  length: "mini",
  legT: 0.5,
  cuffs: false,
  wide: false,
  tight: false,
  waist: "elastic",
  drawstring: false,
  fly: false,
  pockets: "none",
  sideStripes: false,
  crease: false,
  legWidth: 0.013,
  hem: "simple",
  ease: 0,
};

/** Lo que el avatar tiene puesto arriba y abajo (con un vestido no lleva nada abajo). */
export function wornTop(look: Look): TopLook {
  const top = look.top ?? DEFAULT_TOP;
  // Metida solo si es una parte de arriba común y hay algo abajo donde meterla.
  const canTuck = top.cut === "normal" && top.dress === "none" && Boolean(look.bottom) && look.bottom?.kind !== "brief";
  return look.tuck && canTuck && !top.tucked ? { ...top, tucked: true } : top;
}
export function wornBottom(look: Look): BottomLook | null {
  return look.bottom ?? (look.top && look.top.dress !== "none" ? null : DEFAULT_BOTTOM);
}

/**
 * Cómo dibujar la ropa elegida. `gender` decide las prendas que cambian según quién las usa
 * (la "malla de abajo" es short de baño para él y bikini para ella).
 */
export function lookFrom(
  sel: Selection,
  garments: Garment[],
  gender?: string | null,
  opts: { sizes?: { top?: string; bottom?: string }; tuck?: boolean } = {},
): Look {
  const get = (s: Slot) => garments.find((g) => g.id === sel[s]) ?? null;
  const top = get("top");
  const jumpsuit = top?.category === "dress" && (top.kind === "enterito" || top.kind === "jardinero");
  // El vestido tapa lo de abajo; el enterito es arriba y pantalón del mismo color.
  const bottom = jumpsuit ? top : top?.category === "dress" && !jumpsuit ? null : get("bottom");
  const shoes = get("shoes");
  const outer = get("outerwear");
  const acc = get("accessory");
  const accessory = acc ? accessoryLook(acc) : null;
  let topL = top ? topLook(top) : null;
  let bottomL = bottom ? (jumpsuit ? { ...bottomLook(bottom, gender), kind: "pants" as const } : bottomLook(bottom, gender)) : null;
  // Talle: comparado con el tuyo, la prenda queda más holgada y larga (o más justa y corta).
  const topEase = top ? (sizeDiff(top.size, opts.sizes?.top) ?? 0) : 0;
  const bottomEase = bottom && !jumpsuit ? (sizeDiff(bottom.size, opts.sizes?.bottom) ?? 0) : 0;
  if (topL && topEase) topL = { ...topL, ease: topEase };
  if (bottomL && bottomEase) bottomL = { ...bottomL, ease: bottomEase };
  // Con cinturón, la parte de arriba va metida adentro del pantalón (si no, el cinturón no se vería).
  if (accessory?.kind === "belt" && topL && topL.cut === "normal" && topL.dress === "none" && bottomL && bottomL.kind !== "brief") {
    topL = { ...topL, tucked: true };
  }
  return {
    top: topL,
    bottom: bottomL,
    shoes: shoes ? shoesLook(shoes) : null,
    outerwear: outer ? outerLook(outer) : null,
    accessory,
    tuck: Boolean(opts.tuck),
  };
}
