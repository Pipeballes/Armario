"use client";

// Calcula con la IA cómo está cada prenda en sus fotos (para vestir bien el avatar) y lo guarda.

import { AiUnavailable, analyzeFit } from "./ai";
import { urlToDataUrl } from "./image";
import { actions } from "./store";
import { fitVersionFor, type Garment, type GarmentFit } from "./types";

const pending = new Set<string>();

/** ¿Le falta el ajuste a alguna de sus fotos? */
const stale = (g: Garment, f: GarmentFit | undefined) => !f || (f.v ?? 0) < fitVersionFor(g.category);
export const needsFit = (g: Garment) => Boolean((g.photo && stale(g, g.fit?.front)) || (g.photoBack && stale(g, g.fit?.back)));

/**
 * Pide el ajuste de las fotos que no lo tienen y guarda la prenda. Devuelve true si cambió algo.
 * Si no hay IA (sin sesión o sin clave), no hace nada.
 */
export async function ensureFit(g: Garment): Promise<boolean> {
  if (!needsFit(g) || pending.has(g.id)) return false;
  pending.add(g.id);
  try {
    const what = { category: g.category, kind: g.kind };
    const analyze = (src: string) => urlToDataUrl(src, 1000).then((img) => analyzeFit(img, what));
    const [front, back] = await Promise.all([
      g.photo && stale(g, g.fit?.front) ? analyze(g.photo) : Promise.resolve(g.fit?.front),
      g.photoBack && stale(g, g.fit?.back) ? analyze(g.photoBack) : Promise.resolve(g.fit?.back),
    ]);
    await actions.saveGarment({ ...g, fit: { front, back } });
    return true;
  } catch (e) {
    if (!(e instanceof AiUnavailable)) console.warn("No se pudo acomodar la prenda", e);
    return false;
  } finally {
    pending.delete(g.id);
  }
}

/**
 * Acomoda varias prendas, de a una (para no gastar de golpe el cupo de la IA). Devuelve true si
 * cambió alguna.
 */
export async function ensureFits(garments: Garment[]): Promise<boolean> {
  let changed = false;
  for (const g of garments) if (await ensureFit(g)) changed = true;
  return changed;
}
