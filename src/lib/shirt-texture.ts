// "Digitaliza" una prenda para el avatar: la prenda se dibuja de un solo color (el de la tela) y el
// estampado se recorta de la foto, se endereza y se le saca la tela de alrededor, como una calcomanía.

import type { GarmentFit } from "./types";

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

export const rgbToHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

const dist = (d: Uint8ClampedArray, i: number, c: RGB) =>
  Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Color más común en el borde de una imagen (la mediana de cada canal). */
export function borderColor(d: Uint8ClampedArray, w: number, h: number): RGB {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    r.push(d[i]);
    g.push(d[i + 1]);
    b.push(d[i + 2]);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }
  return [median(r), median(g), median(b)];
}

/**
 * Le saca a una imagen todo lo que se parece al color de la tela (queda transparente) y devuelve la
 * caja del dibujo [x0, y0, x1, y1]. Lo que está cerca del color de la tela queda semitransparente,
 * para bordes suaves. Devuelve null si no quedó dibujo.
 */
export function removeFabric(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  fabric: RGB,
): [number, number, number, number] | null {
  const hard = 55; // hasta acá es tela (sombras y arrugas incluidas)
  const soft = 110; // de acá para arriba es dibujo
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let solid = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dd = dist(d, i, fabric);
      let a = dd <= hard ? 0 : dd >= soft ? 1 : (dd - hard) / (soft - hard);
      // Sombras y arrugas: la misma tela, solo más oscura o más clara. Se detecta comparando el color
      // "sin el brillo"; un estampado negro sobre blanco es mucho más oscuro y no se confunde.
      const k = (d[i] + d[i + 1] + d[i + 2] + 1) / (fabric[0] + fabric[1] + fabric[2] + 1);
      if (k > 0.62 && k < 1.25) {
        const hue = Math.abs(d[i] / k - fabric[0]) + Math.abs(d[i + 1] / k - fabric[1]) + Math.abs(d[i + 2] / k - fabric[2]);
        if (hue < 45) a = Math.min(a, hue < 30 ? 0 : (hue - 30) / 15);
      }
      d[i + 3] = Math.round(d[i + 3] * a);
      if (a > 0.5) {
        solid++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  // Si casi no hay dibujo (puntitos sueltos), no hay estampado.
  if (x1 < x0 || solid < w * h * 0.01) return null;
  return [x0, y0, x1 + 1, y1 + 1];
}

/** Gira un punto (de la foto original) igual que se gira la foto para enderezarla. */
export function rotatePoint(x: number, y: number, w: number, h: number, angleDeg: number, size: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const dx = x - w / 2;
  const dy = y - h / 2;
  // Se gira la foto -angle (en contra del giro que tiene la prenda).
  return [dx * Math.cos(a) + dy * Math.sin(a) + size / 2, -dx * Math.sin(a) + dy * Math.cos(a) + size / 2];
}

/**
 * Tamaño real del estampado (enderezado) a partir de la caja recta que marca la IA sobre la foto torcida.
 * Una caja recta alrededor de un rectángulo girado es más grande: se deshace ese agrandamiento.
 */
export function unrotatedSize(bw: number, bh: number, angleDeg: number): [number, number] {
  const a = (Math.abs(angleDeg % 180) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const det = c * c - s * s;
  let pw = bw;
  let ph = bh;
  if (Math.abs(det) > 0.3) {
    pw = Math.abs((bw * c - bh * s) / det);
    ph = Math.abs((bh * c - bw * s) / det);
  }
  const floor = Math.min(bw, bh) * 0.5;
  return [Math.max(pw, floor), Math.max(ph, floor)];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la foto."));
    img.src = src;
  });
}

/**
 * Calcomanía del estampado: lo recorta de la foto con la caja de la IA, lo endereza y le saca la tela.
 * Devuelve también la proporción (ancho / alto) para no deformarlo al pegarlo.
 */
export async function buildPrintDecal(
  src: string,
  fit: GarmentFit,
): Promise<{ canvas: HTMLCanvasElement; aspect: number } | null> {
  if (!fit.print) return null;
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return null;

  const [bx0, by0, bx1, by1] = fit.print.box;
  const cx = ((bx0 + bx1) / 2) * W;
  const cy = ((by0 + by1) / 2) * H;
  // Margen, para no cortar el dibujo si la IA marca la caja un poco corta.
  const [pw0, ph0] = unrotatedSize((bx1 - bx0) * W, (by1 - by0) * H, fit.angle);
  const pw = pw0 * 1.2;
  const ph = ph0 * 1.2;

  // Recorte enderezado: la foto girada alrededor del centro del estampado.
  const scale = Math.min(1, 512 / Math.max(pw, ph));
  const cw = Math.max(8, Math.round(pw * scale));
  const ch = Math.max(8, Math.round(ph * scale));
  const cut = document.createElement("canvas");
  cut.width = cw;
  cut.height = ch;
  const ctx = cut.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(scale, scale);
  ctx.rotate((-fit.angle * Math.PI) / 180);
  ctx.drawImage(img, -cx, -cy);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const data = ctx.getImageData(0, 0, cw, ch);
  // Color de la tela alrededor del dibujo, con la luz real de la foto. Si el borde cae sobre el fondo
  // (muy distinto al color que dijo la IA), se usa el de la IA.
  const around = borderColor(data.data, cw, ch);
  const ai = hexToRgb(fit.fabric);
  const fabric =
    ai && Math.abs(around[0] - ai[0]) + Math.abs(around[1] - ai[1]) + Math.abs(around[2] - ai[2]) > 160 ? ai : around;
  const box = removeFabric(data.data, cw, ch, fabric);
  if (!box) return null;
  ctx.putImageData(data, 0, 0);

  // Se recorta justo al dibujo.
  const [x0, y0, x1, y1] = box;
  const out = document.createElement("canvas");
  out.width = Math.max(4, x1 - x0);
  out.height = Math.max(4, y1 - y0);
  out.getContext("2d")!.drawImage(cut, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { canvas: out, aspect: out.width / out.height };
}
