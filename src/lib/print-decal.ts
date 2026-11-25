// "Digitaliza" una prenda para el avatar: la prenda se dibuja de un solo color (el de la tela) y el
// estampado se recorta de la foto, se endereza y se le saca la tela de alrededor, como una calcomanía.

import type { GarmentFit } from "./types";

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

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

export function loadImage(src: string): Promise<HTMLImageElement> {
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

// ───────────────────────── Estampado sin ayuda de la IA ─────────────────────────
// Si la prenda es estampada pero la IA no marcó dónde (o no hay IA), se mira la foto: se endereza la
// prenda, se separa la tela del dibujo y se decide si es un estampado suelto (se recorta y se pega
// donde está) o un dibujo por toda la tela (se usa un pedazo de la tela real de la foto).

/** Si un píxel es de la tela: parecido al color, o el mismo color con sombra o con luz. */
function isFabric(r: number, g: number, b: number, fabric: RGB): boolean {
  if (Math.abs(r - fabric[0]) + Math.abs(g - fabric[1]) + Math.abs(b - fabric[2]) < 70) return true;
  const sum = fabric[0] + fabric[1] + fabric[2];
  if (sum < 60) return r + g + b < 110; // tela casi negra: lo oscuro es tela
  // Sombra o brillo: los tres canales en la misma proporción que la tela.
  const k = (r + g + b) / sum;
  if (k < 0.45 || k > 1.25) return false;
  return Math.abs(r - fabric[0] * k) + Math.abs(g - fabric[1] * k) + Math.abs(b - fabric[2] * k) < 45;
}

/**
 * Fondo de la foto: lo transparente y lo parecido al color del fondo que está conectado con el
 * borde de la imagen (un gris claro en el borde de un logo no es fondo, aunque se parezca).
 */
export function backgroundMask(d: Uint8ClampedArray, w: number, h: number, fabric: RGB, bg: RGB | null): Uint8Array {
  const n = w * h;
  const bgLike = (p: number) => {
    const i = p * 4;
    if (d[i + 3] < 128) return true;
    if (!bg) return false;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 40 && Math.abs(r - fabric[0]) + Math.abs(g - fabric[1]) + Math.abs(b - fabric[2]) > 30;
  };
  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  const seed = (p: number) => {
    if (!isBg[p] && bgLike(p)) {
      isBg[p] = 1;
      queue[qt++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (qh < qt) {
    const p = queue[qh++];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < n - w) seed(p + w);
  }
  return isBg;
}

export interface PrintScan {
  /** Píxeles de dibujo y de prenda (tela + dibujo), sin contar el borde de la prenda. */
  ink: number;
  garment: number;
  /** Caja del dibujo [x0, y0, x1, y1] (sin los puntitos sueltos de las puntas) y la de la prenda. */
  box: [number, number, number, number] | null;
  garmentBox: [number, number, number, number] | null;
  /** En una grilla de 4×4 sobre la prenda: cuántas celdas tienen dibujo y cuántas se miraron. */
  cells: { inked: number; total: number };
}

/**
 * Recorre la prenda (ya derecha) y separa tela, dibujo y fondo. `bg` es el color del fondo (o null
 * si no hay), y lo transparente también cuenta como fondo. El borde de la prenda no se mira: ahí
 * se mezcla con el fondo y parecería dibujo.
 */
export function scanPrint(d: Uint8ClampedArray, w: number, h: number, fabric: RGB, bg: RGB | null): PrintScan {
  const n = w * h;
  const isGarment = new Uint8Array(n);
  const isInk = new Uint8Array(n);
  const isBg = backgroundMask(d, w, h, fabric, bg);
  let gx0 = w;
  let gy0 = h;
  let gx1 = -1;
  let gy1 = -1;
  for (let p = 0; p < n; p++) {
    if (isBg[p]) continue;
    const i = p * 4;
    if (d[i + 3] < 128) continue;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    isGarment[p] = 1;
    if (!isFabric(r, g, b, fabric)) isInk[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x < gx0) gx0 = x;
    if (x > gx1) gx1 = x;
    if (y < gy0) gy0 = y;
    if (y > gy1) gy1 = y;
  }
  // Adentro de la prenda = todo el cuadradito alrededor también es prenda (suma con imagen integral).
  const R = Math.max(2, Math.round(Math.min(w, h) * 0.025));
  const sum = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += isGarment[y * w + x];
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
    }
  }
  const full = (2 * R + 1) ** 2;
  const inside = (x: number, y: number) => {
    if (x < R || y < R || x >= w - R || y >= h - R) return false;
    const a = (y - R) * (w + 1) + (x - R);
    const b = (y - R) * (w + 1) + (x + R + 1);
    const c = (y + R + 1) * (w + 1) + (x - R);
    const e = (y + R + 1) * (w + 1) + (x + R + 1);
    return sum[e] - sum[b] - sum[c] + sum[a] === full;
  };
  const xs: number[] = [];
  const ys: number[] = [];
  let garment = 0;
  const cellInk = new Int32Array(16);
  const cellAll = new Int32Array(16);
  const gw = Math.max(1, gx1 - gx0 + 1);
  const gh = Math.max(1, gy1 - gy0 + 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!isGarment[p] || !inside(x, y)) continue;
      garment++;
      const cell = Math.min(3, Math.floor(((y - gy0) / gh) * 4)) * 4 + Math.min(3, Math.floor(((x - gx0) / gw) * 4));
      cellAll[cell]++;
      if (isInk[p]) {
        xs.push(x);
        ys.push(y);
        cellInk[cell]++;
      }
    }
  const pick = (a: number[], q: number) => {
    const sorted = [...a].sort((m, k) => m - k);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
  };
  const box: PrintScan["box"] = xs.length >= 12 ? [pick(xs, 0.02), pick(ys, 0.02), pick(xs, 0.98) + 1, pick(ys, 0.98) + 1] : null;
  let inked = 0;
  let total = 0;
  for (let c = 0; c < 16; c++) {
    if (cellAll[c] < 20) continue;
    total++;
    if (cellInk[c] / cellAll[c] > 0.04) inked++;
  }
  return { ink: xs.length, garment, box, garmentBox: gx1 >= 0 ? [gx0, gy0, gx1 + 1, gy1 + 1] : null, cells: { inked, total } };
}

