"use client";

// Calcula con la IA cómo está cada prenda en sus fotos (para vestir bien el avatar) y lo guarda.

import { AiUnavailable, analyzeFit } from "./ai";
import { urlToDataUrl } from "./image";
import { actions } from "./store";
import type { Garment } from "./types";

const pending = new Set<string>();

/** ¿Le falta el ajuste a alguna de sus fotos? */
export const needsFit = (g: Garment) => Boolean((g.photo && !g.fit?.front) || (g.photoBack && !g.fit?.back));

/**
 * Pide el ajuste de las fotos que no lo tienen y guarda la prenda. Devuelve true si cambió algo.
 * Si no hay IA (sin sesión o sin clave), no hace nada.
 */
export async function ensureFit(g: Garment): Promise<boolean> {
  if (!needsFit(g) || pending.has(g.id)) return false;
  pending.add(g.id);
  try {
    const [front, back] = await Promise.all([
      g.photo && !g.fit?.front ? urlToDataUrl(g.photo, 800).then(analyzeFit) : Promise.resolve(g.fit?.front),
      g.photoBack && !g.fit?.back ? urlToDataUrl(g.photoBack, 800).then(analyzeFit) : Promise.resolve(g.fit?.back),
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
