// Medidas de la prenda a partir de su foto: en un short o un pantalón, el ancho de la cintura,
// dónde se separan las piernas (el tiro), el largo de la entrepierna y la boca de la pierna. Así
// cada short sale con su largo y su ancho de verdad, no todos iguales.

import { backgroundMask, uprightGarment } from "./print-decal";
import type { GarmentFit } from "./types";

export interface BottomMeasure {
  /** Ancho de la cintura (en píxeles de la foto enderezada). */
  waist: number;
  /** Del borde de arriba a la entrepierna, y de la entrepierna al ruedo. */
  rise: number;
  inseam: number;
  /** Ancho de cada pierna en el ruedo (promedio de las dos). */
  opening: number;
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
  openings.sort((a, b) => a - b);
  const m = { waist, rise: crotch - top, inseam: bottom - crotch, opening: openings[Math.floor(openings.length / 2)] };
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

const cache = new Map<string, Promise<{ legT: number; hemR: number } | null>>();

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
export function measureBottom(src: string, fit: GarmentFit | undefined): Promise<{ legT: number; hemR: number } | null> {
  const key = `${hash(src)}|${JSON.stringify(fit ?? null)}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const g = await uprightGarment(src, fit, 300);
      if (!g) return null;
      const bgMask = backgroundMask(g.data.data, g.cw, g.ch, g.fabric, g.bg);
      const mask = new Uint8Array(g.cw * g.ch);
      for (let i = 0; i < mask.length; i++) mask[i] = bgMask[i] ? 0 : 1;
      const m = measureBottomMask(mask, g.cw, g.ch);
      return m ? bottomShapeFromMeasure(m) : null;
    })().catch(() => null);
    cache.set(key, p);
  }
  return p;
}