/**
 * Qué es el dibujo: nada, un estampado suelto, o un dibujo por toda la tela (aparece en casi todas
 * las partes de la prenda, no solo en el pecho).
 */
export function classifyScan(s: PrintScan): "none" | "single" | "allover" {
  if (!s.box || !s.garmentBox || s.garment === 0) return "none";
  const inkRatio = s.ink / s.garment;
  // Un logo chico (la pipa de un short) ocupa muy poco: alcanza con unos cuantos puntos juntos.
  if (s.ink < 30 || inkRatio < 0.0015) return "none";
  return inkRatio > 0.08 && s.cells.total > 0 && s.cells.inked / s.cells.total >= 0.7 ? "allover" : "single";
}

export type PhotoPrint =
  | { kind: "single"; canvas: HTMLCanvasElement; aspect: number; place: { x: number; y: number; width: number } }
  | { kind: "allover"; tile: HTMLCanvasElement };

/** Color más repetido entre los píxeles (agrupando tonos parecidos). */
function dominantColor(d: Uint8ClampedArray, keep: (i: number) => boolean): RGB | null {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 16) {
    if (!keep(i)) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++;
    c.r += d[i];
    c.g += d[i + 1];
    c.b += d[i + 2];
    counts.set(key, c);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? [best.r / best.n, best.g / best.n, best.b / best.n] : null;
}

/** La prenda de la foto, derecha y recortada, con el color de su tela y el del fondo. */
export interface UprightGarment {
  cut: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  data: ImageData;
  cw: number;
  ch: number;
  fabric: RGB;
  bg: RGB;
}

/**
 * Endereza y recorta la prenda de la foto: con la caja y el giro de la IA si los hay; si no, con
 * lo que no es fondo. El color de la tela es el de la IA o el más repetido de la prenda.
 */
export async function uprightGarment(src: string, fit: GarmentFit | undefined, maxSide = 360): Promise<UprightGarment | null> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return null;
  // Foto chica para analizar rápido.
  const k0 = Math.min(1, 480 / Math.max(W, H));
  const small = document.createElement("canvas");
  small.width = Math.max(8, Math.round(W * k0));
  small.height = Math.max(8, Math.round(H * k0));
  const sctx = small.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, small.width, small.height);
  const sd = sctx.getImageData(0, 0, small.width, small.height).data;
  const bg = borderColor(sd, small.width, small.height);
  const far = (i: number) => sd[i + 3] > 128 && Math.abs(sd[i] - bg[0]) + Math.abs(sd[i + 1] - bg[1]) + Math.abs(sd[i + 2] - bg[2]) > 45;

  // Dónde está la prenda y cuánto está girada: lo que dijo la IA, o lo que no es fondo.
  let box: [number, number, number, number];
  let angle = 0;
  if (fit) {
    box = [fit.box[0] * small.width, fit.box[1] * small.height, fit.box[2] * small.width, fit.box[3] * small.height];
    angle = fit.angle;
  } else {
    let [x0, y0, x1, y1] = [small.width, small.height, -1, -1];
    for (let y = 0; y < small.height; y++)
      for (let x = 0; x < small.width; x++)
        if (far((y * small.width + x) * 4)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) return null;
    box = [x0, y0, x1 + 1, y1 + 1];
  }
  const fabric = (fit && hexToRgb(fit.fabric)) || dominantColor(sd, far);
  if (!fabric) return null;

  // La prenda derecha, recortada (con un poquito de margen, para no cortarle los bordes).
  const [gw0, gh0] = unrotatedSize(box[2] - box[0], box[3] - box[1], angle);
  const gw = gw0 * 1.06;
  const gh = gh0 * 1.06;
  const k = Math.min(1, maxSide / Math.max(gw, gh));
  const cw = Math.max(16, Math.round(gw * k));
  const ch = Math.max(16, Math.round(gh * k));
  const cut = document.createElement("canvas");
  cut.width = cw;
  cut.height = ch;
  const ctx = cut.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(k, k);
  ctx.rotate((-angle * Math.PI) / 180);
  ctx.drawImage(small, -(box[0] + box[2]) / 2, -(box[1] + box[3]) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { cut, ctx, data: ctx.getImageData(0, 0, cw, ch), cw, ch, fabric, bg };
}

