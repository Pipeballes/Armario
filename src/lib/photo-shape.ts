// Medidas de la prenda a partir de su foto: en un short o un pantalón, el ancho de la cintura,
// dónde se separan las piernas (el tiro), el largo de la entrepierna y la boca de la pierna; en una
// remera, el ancho del pecho, el largo, cuánto salen las mangas y lo ancha que es su boca. Así cada
// prenda sale con su forma de verdad, no todas iguales.

import { backgroundMask, uprightGarment } from "./print-decal";
import type { PantsMeasured, TopMeasured } from "./look";
import type { GarmentFit } from "./types";

export interface BottomMeasure {
  /** Ancho de la cintura (en píxeles de la foto enderezada). */
  waist: number;
  /** Del borde de arriba a la entrepierna, y de la entrepierna al ruedo. */
  rise: number;
  inseam: number;
  /** Ancho de cada pierna en el ruedo (promedio de las dos). */
  opening: number;
  /** Ancho de cada pierna justo debajo de la entrepierna (el muslo) y a mitad de camino (la rodilla). */
  thigh: number;
  knee: number;
}

/** El valor del medio de una lista (0 si está vacía). */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Tramos de prenda en una fila de la máscara (de dónde a dónde), sin los muy chiquitos. */
function runs(mask: Uint8Array, w: number, y: number, minLen: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && mask[y * w + x] === 1;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      if (x - start >= minLen) out.push([start, x]);
      start = -1;
    }
  }
  return out;
}

/**
 * Mide la silueta de una parte de abajo en una máscara (1 = prenda). La cintura es el ancho de
 * arriba; la entrepierna, la fila más alta desde donde las piernas siguen separadas hasta abajo.
 * Devuelve null si la silueta no se parece a un short o pantalón.
 */
export function measureBottomMask(mask: Uint8Array, w: number, h: number): BottomMeasure | null {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h && top < 0; y++) if (runs(mask, w, y, 2).length) top = y;
  for (let y = h - 1; y >= 0 && bottom < 0; y--) if (runs(mask, w, y, 2).length) bottom = y;
  if (top < 0 || bottom - top < 10) return null;
  const height = bottom - top + 1;
  // Cintura: el ancho más común en el 8 % de arriba.
  const widths: number[] = [];
  for (let y = top; y <= top + Math.max(1, Math.round(height * 0.08)); y++) {
    const r = runs(mask, w, y, 2);
    if (r.length) widths.push(r[r.length - 1][1] - r[0][0]);
  }
  widths.sort((a, b) => a - b);
  const waist = widths[Math.floor(widths.length / 2)] ?? 0;
  if (waist < 10) return null;
  const minLeg = Math.max(2, Math.round(waist * 0.12));
  const minGap = Math.max(2, Math.round(waist * 0.02));
  // De abajo hacia arriba, mientras haya dos piernas separadas.
  const twoLegs = (y: number) => {
    const r = runs(mask, w, y, minLeg);
    if (r.length < 2) return null;
    const a = r[0];
    const b = r[r.length - 1];
    return b[0] - a[1] >= minGap ? [a, b] : null;
  };
  let crotch = -1;
  let misses = 0;
  for (let y = bottom - Math.round(height * 0.02); y > top; y--) {
    if (twoLegs(y)) {
      crotch = y;
      misses = 0;
    } else if (++misses > 2) break;
  }
  if (crotch < 0) return null;
  // Boca de la pierna: unas filas arriba del ruedo, para no medir el borde.
  const openings: number[] = [];
  for (let y = bottom - Math.round(height * 0.06); y >= bottom - Math.round(height * 0.12) && y > crotch; y--) {
    const legs = twoLegs(y);
    if (legs) openings.push((legs[0][1] - legs[0][0] + legs[1][1] - legs[1][0]) / 2);
  }
  if (!openings.length) return null;
  // Ancho de una pierna a cierta altura de la entrepierna (0 = arriba, 1 = ruedo), con unas filas alrededor.
  const legAt = (k: number) => {
    const y0 = Math.round(crotch + (bottom - crotch) * k);
    const ws: number[] = [];
    for (let y = y0 - 2; y <= y0 + 2; y++) {
      const legs = y > crotch && y < bottom ? twoLegs(y) : null;
      if (legs) ws.push((legs[0][1] - legs[0][0] + legs[1][1] - legs[1][0]) / 2);
    }
    return median(ws);
  };
  const opening = median(openings);
  const m = {
    waist,
    rise: crotch - top,
    inseam: bottom - crotch,
    opening,
    thigh: legAt(0.06) || opening,
    knee: legAt(0.45) || opening,
  };
  // Lo que no tiene sentido (piernas más anchas que la cintura entera, sin tiro) se descarta.
  if (m.rise < waist * 0.15 || m.opening > waist * 1.05 || m.opening < waist * 0.2) return null;
  return m;
}

