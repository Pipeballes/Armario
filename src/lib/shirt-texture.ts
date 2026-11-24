// Prepara la foto de una prenda para "vestir" el avatar: la endereza, la separa del fondo y recorta
// el cuerpo de la prenda (sin mangas ni fondo), para pegarlo en el torso.

import type { GarmentFit } from "./types";

export type RGB = [number, number, number];
type Rect = [number, number, number, number];

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

/** Color del fondo: la mediana de los bordes de la foto. */
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

/** Si el borde de la foto es de un solo color (fondo liso o ya limpiado), devuelve ese color. */
export function flatBackground(d: Uint8ClampedArray, w: number, h: number): RGB | null {
  const bg = borderColor(d, w, h);
  let near = 0;
  let total = 0;
  const check = (x: number, y: number) => {
    total++;
    if (dist(d, (y * w + x) * 4, bg) < 18) near++;
  };
  for (let x = 0; x < w; x += 2) {
    check(x, 0);
    check(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    check(0, y);
    check(w - 1, y);
  }
  return near / total > 0.85 ? bg : null;
}

/**
 * Color de la tela sin ayuda de la IA: lo más común en el centro de la foto que no se parece al fondo.
 * Se agrupan los colores en "cajitas" y gana la más llena.
 */
export function guessFabric(d: Uint8ClampedArray, w: number, h: number, bg: RGB): RGB | null {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = Math.floor(h * 0.25); y < h * 0.75; y++)
    for (let x = Math.floor(w * 0.25); x < w * 0.75; x++) {
      const i = (y * w + x) * 4;
      if (dist(d, i, bg) < 80) continue;
      const key = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += d[i];
      e.g += d[i + 1];
      e.b += d[i + 2];
      bins.set(key, e);
    }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of bins.values()) if (!best || e.n > best.n) best = e;
  return best && best.n > 10 ? [best.r / best.n, best.g / best.n, best.b / best.n] : null;
}

/**
 * Busca el cuerpo de la prenda (sin las mangas) en una foto ya enderezada.
 * Marca los píxeles del color de la tela y, fila por fila, mira de dónde a dónde va la prenda.
 * Las mangas solo ensanchan las filas de arriba, así que el ancho del cuerpo sale de la mitad de abajo.
 */
export function torsoRect(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  fabric: RGB,
  region: Rect = [0, 0, w, h],
  bg?: RGB,
): Rect | null {
  return torsoAnalysis(d, w, h, fabric, region, bg)?.rect ?? null;
}

/**
 * ¿Este píxel es de la prenda? Se parece al color de la tela y, si el fondo es liso
 * (por ejemplo, el fondo ya limpiado), no es el fondo.
 */
function isGarment(d: Uint8ClampedArray, i: number, fabric: RGB, bg?: RGB): boolean {
  return dist(d, i, fabric) < 90 && (!bg || dist(d, i, bg) > 22);
}

/**
 * Igual que torsoRect, y además cuánto se tuerce el cuerpo de la prenda (en grados, positivo = girada
 * en el sentido del reloj): si el centro de las filas de abajo se corre de costado, la prenda está torcida.
 */
export function torsoAnalysis(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  fabric: RGB,
  region: Rect = [0, 0, w, h],
  bg?: RGB,
): { rect: Rect; tilt: number } | null {
  const [rx0, ry0, rx1, ry1] = region.map(Math.round) as Rect;
  const rows: { y: number; l: number; r: number }[] = [];
  for (let y = Math.max(0, ry0); y < Math.min(h, ry1); y++) {
    let l = -1;
    let r = -1;
    let n = 0;
    for (let x = Math.max(0, rx0); x < Math.min(w, rx1); x++) {
      if (isGarment(d, (y * w + x) * 4, fabric, bg)) {
        if (l < 0) l = x;
        r = x;
        n++;
      }
    }
    if (n >= Math.max(3, (rx1 - rx0) * 0.08)) rows.push({ y, l, r });
  }
  if (rows.length < 8) return null;
  const top = rows[0].y;
  const bottom = rows[rows.length - 1].y;
  const lower = rows.filter((row) => row.y > top + (bottom - top) * 0.5);
  if (lower.length < 3) return null;
  const width = median(lower.map((row) => row.r - row.l));
  const cx = median(lower.map((row) => (row.l + row.r) / 2));
  if (width < 4) return null;
  const tilt = estimateTilt(d, w, h, fabric, region, bg);
  // Un poquito adentro, para no agarrar el borde ni el fondo.
  const inset = width * 0.04;
  return {
    rect: [cx - width / 2 + inset, top + (bottom - top) * 0.03, cx + width / 2 - inset, bottom - (bottom - top) * 0.02],
    tilt,
  };
}

