// Esqueleto del avatar 3D: dónde está cada articulación y qué forma tiene el torso, según el perfil.
// Todo en metros para una persona de 1,72 m; el avatar después se escala a la altura real.
// Es lógica pura (sin three.js) para poder probarla.

import type { BodyDims } from "./avatar";
import { wornBottom, wornTop, type BottomLook, type Look, type OuterLook, type TopLook } from "./look";

export type V3 = [number, number, number];

/** Un corte horizontal del cuerpo: un óvalo a cierta altura (rx de costado, rz de adelante a atrás). */
export interface Ring {
  y: number;
  rx: number;
  rz: number;
  /** Corrimiento hacia adelante (+) o atrás (−) del centro del óvalo (pecho adelante, cola atrás). */
  z: number;
}

export interface ArmJoints {
  shoulder: V3;
  elbow: V3;
  wrist: V3;
}

export interface LegJoints {
  hip: V3;
  knee: V3;
  ankle: V3;
}

export interface Skeleton {
  head: { y: number; r: number };
  neck: { bottom: number; top: number; r: number };
  /** Torso de la entrepierna a la base del cuello. */
  torso: Ring[];
  /** Radio del hombro (deltoides). */
  deltoid: number;
  arm: (side: 1 | -1) => ArmJoints;
  leg: (side: 1 | -1) => LegJoints;
  /** Grosor del brazo: arriba, codo, antebrazo, muñeca. */
  armR: { top: number; elbow: number; forearm: number; wrist: number };
  /** Grosor de la pierna: muslo arriba, rodilla, pantorrilla, tobillo. */
  legR: { thigh: number; knee: number; calf: number; ankle: number };
  /** Altura de la cintura (donde va el pantalón). */
  waistY: number;
  /** Altura de la entrepierna. */
  crotchY: number;
}

export const HEAD_Y = 1.67;
export const HEAD_R = 0.15;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Lugar que dejan los brazos al costado del cuerpo (en metros), según lo que tenga puesto:
 * `torso` a la altura de los codos y los antebrazos, `hips` a la altura de las manos.
 * Sin esto, con un abrigo grueso o en un cuerpo ancho, los brazos atravesarían la panza o la cadera.
 */
export interface ArmRoom {
  torso: number;
  hips: number;
}

/** El lugar para una remera básica y un short. */
export const ARM_ROOM: ArmRoom = { torso: 0.017, hips: 0.03 };

/** Medio grosor de la mano (de la palma al dorso): cuelga con la palma mirando al muslo. */
const HAND_HALF = 0.018;

export function buildSkeleton(d: BodyDims, room: ArmRoom = ARM_ROOM): Skeleton {
  const s = d.shoulder;
  const w = d.waist;
  const h = d.hip;
  const fem = d.feminine;
  // El pecho acompaña a la cintura, pero nunca es más ancho que los hombros (en un cuerpo óvalo
  // lo más ancho es la panza, no el pecho).
  const chest = Math.min(Math.max(w * 1.03, s * (fem ? 0.78 : 0.82)), s * 0.9);
  // Piernas: los muslos salen al ras de la cadera y casi se tocan adentro.
  const hx = h * 0.465;
  const thigh = Math.min(0.09, Math.max(0.066, h * 0.445));
  // La cadera se ensancha solo hasta el borde de afuera de los muslos: así no queda un "globo"
  // colgando por debajo ni bultos a los costados.
  const hipW = hx + thigh + 0.006;
  const hipD = Math.max(thigh + 0.012, h * (fem ? 0.64 : 0.6));
  // Cortes del torso, de abajo hacia arriba. En el cuerpo femenino, busto adelante y cintura marcada.
  const torso: Ring[] = [
    { y: 0.855, rx: hx * 0.95, rz: thigh * 0.9, z: -0.006 },
    { y: 0.88, rx: hipW * 0.97, rz: thigh * 1.08, z: -0.01 },
    { y: 0.93, rx: hipW, rz: hipD, z: -0.014 },
    { y: 0.99, rx: lerp(hipW, w, 0.3), rz: lerp(hipD, w * 0.7, 0.35), z: -0.01 },
    { y: 1.05, rx: lerp(hipW, w, 0.72), rz: lerp(hipD, w * 0.7, 0.75), z: -0.004 },
    { y: 1.11, rx: w, rz: w * 0.7, z: 0 },
    { y: 1.19, rx: lerp(w, chest, fem ? 0.4 : 0.55), rz: fem ? w * 0.72 : lerp(w * 0.7, chest * 0.64, 0.5), z: 0.004 },
    { y: 1.27, rx: chest, rz: chest * (fem ? 0.74 : 0.64), z: fem ? 0.02 : 0.01 },
    { y: 1.35, rx: s * 0.86, rz: chest * (fem ? 0.64 : 0.6), z: fem ? 0.01 : 0.006 },
    { y: 1.41, rx: s * 0.82, rz: chest * 0.54, z: 0 },
    { y: 1.445, rx: s * 0.66, rz: 0.088, z: -0.004 },
    { y: 1.475, rx: s * 0.4, rz: 0.07, z: -0.008 },
    { y: 1.495, rx: 0.068, rz: 0.057, z: -0.01 },
  ];

  const deltoid = Math.min(0.058, Math.max(0.044, 0.05 * Math.sqrt(s / 0.21)));
  const armR = { top: deltoid * 0.94, elbow: 0.038, forearm: 0.041, wrist: 0.027 };
  const legR = { thigh, knee: 0.047, calf: 0.054, ankle: 0.031 };
  const right = armJoints(torso, hipW, s * 0.83, { armR, legR }, room);
  const arm = (side: 1 | -1): ArmJoints => ({
    shoulder: [side * right.shoulder[0], right.shoulder[1], right.shoulder[2]],
    elbow: [side * right.elbow[0], right.elbow[1], right.elbow[2]],
    wrist: [side * right.wrist[0], right.wrist[1], right.wrist[2]],
  });

  const leg = (side: 1 | -1): LegJoints => ({
    hip: [side * hx, 0.88, -0.004],
    knee: [side * hx * 0.94, 0.495, 0.006],
    ankle: [side * hx * 0.9, 0.085, -0.012],
  });

  return {
    head: { y: HEAD_Y, r: HEAD_R },
    neck: { bottom: 1.45, top: 1.575, r: fem ? 0.041 : 0.047 },
    torso,
    deltoid,
    arm,
    leg,
    armR,
    legR,
    waistY: 1.02,
    crotchY: 0.855,
  };
}