/** Ancho de la cintura de un short, aplanado, en metros (talle M). */
const WAIST_FLAT = 0.4;

/**
 * Cómo se ve en el avatar: hasta dónde baja la pierna por el muslo (0 = cadera, 1 = rodilla) y el
 * radio de la boca de la pierna, a partir de las medidas de la foto.
 */
export function bottomShapeFromMeasure(m: BottomMeasure): { legT: number; hemR: number } {
  const inseam = (m.inseam / m.waist) * WAIST_FLAT;
  // En el avatar la entrepierna está a 0,855 m y la rodilla a 0,495 m (el muslo mide 0,385 m).
  const hemY = 0.855 - inseam;
  const legT = Math.min(1.6, Math.max(0.18, (0.88 - hemY) / 0.385));
  // La boca aplanada mide la mitad de la vuelta.
  const hemR = ((m.opening / m.waist) * WAIST_FLAT * 2) / (2 * Math.PI);
  return { legT: Math.round(legT * 100) / 100, hemR: Math.round(hemR * 1000) / 1000 };
}

export interface TopMeasure {
  /** Ancho del pecho, justo debajo de las axilas (en píxeles de la foto enderezada). */
  chest: number;
  /** Largo total, del hombro al ruedo. */
  length: number;
  /** Cuánto sale cada manga más allá del pecho (promedio de las dos). */
  sleeve: number;
  /** Boca de la manga aplanada (promedio de las dos). */
  opening: number;
  /** Ancho del ruedo. */
  hem: number;
}


/**
 * Mide la silueta de una remera (o camisa, o chomba) estirada en la foto: de abajo hacia arriba el
 * ancho se mantiene (el cuerpo) hasta que de golpe crece (empiezan las mangas): ahí están las
 * axilas. Devuelve null si no se parece a una remera de manga corta.
 */
export function measureTopMask(mask: Uint8Array, w: number, h: number): TopMeasure | null {
  const span: ([number, number] | null)[] = [];
  for (let y = 0; y < h; y++) {
    const r = runs(mask, w, y, 2);
    span.push(r.length ? [r[0][0], r[r.length - 1][1]] : null);
  }
  const width = (y: number) => (span[y] ? span[y]![1] - span[y]![0] : 0);
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h && top < 0; y++) if (span[y]) top = y;
  for (let y = h - 1; y >= 0 && bottom < 0; y--) if (span[y]) bottom = y;
  if (top < 0 || bottom - top < 20) return null;
  const H = bottom - top + 1;
  const rows = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const hem = median(rows(bottom - Math.round(H * 0.12), bottom - Math.round(H * 0.03)).map(width));
  if (hem < 10) return null;
  // Subiendo desde abajo: la axila es donde el ancho salta de golpe.
  const k = Math.max(2, Math.round(H * 0.02));
  let armpit = -1;
  for (let y = bottom - Math.round(H * 0.25); y > top + k; y--) {
    if (width(y) > width(y + k) * 1.1 + 2) {
      armpit = y + k;
      break;
    }
  }
  if (armpit < top + H * 0.12 || armpit > top + H * 0.6) return null;
  const chest = median(rows(armpit + Math.round(H * 0.03), armpit + Math.round(H * 0.08)).map(width));
  let maxSpan = 0;
  let left = w;
  let right = 0;
  for (const y of rows(top, armpit)) {
    if (!span[y]) continue;
    maxSpan = Math.max(maxSpan, width(y));
    left = Math.min(left, span[y]![0]);
    right = Math.max(right, span[y]![1]);
  }
  // Boca de la manga: cuánto mide de alto la manga un poquito antes de su punta.
  const inset = Math.max(2, Math.round(chest * 0.04));
  const tall = (x: number) => rows(top, armpit).filter((y) => mask[y * w + x] === 1).length;
  const opening = (tall(Math.min(w - 1, left + inset)) + tall(Math.max(0, right - 1 - inset))) / 2;
  const m = { chest, length: H, sleeve: (maxSpan - chest) / 2, opening, hem };
  // Lo que no tiene sentido (sin mangas, mangas largas, una persona en vez de la remera) se descarta.
  const r = { length: m.length / chest, sleeve: m.sleeve / chest, opening: m.opening / chest, hem: m.hem / chest };
  if (chest < 10 || r.length < 0.8 || r.length > 2 || r.sleeve < 0.03 || r.sleeve > 0.6) return null;
  if (r.opening < 0.12 || r.opening > 0.75 || r.hem < 0.75 || r.hem > 1.35) return null;
  return m;
}