/** Gira un punto (de la foto original) igual que se gira la foto para enderezarla. */
export function rotatePoint(x: number, y: number, w: number, h: number, angleDeg: number, size: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const dx = x - w / 2;
  const dy = y - h / 2;
  // Se gira la foto -angle (en contra del giro que tiene la prenda).
  return [dx * Math.cos(a) + dy * Math.sin(a) + size / 2, -dx * Math.sin(a) + dy * Math.cos(a) + size / 2];
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

export interface ShirtTexture {
  /** El cuerpo de la prenda, derecho y recortado. */
  canvas: HTMLCanvasElement;
  /** Color de la tela (para mangas y costados). */
  fabric: string;
}

/**
 * Endereza la foto, encuentra el cuerpo de la prenda y lo recorta.
 * Con el ajuste de la IA (giro, caja y color de tela) sale mucho mejor; sin él, se adivina.
 */
export async function buildShirtTexture(src: string, fit?: GarmentFit, hint?: string): Promise<ShirtTexture | null> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return null;
  const D = Math.ceil(Math.hypot(W, H));
  const S = 220;
  const k = S / D;

  /** Gira la foto (para enderezarla) en un lienzo cuadrado y devuelve también una copia chica para analizar. */
  const render = (angle: number) => {
    const rot = document.createElement("canvas");
    rot.width = rot.height = D;
    const rctx = rot.getContext("2d")!;
    rctx.translate(D / 2, D / 2);
    rctx.rotate((-angle * Math.PI) / 180);
    rctx.drawImage(img, -W / 2, -H / 2);
    const small = document.createElement("canvas");
    small.width = small.height = S;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(rot, 0, 0, S, S);
    return { rot, sctx, data: sctx.getImageData(0, 0, S, S).data };
  };

  /** Zona donde buscar: la caja de la IA girada igual que la foto (un poco más grande); si no, la foto entera. */
  const regionFor = (angle: number): Rect => {
    const [x0, y0, x1, y1] = fit?.box ?? [0, 0, 1, 1];
    const pts = [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ].map(([x, y]) => rotatePoint(x * W, y * H, W, H, angle, D));
    const xs = pts.map((p) => p[0] * k);
    const ys = pts.map((p) => p[1] * k);
    const pad = fit ? 0.04 * S : 0;
    return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  };

  let angle = fit?.angle ?? 0;
  let step = render(angle);

  // Fondo: si la foto original tiene el borde de un solo color (fondo liso o limpiado), se descarta ese color.
  const orig = document.createElement("canvas");
  orig.width = Math.min(160, W);
  orig.height = Math.max(1, Math.round((orig.width * H) / W));
  const octx0 = orig.getContext("2d", { willReadFrequently: true })!;
  octx0.drawImage(img, 0, 0, orig.width, orig.height);
  const origData = octx0.getImageData(0, 0, orig.width, orig.height).data;
  const flat = flatBackground(origData, orig.width, orig.height);
  const bgColor = flat ?? borderColor(origData, orig.width, orig.height);

  // Color de la tela: el de la IA; si no, el color cargado en la prenda; si no, se adivina.
  let fabric = fit ? hexToRgb(fit.fabric) : hint ? hexToRgb(hint) : null;
  if (!fabric) fabric = guessFabric(origData, orig.width, orig.height, bgColor);
  if (!fabric) return null;
  // Si la tela y el fondo son casi iguales y el fondo no es liso, no hay forma de separarlos.
  const flatBg = flat ?? undefined;

  // Se endereza de a poco: se mide cuánto sigue torcida y se corrige (hasta 3 veces).
  let found = torsoAnalysis(step.data, S, S, fabric, regionFor(angle), flatBg);
  for (let i = 0; i < 3 && found && Math.abs(found.tilt) > 1.5; i++) {
    const next = angle + found.tilt;
    const nextStep = render(next);
    const again = torsoAnalysis(nextStep.data, S, S, fabric, regionFor(next), flatBg);
    if (!again) break;
    angle = next;
    step = nextStep;
    found = again;
  }
  if (!found) return null;

  const [tx0, ty0, tx1, ty1] = found.rect.map((v) => v / k);
  const tw = tx1 - tx0;
  const th = ty1 - ty0;
  const out = document.createElement("canvas");
  out.width = 512;
  out.height = Math.max(64, Math.min(1024, Math.round((512 * th) / tw)));
  const octx = out.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;
  octx.drawImage(step.rot, tx0, ty0, tw, th, 0, 0, out.width, out.height);

  // El escote y los bordes pueden dejar ver un poco de fondo: se pinta con el color de la tela.
  // Solo el fondo que toca los bordes del recorte (un estampado está rodeado de tela y no se toca).
  if (Math.abs(bgColor[0] - fabric[0]) + Math.abs(bgColor[1] - fabric[1]) + Math.abs(bgColor[2] - fabric[2]) > 90) {
    const all = octx.getImageData(0, 0, out.width, out.height);
    const px = all.data;
    const ow = out.width;
    const oh = out.height;
    const seen = new Uint8Array(ow * oh);
    const isBg = (p: number) => dist(px, p * 4, bgColor) < 70 && dist(px, p * 4, fabric) > 90;
    const queue: number[] = [];
    const seed = (x: number, y: number) => {
      const p = y * ow + x;
      if (!seen[p] && isBg(p)) {
        seen[p] = 1;
        queue.push(p);
      }
    };
    for (let x = 0; x < ow; x++) seed(x, 0);
    for (let y = 0; y < oh; y++) {
      seed(0, y);
      seed(ow - 1, y);
    }
    while (queue.length) {
      const p = queue.pop()!;
      const x = p % ow;
      const y = (p - x) / ow;
      px[p * 4] = fabric[0];
      px[p * 4 + 1] = fabric[1];
      px[p * 4 + 2] = fabric[2];
      if (x > 0) seed(x - 1, y);
      if (x < ow - 1) seed(x + 1, y);
      if (y > 0) seed(x, y - 1);
      if (y < oh - 1) seed(x, y + 1);
    }
    octx.putImageData(all, 0, 0);
  }

  // Color real de la tela en la foto: promedio de lo que se parece al color pedido, cerca del ruedo.
  const sample = octx.getImageData(0, Math.round(out.height * 0.78), out.width, Math.round(out.height * 0.16)).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < sample.length; i += 16) {
    if (dist(sample, i, fabric) < 90) {
      r += sample[i];
      g += sample[i + 1];
      b += sample[i + 2];
      n++;
    }
  }
  const real: RGB = n > 20 ? [r / n, g / n, b / n] : fabric;
  return { canvas: out, fabric: rgbToHex(real) };
}