/**
 * Brazo derecho relajado, colgando al costado: el codo y la mano se abren lo justo para no
 * atravesar el cuerpo (más en un cuerpo ancho o con un abrigo grueso). Arriba, en la axila, el
 * brazo sí se apoya en el cuerpo.
 */
function armJoints(torso: Ring[], hipW: number, sx: number, sk: Pick<Skeleton, "armR" | "legR">, room: ArmRoom): ArmJoints {
  const prof = limbProfiles(sk);
  // Lo más ancho del cuerpo a cada altura: el torso, y de la cadera para abajo, la cadera (la ropa
  // cuelga de ahí: polleras, remeras, abrigos).
  const outer = (y: number) => Math.max(ringAt(torso, y).rx, y < 0.93 ? hipW : 0);
  const gap = (y: number) => {
    const t = Math.min(1, Math.max(0, (y - 0.95) / 0.1));
    return lerp(room.hips, room.torso, t);
  };
  const shoulder: V3 = [sx, 1.388, -0.004];
  const elbowY = 1.13;
  const wristY = 0.885;
  // Codo: al costado de la cintura.
  let ex = Math.max(sx + 0.032, outer(elbowY) + gap(elbowY) + sk.armR.elbow);
  // Parte baja del brazo: que no se meta en la panza (piel con piel alcanza: es la misma prenda).
  for (let k = 0; k <= 4; k++) {
    const t = 0.8 + (0.2 * k) / 4;
    const y = lerp(shoulder[1], elbowY, t);
    const need = outer(y) + profileAt(prof.upperArm, t);
    if (lerp(sx, ex, t) < need) ex = sx + (need - sx) / t;
  }
  // Antebrazo: baja un poquito hacia afuera y no toca la cintura ni la cadera.
  let wx = Math.max(sx + 0.052, ex + 0.012);
  for (let k = 1; k <= 10; k++) {
    const t = k / 10;
    const y = lerp(elbowY, wristY, t);
    const need = outer(y) + gap(y) + profileAt(prof.forearm, t);
    if (lerp(ex, wx, t) < need) wx = ex + (need - ex) / t;
  }
  // Mano: cuelga unos 16 cm debajo de la muñeca, con la palma hacia el muslo.
  for (let k = 0; k <= 6; k++) {
    const y = wristY - (0.16 * k) / 6;
    wx = Math.max(wx, outer(y) + gap(y) + HAND_HALF);
  }
  return { shoulder, elbow: [ex, elbowY, -0.022], wrist: [wx, wristY, 0.018] };
}

/** Holgura y vuelo (abajo) de la parte de arriba según su corte. */
type TopFitLook = Pick<TopLook, "cut" | "ribbed" | "dress"> & Partial<Pick<TopLook, "ease" | "width" | "measured">>;

/** Holgura extra del cuerpo según lo ancha que es (entallada, normal, oversize, muy grande). */
const TOP_WIDTH = { ajustado: -0.005, regular: 0, holgado: 0.013, "muy-holgado": 0.026 } as const;

/** Holgura y vuelo (abajo) de la parte de arriba según su corte. */
export function topFit(look: TopFitLook): { inflate: number; flare: number } {
  if (look.cut === "crop") return { inflate: 0.008, flare: 0 };
  if (look.cut === "bra" || look.cut === "swimsuit") return { inflate: 0.004, flare: 0 };
  if (look.dress !== "none") return { inflate: 0.008, flare: 0 };
  // Un talle más grande que el tuyo queda más holgado (y uno más chico, más pegado).
  const ease = look.ease ?? 0;
  const inflate = Math.max(0.005, (look.ribbed ? 0.018 : 0.013) + TOP_WIDTH[look.width ?? "regular"] + 0.006 * ease);
  // Vuelo abajo: el que se ve en la foto (ruedo más ancho que el pecho) o el de siempre. Las
  // oversize son más bien rectas (cuadradas).
  let flare = look.ribbed ? 0 : look.width === "holgado" || look.width === "muy-holgado" ? 0.006 : 0.012;
  if (look.measured && !look.ribbed) flare = Math.min(0.04, Math.max(0, ((look.measured.hem - 1) * 0.47) / Math.PI + 0.004));
  return { inflate, flare: Math.max(0, flare + 0.004 * ease) };
}

/** Holgura de las mangas de la parte de arriba. */
export function sleeveInflate(look: Pick<TopLook, "ribbed"> & Partial<Pick<TopLook, "ease" | "width">>): number {
  const width = { ajustado: -0.003, regular: 0, holgado: 0.006, "muy-holgado": 0.012 }[look.width ?? "regular"];
  return Math.max(0.006, (look.ribbed ? 0.016 : 0.012) + width + 0.003 * (look.ease ?? 0));
}

