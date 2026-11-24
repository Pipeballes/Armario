// Procesamiento de fotos en el navegador: achicar y detectar el color principal.

import { COLORS } from "./catalog";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la foto."));
    };
    img.src = url;
  });
}

/** Achica la foto para que ocupe poco y devuelve un data URL JPEG. */
export async function resizePhoto(file: File, maxSide = 900): Promise<{ dataUrl: string; canvas: HTMLCanvasElement }> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.8), canvas };
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Distancia de color con peso perceptual ("redmean").
function distance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function nearestColorId(rgb: RGB): string {
  let best = COLORS[0];
  let bestD = Infinity;
  for (const c of COLORS) {
    const d = distance(rgb, hexToRgb(c.hex));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.id;
}

/**
 * Adivina el color de la prenda: mira el centro de la foto, descarta lo que se parece
 * al fondo (los bordes) y se queda con el color más repetido.
 */
export function guessColor(canvas: HTMLCanvasElement): string {
  const size = 64;
  const small = document.createElement("canvas");
  small.width = size;
  small.height = size;
  const ctx = small.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const px = (x: number, y: number): RGB => {
    const i = (y * size + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Fondo = promedio de los bordes.
  const border: RGB[] = [];
  for (let i = 0; i < size; i++) border.push(px(i, 0), px(i, size - 1), px(0, i), px(size - 1, i));
  const bg = border
    .reduce<RGB>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
    .map((v) => v / border.length) as RGB;

  const buckets = new Map<string, { sum: RGB; count: number }>();
  const from = Math.floor(size * 0.2);
  const to = Math.ceil(size * 0.8);
  for (let y = from; y < to; y++) {
    for (let x = from; x < to; x++) {
      const p = px(x, y);
      if (distance(p, bg) < 60) continue;
      const key = p.map((v) => v >> 5).join(",");
      const b = buckets.get(key) ?? { sum: [0, 0, 0], count: 0 };
      b.sum = [b.sum[0] + p[0], b.sum[1] + p[1], b.sum[2] + p[2]];
      b.count++;
      buckets.set(key, b);
    }
  }
  const kept = [...buckets.values()].reduce((acc, b) => acc + b.count, 0);
  const total = (to - from) * (to - from);
  // Si casi todo el centro se parece al fondo (ej: remera blanca sobre fondo claro),
  // la prenda es de ese mismo tono: usar el promedio del centro.
  if (kept < total * 0.15) {
    const sum: RGB = [0, 0, 0];
    for (let y = from; y < to; y++)
      for (let x = from; x < to; x++) {
        const p = px(x, y);
        sum[0] += p[0];
        sum[1] += p[1];
        sum[2] += p[2];
      }
    return nearestColorId(sum.map((v) => v / total) as RGB);
  }
  const top = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  return nearestColorId(top.sum.map((v) => v / top.count) as RGB);
}

/** Una sombra es el mismo color del fondo pero más oscuro (todos los canales bajan parecido). */
function isShadow(p: RGB, bg: RGB): boolean {
  const lp = p[0] + p[1] + p[2];
  const lb = bg[0] + bg[1] + bg[2] || 1;
  const k = lp / lb;
  if (k < 0.4 || k > 1) return false;
  return Math.abs(p[0] - bg[0] * k) < 14 && Math.abs(p[1] - bg[1] * k) < 14 && Math.abs(p[2] - bg[2] * k) < 14;
}

/** Color del fondo limpio que se pone detrás de la prenda. */
export const CLEAN_BG: RGB = [244, 241, 236];

/**
 * Quita el fondo liso: lo "pinta" desde los bordes hacia adentro mientras el color se parezca
 * al del borde, y lo reemplaza por un fondo claro parejo. Devuelve null si el fondo no es liso
 * (se sacó muy poco o casi todo), para no arruinar la foto.
 */
export function cleanBackground(canvas: HTMLCanvasElement): string | null {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const at = (i: number): RGB => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];

  // Color del fondo = promedio del borde.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const bg = border
    .reduce<RGB>((acc, i) => { const p = at(i); return [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]]; }, [0, 0, 0])
    .map((v) => v / border.length) as RGB;
  // Si el borde es muy variado, no es un fondo liso.
  const spread = border.reduce((n, i) => n + distance(at(i), bg), 0) / border.length;
  if (spread > 55) return null;

  const tol = Math.max(45, spread * 2.2);
  const isBg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const i of border) {
    if (!isBg[i] && distance(at(i), bg) < tol) {
      isBg[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    const neighbors = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of neighbors) {
      if (j < 0 || isBg[j]) continue;
      // Se compara con el fondo y con el vecino, así sigue sombras suaves sin "comerse" la prenda.
      const pj = at(j);
      if ((distance(pj, bg) < tol || isShadow(pj, bg)) && distance(pj, at(i)) < 28) {
        isBg[j] = 1;
        queue[tail++] = j;
      }
    }
  }
  const ratio = tail / (w * h);
  if (ratio < 0.05 || ratio > 0.92) return null;

  // Pintar el fondo, suavizando el borde de la prenda.
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) {
      d[i * 4] = CLEAN_BG[0];
      d[i * 4 + 1] = CLEAN_BG[1];
      d[i * 4 + 2] = CLEAN_BG[2];
    } else {
      const x = i % w;
      const edge =
        (x > 0 && isBg[i - 1]) || (x < w - 1 && isBg[i + 1]) || (i >= w && isBg[i - w]) || (i < w * (h - 1) && isBg[i + w]);
      if (edge) for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.round((d[i * 4 + c] + CLEAN_BG[c]) / 2);
    }
  }
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.putImageData(img, 0, 0);
  return out.toDataURL("image/jpeg", 0.85);
}