/**
 * Cuánto está torcida la prenda (grados, positivo = girada en el sentido del reloj).
 * Prueba ángulos y se queda con el que deja los costados del cuerpo más rectos y verticales:
 * en una prenda derecha, de la mitad para abajo los bordes izquierdo y derecho son líneas verticales.
 */
export function estimateTilt(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  fabric: RGB,
  region: Rect = [0, 0, w, h],
  bg?: RGB,
): number {
  const [rx0, ry0, rx1, ry1] = region.map(Math.round) as Rect;
  const px: number[] = [];
  const py: number[] = [];
  for (let y = Math.max(0, ry0); y < Math.min(h, ry1); y++)
    for (let x = Math.max(0, rx0); x < Math.min(w, rx1); x++)
      if (isGarment(d, (y * w + x) * 4, fabric, bg)) {
        px.push(x - w / 2);
        py.push(y - h / 2);
      }
  if (px.length < 50) return 0;
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let ymin = Infinity;
    let ymax = -Infinity;
    const ry = new Float32Array(px.length);
    const rx = new Float32Array(px.length);
    for (let i = 0; i < px.length; i++) {
      rx[i] = px[i] * c + py[i] * s;
      ry[i] = -px[i] * s + py[i] * c;
      if (ry[i] < ymin) ymin = ry[i];
      if (ry[i] > ymax) ymax = ry[i];
    }
    const from = ymin + (ymax - ymin) * 0.45;
    const to = ymin + (ymax - ymin) * 0.88;
    const rows = Math.max(1, Math.ceil(to - from));
    const lo = new Float32Array(rows).fill(Infinity);
    const hi = new Float32Array(rows).fill(-Infinity);
    for (let i = 0; i < px.length; i++) {
      if (ry[i] < from || ry[i] >= to) continue;
      const k = Math.floor(ry[i] - from);
      if (rx[i] < lo[k]) lo[k] = rx[i];
      if (rx[i] > hi[k]) hi[k] = rx[i];
    }
    const L: number[] = [];
    const R: number[] = [];
    for (let k = 0; k < rows; k++)
      if (Number.isFinite(lo[k])) {
        L.push(lo[k]);
        R.push(hi[k]);
      }
    if (L.length < 4) return Infinity;
    const variance = (xs: number[]) => {
      const m = xs.reduce((p, q) => p + q, 0) / xs.length;
      return xs.reduce((p, q) => p + (q - m) ** 2, 0) / xs.length;
    };
    return variance(L) + variance(R);
  };
  let best = 0;
  let bestScore = score(0);
  for (let deg = -40; deg <= 40; deg += 2) {
    const sc = score(deg);
    if (sc < bestScore - 1e-6) {
      best = deg;
      bestScore = sc;
    }
  }
  for (let deg = best - 1.5; deg <= best + 1.5; deg += 0.5) {
    const sc = score(deg);
    if (sc < bestScore - 1e-6) {
      best = deg;
      bestScore = sc;
    }
  }
  return best;
}