/**
 * Medio contorno del pecho de la remera puesta (lo que mide de ancho estirada sobre una mesa): el
 * del cuerpo más la holgura. Sirve para pasar las proporciones de la foto al avatar.
 */
export function chestFlat(sk: Skeleton, inflate: number): number {
  const r = ringAt(sk.torso, 1.27);
  const a = r.rx + inflate;
  const b = r.rz + inflate;
  return (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))) / 2;
}

/**
 * Manga corta: hasta dónde baja por el brazo (t, 0 = hombro, 1 = codo) y cuánto más ancha que el
 * brazo es su boca. Una oversize llega casi al codo y es ancha; una entallada, corta y justa. Si
 * se midió en la foto, manda la foto.
 */
export function topSleeve(sk: Skeleton, look: TopLook): { inflate: number; t: number; open: number } {
  const inflate = sleeveInflate(look);
  const ease = look.ease ?? 0;
  const w = look.width ?? "regular";
  let t = { ajustado: 0.44, regular: 0.52, holgado: 0.66, "muy-holgado": 0.8 }[w];
  let open = { ajustado: 0.002, regular: 0.007, holgado: 0.014, "muy-holgado": 0.02 }[w];
  const m = look.measured;
  if (m) {
    t = 0.52 + (m.sleeve - 0.25) * 2.8;
    const skin = profileAt(limbProfiles(sk).upperArm, Math.min(0.95, Math.max(0.28, t)));
    const r = (m.opening * chestFlat(sk, topFit(look).inflate)) / Math.PI;
    open = Math.min(0.04, Math.max(0.002, r - skin - inflate));
  }
  return { inflate, t: Math.min(0.95, Math.max(0.28, t + 0.04 * ease)), open: open + 0.002 * Math.max(0, ease) };
}

/** Forma del abrigo: hasta dónde llega, cuánta holgura tiene el cuerpo y las mangas, y el vuelo abajo. */
export function outerFit(kind: OuterLook["kind"]): { hem: number; inflate: number; flare: number; sleeve: number } {
  return {
    hem: kind === "coat" ? 0.5 : kind === "cape" ? 0.8 : kind === "blazer" ? 0.82 : kind === "denim" ? 0.92 : 0.86,
    inflate: kind === "puffer" ? 0.045 : kind === "cape" ? 0.05 : kind === "coat" || kind === "fleece" ? 0.03 : 0.028,
    flare: kind === "coat" ? 0.06 : kind === "cape" ? 0.05 : 0.008,
    // El poncho no tiene mangas: cubre los brazos.
    sleeve: kind === "puffer" ? 0.034 : kind === "cape" ? 0 : 0.024,
  };
}

/** Holgura de la parte de abajo (las calzas y la ropa interior van pegadas). */
export function bottomInflate(look: Pick<BottomLook, "kind" | "tight"> & { ease?: number }): number {
  const ease = look.ease ?? 0;
  if (look.kind === "brief" || look.tight) return Math.max(0.003, 0.004 + 0.001 * ease);
  // Un talle más grande queda más suelto en la cintura y la cadera; uno más chico, más justo.
  return Math.max(0.004, 0.012 + 0.004 * ease);
}

/** Hasta dónde baja la pierna por el muslo (0 = cadera, 1 = rodilla): un talle más grande, más larga. */
export function bottomLegT(look: Pick<BottomLook, "kind" | "legT"> & { ease?: number }): number {
  if (look.kind !== "shorts") return 1;
  return Math.min(1, Math.max(0.15, look.legT + 0.03 * (look.ease ?? 0)));
}

/**
 * Cuánto más ancha que la pierna (más la holgura) queda la tela del muslo en cada punto (t: 0 en
 * la cadera, 1 en la rodilla). Un short se abre hacia la boca de la pierna según lo ancho que es:
 * el de correr, suelto; el de jean, más recto; la calza, pegada. Si se midió la boca en la foto,
 * se usa esa medida.
 */
export function bottomLegExtra(sk: Skeleton, look: BottomLook): (t: number) => number {
  if (look.kind !== "shorts" && look.kind !== "bermuda") return () => 0;
  const tEnd = bottomLegT(look);
  const ease = look.ease ?? 0;
  let w = look.tight ? 0.001 : Math.max(0.002, (look.legWidth ?? 0.013) + 0.006 * ease);
  if (look.kind === "bermuda") w *= 0.7;
  else if (look.hemR && !look.tight) {
    const skinEnd = profileAt(limbProfiles(sk).thigh, tEnd) + bottomInflate(look);
    w = Math.min(0.07, Math.max(0.003, look.hemR - skinEnd + 0.006 * ease));
  }
  return (t) => (t <= 0 ? 0 : w * Math.min(1, t / tEnd) ** 1.3);
}

/**
 * Un short ancho no se abre parejo para los dos lados: la tela se va hacia afuera (entre las
 * piernas no hay lugar). Por eso el eje de la pierna del short se corre un poco hacia afuera a
 * medida que baja. Devuelve cuánto se corre en cada punto (t: 0 en la cadera, 1 en la rodilla).
 */
export function bottomLegShift(sk: Skeleton, look: BottomLook): (t: number) => number {
  if (look.kind !== "shorts" || look.tight) return () => 0;
  const tEnd = bottomLegT(look);
  const s = (0.85 * bottomLegExtra(sk, look)(tEnd)) / tEnd;
  return (t) => s * Math.max(0, t);
}