/** Proporciones de la remera (todo comparado con el ancho del pecho), para el avatar. */
export function topShapeFromMeasure(m: TopMeasure): TopMeasured {
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return { length: round(m.length / m.chest), sleeve: round(m.sleeve / m.chest), opening: round(m.opening / m.chest), hem: round(m.hem / m.chest) };
}

const topCache = new Map<string, Promise<TopMeasured | null>>();

/** Mide la remera en su foto (una sola vez por foto y ajuste). */
export function measureTop(src: string, fit: GarmentFit | undefined): Promise<TopMeasured | null> {
  const key = `${hash(src)}|${JSON.stringify(fit ?? null)}`;
  let p = topCache.get(key);
  if (!p) {
    p = (async () => {
      const mask = await garmentMask(src, fit);
      if (!mask) return null;
      const m = measureTopMask(mask.mask, mask.w, mask.h);
      return m ? topShapeFromMeasure(m) : null;
    })().catch(() => null);
    topCache.set(key, p);
  }
  return p;
}

/** La silueta de la prenda en la foto (1 = prenda, 0 = fondo), ya enderezada. */
async function garmentMask(src: string, fit: GarmentFit | undefined): Promise<{ mask: Uint8Array; w: number; h: number } | null> {
  const g = await uprightGarment(src, fit, 300);
  if (!g) return null;
  const bgMask = backgroundMask(g.data.data, g.cw, g.ch, g.fabric, g.bg);
  const mask = new Uint8Array(g.cw * g.ch);
  for (let i = 0; i < mask.length; i++) mask[i] = bgMask[i] ? 0 : 1;
  return { mask, w: g.cw, h: g.ch };
}

/** Proporciones de un pantalón (todo comparado con el ancho de la cintura), para el avatar. */
export function pantsShapeFromMeasure(m: BottomMeasure): PantsMeasured {
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return { thigh: round(m.thigh / m.waist), knee: round(m.knee / m.waist), opening: round(m.opening / m.waist), inseam: round(m.inseam / m.waist) };
}

/** Lo que se mide de una parte de abajo: cómo queda un short (largo y boca) y las proporciones de un pantalón. */
export interface BottomShape {
  legT: number;
  hemR: number;
  pants: PantsMeasured;
}

const cache = new Map<string, Promise<BottomShape | null>>();

/** Huella corta de un texto largo (la foto en base64), para guardar la medida una vez por foto. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${s.length}-${(h >>> 0).toString(36)}`;
}

/** Mide la parte de abajo en su foto (una sola vez por foto y ajuste). */
export function measureBottom(src: string, fit: GarmentFit | undefined): Promise<BottomShape | null> {
  const key = `${hash(src)}|${JSON.stringify(fit ?? null)}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const g = await garmentMask(src, fit);
      if (!g) return null;
      const m = measureBottomMask(g.mask, g.w, g.h);
      return m ? { ...bottomShapeFromMeasure(m), pants: pantsShapeFromMeasure(m) } : null;
    })().catch(() => null);
    cache.set(key, p);
  }
  return p;
}