/**
 * Mira la foto de una prenda estampada y devuelve su estampado: suelto (recortado, con su lugar
 * sobre la prenda) o por toda la tela (un pedazo cuadrado de la tela). `body` es qué parte del ancho
 * es el cuerpo de la prenda (en una remera, sin las mangas); `allover` fuerza el pedazo de tela.
 */
export async function analyzePhotoPrint(
  src: string,
  fit: GarmentFit | undefined,
  opts: { body: number; allover?: boolean },
): Promise<PhotoPrint | null> {
  const g = await uprightGarment(src, fit);
  if (!g) return null;
  const { cut, ctx, data, cw, ch, fabric, bg } = g;
  const scan = scanPrint(data.data, cw, ch, fabric, bg);
  const kind = opts.allover ? "allover" : classifyScan(scan);
  if (kind === "none" || !scan.garmentBox) return null;
  const [gx0, gy0, gx1, gy1] = scan.garmentBox;

  if (kind === "allover") {
    // Un pedazo cuadrado del medio de la prenda (lejos de los bordes y del cuello).
    const side = Math.max(8, Math.round(Math.min(gx1 - gx0, gy1 - gy0) * 0.34));
    const sx = Math.round((gx0 + gx1) / 2 - side / 2);
    const sy = Math.round(gy0 + (gy1 - gy0) * 0.58 - side / 2);
    const tile = document.createElement("canvas");
    tile.width = tile.height = 128;
    tile.getContext("2d")!.drawImage(cut, sx, sy, side, side, 0, 0, 128, 128);
    return { kind: "allover", tile };
  }

  // Estampado suelto: se recorta con un margen, se le saca la tela y se ubica sobre la prenda.
  const [x0, y0, x1, y1] = scan.box!;
  const mx = (x1 - x0) * 0.06 + 2;
  const my = (y1 - y0) * 0.06 + 2;
  const bx0 = Math.max(0, Math.floor(x0 - mx));
  const by0 = Math.max(0, Math.floor(y0 - my));
  const bx1 = Math.min(cw, Math.ceil(x1 + mx));
  const by1 = Math.min(ch, Math.ceil(y1 + my));
  const piece = ctx.getImageData(bx0, by0, Math.max(1, bx1 - bx0), Math.max(1, by1 - by0));
  const trimmed = removeFabric(piece.data, piece.width, piece.height, fabric);
  if (!trimmed) return null;
  const tmp = document.createElement("canvas");
  tmp.width = piece.width;
  tmp.height = piece.height;
  tmp.getContext("2d")!.putImageData(piece, 0, 0);
  const out = document.createElement("canvas");
  out.width = Math.max(4, trimmed[2] - trimmed[0]);
  out.height = Math.max(4, trimmed[3] - trimmed[1]);
  out.getContext("2d")!.drawImage(tmp, trimmed[0], trimmed[1], out.width, out.height, 0, 0, out.width, out.height);
  // Lugar sobre la prenda: x sobre el ancho del cuerpo (−1 a 1), y de arriba (0) al ruedo (1).
  const bodyW = (gx1 - gx0) * opts.body;
  const cx = (gx0 + gx1) / 2;
  const px = (bx0 + trimmed[0] + out.width / 2 - cx) / (bodyW / 2);
  const py = (by0 + trimmed[1] + out.height / 2 - gy0) / Math.max(1, gy1 - gy0);
  return {
    kind: "single",
    canvas: out,
    aspect: out.width / out.height,
    place: {
      x: Math.max(-1, Math.min(1, Math.round(px * 100) / 100)),
      y: Math.max(0, Math.min(1, Math.round(py * 100) / 100)),
      width: Math.max(0.05, Math.min(0.95, Math.round((out.width / bodyW) * 100) / 100)),
    },
  };
}