/** Cadera y rodilla del eje de la pierna del short (del lado `side`), ya corrido hacia afuera si es ancho. */
export function bottomLegAxis(sk: Skeleton, look: BottomLook, side: 1 | -1): { hip: V3; knee: V3 } {
  const l = sk.leg(side);
  const s = bottomLegShift(sk, look)(1);
  return { hip: l.hip, knee: [l.knee[0] + side * s, l.knee[1], l.knee[2]] };
}

/** Perfil de la tela del muslo de una parte de abajo (t de 0 a 1 sobre el tramo que cubre). */
export function bottomThighProfile(sk: Skeleton, look: BottomLook): [number, number][] {
  const prof = limbProfiles(sk);
  const tEnd = bottomLegT(look);
  const inf = bottomInflate(look);
  const extra = bottomLegExtra(sk, look);
  const ts = new Set<number>([0, 1, ...prof.thigh.map((p) => p[0] / tEnd).filter((k) => k > 0 && k < 1)]);
  for (let i = 1; i < 6; i++) ts.add(i / 6);
  return [...ts]
    .sort((a, b) => a - b)
    .map((k) => [k, profileAt(prof.thigh, k * tEnd) + inf + extra(k * tEnd)]);
}

export type SkirtLength = "mini" | "short" | "midi" | "long";

/** Cortes de una pollera (o la de un vestido): de la cintura (`from`) al ruedo, abriéndose hacia abajo. */
export function skirtRings(torso: Ring[], from: number, length: SkirtLength): Ring[] {
  const hip = ringAt(torso, 0.95);
  const waist = ringAt(torso, from);
  const hemY = length === "long" ? 0.13 : length === "midi" ? 0.42 : 0.66;
  const flare = length === "long" ? 0.13 : length === "midi" ? 0.1 : 0.06;
  return [
    { y: hemY, rx: hip.rx + flare + 0.01, rz: hip.rz + flare * 0.9 + 0.01, z: hip.z },
    { y: (hemY + 0.9) / 2, rx: hip.rx + flare * 0.55 + 0.012, rz: hip.rz + flare * 0.5 + 0.012, z: hip.z },
    { y: 0.9, rx: hip.rx + 0.016, rz: hip.rz + 0.016, z: hip.z },
    { y: 0.95, rx: hip.rx + 0.012, rz: hip.rz + 0.012, z: hip.z },
    { y: from, rx: waist.rx + 0.01, rz: waist.rz + 0.01, z: waist.z },
  ];
}

/** Dónde empieza y termina la parte de arriba, y cuánta holgura tiene. */
export function topShape(sk: Skeleton, look: TopLook): { hem: number; top: number; inflate: number; flare: number } {
  // Los cuellos comunes (redondo, en V, henley, bote) abrazan la base del cuello, como en una remera
  // de verdad; los demás (camisero, chomba, polera, capucha) arrancan un poco más abajo.
  const crew = look.neck === "round" || look.neck === "v" || look.neck === "henley" || look.neck === "boat";
  const neckTop = crew && look.sleeves !== "none" ? CREW_TOP : 1.468;
  const fit = topFit(look);
  switch (look.cut) {
    case "crop":
      return { hem: 1.13, top: look.sleeves === "none" ? 1.4 : neckTop, ...fit };
    case "bra":
      return { hem: 1.19, top: 1.37, ...fit };
    case "swimsuit":
      return { hem: sk.crotchY, top: 1.38, ...fit };
    default: {
      // Sin mangas pero sin tiras (chaleco tejido): llega hasta el cuello y deja la sisa abierta.
      const top = look.sleeves === "none" && look.neck === "straps" ? (look.dress !== "none" ? 1.39 : 1.4) : neckTop;
      if (look.dress !== "none") return { hem: 0.97, top, ...fit };
      // Metida adentro del pantalón (con cinturón): termina apenas debajo de la cintura, sin vuelo.
      if (look.tucked) return { hem: 0.985, top, inflate: fit.inflate, flare: 0 };
      return { hem: topHem(sk, look, top, fit.inflate), top, ...fit };
    }
  }
}

/** Altura del borde de arriba de una remera de cuello redondo: la base del cuello. */
export const CREW_TOP = 1.488;

/**
 * Dónde termina la remera: lo que se midió en la foto (largo comparado con el ancho del pecho) o
 * según su largo y lo ancha que es (las oversize son más largas). Un talle más grande cuelga más
 * largo (y uno más chico queda más corto).
 */
function topHem(sk: Skeleton, look: TopLook, top: number, inflate: number): number {
  const ease = look.ease ?? 0;
  let hem: number;
  if (look.measured) {
    // Una remera común mide de largo 1,37 veces su ancho de pecho y en el avatar llega a 0,87 m.
    // Una oversize de verdad es bastante más ancha de pecho que lo que se dibuja (se vería inflada),
    // así que su largo se calcula con su ancho real.
    const real = { ajustado: 0.96, regular: 1, holgado: 1.08, "muy-holgado": 1.15 }[look.width ?? "regular"];
    const scale = (chestFlat(sk, inflate) / chestFlat(sk, 0.013)) * real;
    hem = top - (top - 0.87) * (look.measured.length / 1.37) * scale;
  } else {
    hem = 0.87 + { corto: 0.1, normal: 0, largo: -0.07 }[look.length ?? "normal"];
    hem += { ajustado: 0.01, regular: 0, holgado: -0.02, "muy-holgado": -0.045 }[look.width ?? "regular"];
  }
  return Math.min(1.02, Math.max(0.76, hem - 0.025 * ease));
}

/**
 * Capas de ropa: ensancha una prenda donde se superpone con las que van debajo (`under`), para
 * que siempre las tape. Sin esto, una pollera con vuelo asomaría por debajo del saco, o el
 * pantalón por la remera.
 */
export function layerOver(rings: Ring[], under: Ring[][], gap = 0.005): Ring[] {
  const layers = under.filter((u) => u.length > 1);
  if (!layers.length) return rings;
  const lo = rings[0].y;
  const hi = rings[rings.length - 1].y;
  // Cortes extra a la altura de los de abajo, para copiar bien su forma (sin amontonarlos).
  const extra: number[] = [];
  for (const y of layers.flatMap((u) => u.map((r) => r.y)).sort((a, b) => a - b)) {
    if (y <= lo + 0.005 || y >= hi - 0.005) continue;
    if (rings.some((r) => Math.abs(r.y - y) < 0.012) || extra.some((e) => Math.abs(e - y) < 0.012)) continue;
    extra.push(y);
  }
  const all = [...rings, ...extra.map((y) => ({ ...ringAt(rings, y), y }))].sort((a, b) => a.y - b.y);
  const touched = all.map(() => false);
  const out = all.map((r, i) => {
    let { rx, rz } = r;
    for (const u of layers) {
      if (r.y < u[0].y - 1e-6 || r.y > u[u.length - 1].y + 1e-6) continue;
      const b = ringAt(u, r.y);
      rx = Math.max(rx, b.rx + gap);
      rz = Math.max(rz, b.rz + Math.abs(b.z - r.z) + gap);
    }
    touched[i] = rx > r.rx + 1e-6 || rz > r.rz + 1e-6;
    return { ...r, rx, rz };
  });
  // Suaviza la zona ensanchada (solo agrandando, así sigue tapando): sin escalones que el
  // sombreado tipo dibujo animado marcaría como rayas.
  const near = touched.map((_, i) => touched.slice(Math.max(0, i - 2), i + 3).some(Boolean));
  for (let it = 0; it < 3; it++) {
    for (let i = 1; i < out.length - 1; i++) {
      if (!near[i]) continue;
      const a = out[i - 1];
      const b = out[i + 1];
      const t = (out[i].y - a.y) / (b.y - a.y || 1);
      out[i] = { ...out[i], rx: Math.max(out[i].rx, lerp(a.rx, b.rx, t)), rz: Math.max(out[i].rz, lerp(a.rz, b.rz, t)) };
    }
  }
  return out;
}

/**
 * Óvalos que envuelven las dos piernas (con la bola de la cadera y la de la rodilla) entre dos
 * alturas, con cierta holgura de tela. Sirve para que una remera o un abrigo que cuelgan sobre los
 * muslos los tapen: el muslo sale un poco hacia adelante del torso.
 */
export function legsEnvelope(sk: Skeleton, inflate: number, from: number, to: number, extra: (t: number) => number = () => 0): Ring[] {
  const l = sk.leg(1);
  const prof = limbProfiles(sk);
  const balls = jointBalls(sk, inflate);
  const cut = (ball: JointBall, y: number) => Math.sqrt(Math.max(0, ball.r ** 2 - (y - ball.at[1]) ** 2));
  const out: Ring[] = [];
  const steps = Math.max(2, Math.round((to - from) / 0.02));
  for (let i = 0; i <= steps; i++) {
    const y = from + ((to - from) * i) / steps;
    let cx: number;
    let cz: number;
    let r = Math.max(cut(balls.hip, y), cut(balls.knee, y));
    if (y <= l.hip[1] && y >= l.knee[1]) {
      const t = (l.hip[1] - y) / (l.hip[1] - l.knee[1]);
      cx = lerp(l.hip[0], l.knee[0], t);
      cz = lerp(l.hip[2], l.knee[2], t);
      r = Math.max(r, profileAt(prof.thigh, t) + inflate + extra(t));
    } else if (y < l.knee[1]) {
      const t = Math.min(1, (l.knee[1] - y) / (l.knee[1] - l.ankle[1]));
      cx = lerp(l.knee[0], l.ankle[0], t);
      cz = lerp(l.knee[2], l.ankle[2], t);
      r = Math.max(r, profileAt(prof.calf, t) + inflate);
    } else {
      cx = l.hip[0];
      cz = l.hip[2];
    }
    if (r <= 0) continue;
    // El óvalo más chico (de este ancho) que contiene al círculo de cada pierna.
    const rx = cx + r + 0.012;
    let rz = r;
    for (let k = 0; k <= 24; k++) {
      const th = (Math.PI * k) / 24;
      const x = cx + r * Math.cos(th);
      const z = r * Math.sin(th);
      rz = Math.max(rz, z / Math.sqrt(Math.max(1e-6, 1 - (x / rx) ** 2)));
    }
    out.push({ y, rx, rz, z: cz });
  }
  return out;
}

/** Cuerpo de la parte de abajo: el pantalón (o short, o ropa interior) hasta la entrepierna, o la pollera. */
export function bottomShell(sk: Skeleton, look: BottomLook): Ring[] {
  if (look.kind === "skirt") return skirtRings(sk.torso, 1.02, look.length);
  return shellRings(sk.torso, bottomInflate(look), sk.crotchY, look.kind === "brief" ? 0.96 : 1.02);
}

/** Si la parte de arriba se ensancha en los hombros (las que tienen mangas los tapan). */
export function topCoversShoulders(look: TopLook): boolean {
  return look.sleeves !== "none" && look.cut !== "bra" && look.cut !== "swimsuit";
}

/** Cuerpo de la parte de arriba, por encima de lo que tenga abajo. */
export function topShell(sk: Skeleton, look: TopLook, under: Ring[][] = []): Ring[] {
  const shape = topShape(sk, look);
  const base = topCoversShoulders(look)
    ? garmentRings(sk, shape.inflate, shape.hem, shape.top, shape.flare)
    : shellRings(sk.torso, shape.inflate, shape.hem, shape.top, shape.flare);
  return layerOver(base, under);
}

/** Grosor del ruedo de la parte de arriba (elastizado en buzos y sweaters). */
export function topHemTube(look: Pick<TopLook, "ribbed">): number {
  return look.ribbed ? 0.01 : 0.004;
}

/**
 * Lo que ocupa la parte de arriba con sus detalles (ruedo, botones, bolsillo canguro), para que
 * el abrigo de encima los tape también y no asomen a través de él.
 */
export function topEnvelope(look: TopLook, rings: Ring[]): Ring[] {
  const hasHemBand = look.cut !== "swimsuit" && look.dress === "none";
  const tube = hasHemBand ? topHemTube(look) : 0;
  const hem = rings[0];
  const extraYs = [hem.y + tube * 1.2, ...(look.pocket ? [0.94, 1.06] : [])];
  const all = [...rings, ...extraYs.map((y) => ({ ...ringAt(rings, y), y }))].sort((a, b) => a.y - b.y);
  const neckY = rings[rings.length - 1].y;
  const out = all.map((r) => {
    let { rx, rz } = r;
    if (look.buttons > 0) rz += 0.006;
    // Cordones de la capucha y el borde del escote en V, que van por encima de la tela.
    if (look.drawstring && r.y > neckY - 0.16) rz += 0.01;
    else if (look.neck === "v" && r.y > neckY - 0.2) rz += 0.005;
    if (look.pocket && r.y >= 0.94 - 1e-6 && r.y <= 1.06 + 1e-6) rz += 0.01;
    if (r.y <= hem.y + tube * 1.2 + 1e-6) {
      rx += tube;
      rz += tube;
    }
    return { ...r, rx, rz };
  });
  // El ruedo cuelga también un poquito por debajo de la tela.
  return tube > 0 ? [{ ...out[0], y: hem.y - tube }, ...out] : out;
}

/** Cuerpo del abrigo, por encima de todo lo demás. El tapado se abre como una pollera hasta las rodillas. */
export function outerShell(sk: Skeleton, look: OuterLook, under: Ring[][] = []): Ring[] {
  const { hem, inflate, flare } = outerFit(look.kind);
  let base: Ring[];
  if (look.kind === "cape") base = capeRings(sk, hem, inflate, flare);
  else if (look.kind !== "coat") base = garmentRings(sk, inflate, hem, 1.48, flare);
  else {
    const body = garmentRings(sk, inflate, 0.9, 1.48, 0);
    const hip = body[0];
    base = [
      { y: hem, rx: hip.rx + flare, rz: hip.rz + flare * 0.9, z: hip.z },
      { y: 0.7, rx: hip.rx + flare * 0.5, rz: hip.rz + flare * 0.45, z: hip.z },
      ...body,
    ];
  }
  return layerOver(base, under, 0.007);
}

/**
 * Poncho o capa: cae desde el cuello como un cono y envuelve los brazos (no tiene mangas). En cada
 * altura queda por fuera del cuerpo y de los brazos, y nunca se angosta al bajar.
 */
function capeRings(sk: Skeleton, hem: number, inflate: number, flare: number): Ring[] {
  const a = sk.arm(1);
  const pr = limbProfiles(sk);
  // Borde de afuera del brazo a cierta altura.
  const armOut = (y: number) => {
    if (y >= a.elbow[1]) {
      const t = Math.min(1, Math.max(0, (a.shoulder[1] - y) / (a.shoulder[1] - a.elbow[1])));
      return lerp(a.shoulder[0], a.elbow[0], t) + profileAt(pr.upperArm, t);
    }
    const t = Math.min(1, Math.max(0, (a.elbow[1] - y) / (a.elbow[1] - a.wrist[1])));
    return lerp(a.elbow[0], a.wrist[0], t) + profileAt(pr.forearm, t);
  };
  const sx = a.shoulder[0];
  const ys = [hem, 0.88, 0.98, 1.08, 1.18, 1.28, 1.36];
  const body = ys.map((y) => {
    const t = ringAt(sk.torso, Math.max(y, sk.torso[0].y + 0.03));
    const drop = Math.max(0, 1.36 - y);
    return {
      y,
      rx: Math.max(t.rx + inflate, armOut(y) + 0.035) + flare * drop,
      rz: t.rz + inflate + 0.03 + flare * drop * 0.8,
      z: t.z,
    };
  });
  // De arriba hacia abajo, cada corte al menos tan ancho como el de arriba (forma de cono).
  for (let i = body.length - 2; i >= 0; i--) {
    body[i].rx = Math.max(body[i].rx, body[i + 1].rx);
    body[i].rz = Math.max(body[i].rz, body[i + 1].rz);
  }
  const shoulder = { y: 1.41, rx: sx + sk.deltoid + inflate, rz: ringAt(sk.torso, 1.41).rz + inflate + 0.02, z: 0 };
  return [
    ...body,
    shoulder,
    { y: 1.445, rx: lerp(shoulder.rx, 0.11, 0.5), rz: lerp(shoulder.rz, 0.1, 0.5), z: -0.004 },
    { y: 1.48, rx: 0.1, rz: 0.09, z: -0.008 },
  ];
}

/** Cuánto se abre una pollera por fuera de la cadera a la altura de las manos. */
function skirtRoomAtHands(length: SkirtLength): number {
  // La forma de la pollera depende solo de la cadera: con un torso cualquiera alcanza para medirla.
  const probe: Ring[] = [
    { y: 0.8, rx: 0.15, rz: 0.1, z: 0 },
    { y: 1.2, rx: 0.15, rz: 0.1, z: 0 },
  ];
  const rings = skirtRings(probe, 1.02, length);
  let max = 0;
  for (let y = 0.72; y <= 0.9; y += 0.03) max = Math.max(max, ringAt(rings, y).rx - 0.15);
  return max;
}

/** Lugar que necesitan los brazos con esta ropa puesta (ver ArmRoom). */
export function armRoom(look: Look, worn?: TopLook): ArmRoom {
  const gap = 0.004;
  // La remera que lleva puesta (con lo que se midió en la foto, si se pasa).
  const top = worn ?? wornTop(look);
  const fit = topFit(top);
  // Una manga más ancha (oversize) también aparta un poco el brazo.
  let torso = fit.inflate + Math.max(0, sleeveInflate(top) - 0.012) + gap;
  // A la altura de las manos: el ruedo de la remera (si llega), el pantalón o la pollera.
  let hips = top.cut === "normal" || top.cut === "swimsuit" ? fit.inflate + fit.flare + gap : gap;
  if (top.dress !== "none") hips = Math.max(hips, skirtRoomAtHands(top.dress) + gap);
  const bottom = wornBottom(look);
  if (bottom) {
    hips = Math.max(hips, bottom.kind === "skirt" ? skirtRoomAtHands(bottom.length) + gap : bottomInflate(bottom) + gap);
  }
  if (look.outerwear && look.outerwear.kind !== "cape") {
    const o = outerFit(look.outerwear.kind);
    // El abrigo engorda el cuerpo y también el brazo (la manga).
    torso = Math.max(torso, o.inflate + o.sleeve + gap);
    hips = Math.max(hips, o.inflate + o.flare * (o.hem < 0.7 ? 0.35 : 1) + o.sleeve + gap);
  }
  const cap = 0.075;
  return { torso: Math.min(cap, torso), hips: Math.min(cap, Math.max(hips, ARM_ROOM.hips * 0.5)) };
}

/** Óvalo del torso a cierta altura (interpolado entre los cortes). */
export function ringAt(rings: Ring[], y: number): Ring {
  if (y <= rings[0].y) return rings[0];
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1];
    const b = rings[i];
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return { y, rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), z: lerp(a.z, b.z, t) };
    }
  }
  return rings[rings.length - 1];
}

/**
 * Cortes de una prenda que va sobre el torso: el cuerpo "inflado" (holgura) entre dos alturas.
 * `flare` abre el ruedo (remera suelta, abrigo).
 */
export function shellRings(rings: Ring[], inflate: number, from: number, to: number, flare = 0): Ring[] {
  const inside = rings.filter((r) => r.y > from + 1e-6 && r.y < to - 1e-6);
  const cut = [ringAt(rings, from), ...inside, ringAt(rings, to)];
  // Si la prenda llega hasta el fondo del cuerpo (calza, malla, bombacha), cierra un poco más abajo
  // que la piel: si las dos tapas quedaran a la misma altura, la piel "titila" a través de la tela.
  const bottom = from <= rings[0].y + 1e-6;
  return cut.map((r, i) => {
    const extra = i === 0 ? flare : i === 1 ? flare * 0.35 : 0;
    const y = i === 0 && bottom ? rings[0].y - inflate : r.y;
    return { y, rx: r.rx + inflate + extra, rz: r.rz + inflate + extra * 0.8, z: r.z };
  });
}

/**
 * Igual que shellRings, pero a la altura de los hombros la prenda se ensancha hasta cubrir el hombro
 * (como una remera de verdad), así la manga sale del borde y no queda una "bola" al costado.
 */
export function garmentRings(sk: Skeleton, inflate: number, from: number, to: number, flare = 0): Ring[] {
  const base = shellRings(sk.torso, inflate, from, to, flare);
  const sx = Math.abs(sk.arm(1).shoulder[0]);
  const reach = sx + sk.deltoid * 0.55 + inflate;
  // Cortes extra en la zona del hombro para que la forma sea suave.
  const ys = [1.33, 1.36, 1.39, 1.415, 1.44].filter((y) => y > from + 0.01 && y < to - 0.01);
  const all = [...base, ...ys.map((y) => ({ ...ringAt(base, y), y }))].sort((a, b) => a.y - b.y);
  return all.map((r) => {
    // Peso de 0 a 1: máximo a la altura del hombro, se desvanece arriba y abajo.
    const t = Math.max(0, 1 - Math.abs(r.y - 1.395) / 0.065);
    const w = t * t * (3 - 2 * t);
    return { ...r, rx: Math.max(r.rx, r.rx + (reach - r.rx) * w) };
  });
}

/** Curvas de grosor de brazos y piernas: [t de 0 a 1 entre las dos articulaciones, radio]. */
export function limbProfiles(sk: Pick<Skeleton, "armR" | "legR">) {
  const a = sk.armR;
  const l = sk.legR;
  return {
    upperArm: [
      [0, a.top],
      [0.18, a.top * 1.02],
      [0.5, a.top * 0.9],
      [0.85, a.elbow * 1.02],
      [1, a.elbow],
    ] as [number, number][],
    forearm: [
      [0, a.elbow],
      [0.2, a.forearm],
      [0.55, a.forearm * 0.86],
      [0.88, a.wrist * 1.04],
      [1, a.wrist],
    ] as [number, number][],
    thigh: [
      [0, l.thigh],
      [0.15, l.thigh * 0.97],
      [0.5, l.thigh * 0.82],
      [0.85, l.knee * 1.12],
      [1, l.knee],
    ] as [number, number][],
    calf: [
      [0, l.knee],
      [0.2, l.calf],
      [0.42, l.calf * 0.92],
      [0.75, l.ankle * 1.15],
      [1, l.ankle],
    ] as [number, number][],
  };
}

/**
 * Cuánto más grande que la boca del tubo es la bola de cada articulación. Las bolas tapan el
 * borde abierto de brazos, piernas, mangas y botamangas; si fueran apenas más chicas quedaría
 * una ranura por la que se ve la piel (o el interior) al mirar de arriba. El 3 % de más cubre
 * también la diferencia entre los polígonos de la esfera y los del tubo.
 */
export const JOINT_COVER = 1.03;

export interface JointBall {
  at: V3;
  r: number;
}

/**
 * Bolas de las articulaciones del lado derecho (hombro, codo, muñeca, cadera, rodilla, tobillo).
 * Con `inflate` > 0 son las de la ropa que va encima: el mismo centro, así siempre envuelven a la piel.
 */
export function jointBalls(sk: Skeleton, inflate = 0) {
  const a = sk.arm(1);
  const l = sk.leg(1);
  const cover = (r: number) => (r + inflate) * JOINT_COVER;
  // El hombro va un poco más abajo que la articulación (redondea mejor el deltoides); el radio se
  // agranda lo justo para que, a la altura de la boca del brazo, siga tapándola.
  const drop = 0.004;
  return {
    shoulder: { at: [a.shoulder[0], a.shoulder[1] - drop, a.shoulder[2]] as V3, r: Math.hypot(cover(sk.armR.top), drop) },
    elbow: { at: a.elbow, r: cover(sk.armR.elbow) },
    wrist: { at: a.wrist, r: cover(sk.armR.wrist) },
    hip: { at: l.hip, r: cover(sk.legR.thigh) },
    knee: { at: l.knee, r: cover(sk.legR.knee) },
    ankle: { at: l.ankle, r: cover(sk.legR.ankle) },
  } satisfies Record<string, JointBall>;
}

/** Radio de un perfil en cierto t (interpolación lineal entre sus puntos). */
export function profileAt(profile: [number, number][], t: number): number {
  if (t <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [t0, r0] = profile[i - 1];
    const [t1, r1] = profile[i];
    if (t <= t1) return lerp(r0, r1, (t - t0) / (t1 - t0));
  }
  return profile[profile.length - 1][1];
}

/**
 * Perfil de una prenda que va sobre un tramo del cuerpo: el mismo grosor que la piel + holgura,
 * recortado entre t0 y t1 (así nunca queda más finita que la piel y no "asoma" el cuerpo).
 */
export function clothProfile(skin: [number, number][], inflate: number, t0 = 0, t1 = 1, end?: number): [number, number][] {
  const ts = [t0, ...skin.map((p) => p[0]).filter((t) => t > t0 + 1e-6 && t < t1 - 1e-6), t1];
  return ts.map((t, i) => {
    const r = profileAt(skin, t) + inflate;
    const k = (t - t0) / (t1 - t0 || 1);
    return [k, i === ts.length - 1 && end !== undefined ? Math.max(r, end) : r];
  });
}

/**
 * Recorrido de una tira (musculosa, corpiño, malla) del lado derecho: sale del borde de adelante
 * de la prenda (`ring`), pasa por arriba del hombro y baja por la espalda, apoyada sobre la piel.
 * Se calcula con rayos desde adentro del cuerpo, de adelante (0) a atrás (π) pasando por arriba:
 * cada rayo encuentra la piel y la tira (de radio `r`) va justo encima.
 */
export function strapPath(sk: Skeleton, ring: Ring, r: number, n = 24): V3[] {
  const x0 = Math.min(ring.rx * 0.55, 0.078);
  const xTop = 0.1;
  const y0 = ring.y - 0.006;
  const z0 = ringAt(sk.torso, y0).z;
  const off = r + 0.0025;
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * i) / n;
    const dz = Math.cos(th);
    const dy = Math.sin(th);
    const x = xTop + (x0 - xTop) * dz * dz;
    let lo = 0;
    let hi = 0.3;
    for (let k = 0; k < 28; k++) {
      const mid = (lo + hi) / 2;
      if (insideTorso(sk, x, y0 + dy * mid, z0 + dz * mid)) lo = mid;
      else hi = mid;
    }
    pts.push([x, y0 + dy * (lo + off), z0 + dz * (lo + off)]);
  }
  return pts;
}

/** Si un punto queda adentro del torso. */
export function insideTorso(sk: Skeleton, x: number, y: number, z: number): boolean {
  const rings = sk.torso;
  if (y < rings[0].y || y > rings[rings.length - 1].y) return false;
  const b = ringAt(rings, y);
  return (x / b.rx) ** 2 + ((z - b.z) / b.rz) ** 2 < 1;
}
