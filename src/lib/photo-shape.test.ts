import { describe, expect, it } from "vitest";
import { bottomShapeFromMeasure, measureBottomMask } from "./photo-shape";

/**
 * Silueta de un short aplanado (vista de frente) en una máscara de 200 × 200: cintura de `waist`
 * píxeles, tiro de `rise`, entrepierna de `inseam` y cada pierna con `opening` de ancho en el ruedo.
 */
function shorts(waist: number, rise: number, inseam: number, opening: number) {
  const w = 200;
  const h = 200;
  const mask = new Uint8Array(w * h);
  const x0 = (w - waist) / 2;
  const top = 10;
  for (let y = top; y < top + rise + inseam; y++) {
    if (y < top + rise) {
      for (let x = Math.round(x0); x < Math.round(x0 + waist); x++) mask[y * w + x] = 1;
    } else {
      // Dos piernas separadas en el medio; el borde de afuera se abre (o se cierra) hasta que cada
      // pierna mide `opening` en el ruedo, como en una foto de verdad.
      const k = (y - top - rise) / Math.max(1, inseam);
      const inner = waist / 2 - 3;
      const leg = inner + (opening - inner) * k;
      for (let x = Math.round(x0 + inner - leg); x < Math.round(x0 + inner); x++) mask[y * w + x] = 1;
      for (let x = Math.round(x0 + waist - inner); x < Math.round(x0 + waist - inner + leg); x++) mask[y * w + x] = 1;
    }
  }
  return { mask, w, h };
}

describe("medidas de un short desde la foto", () => {
  it("encuentra la cintura, el tiro, la entrepierna y la boca de la pierna", () => {
    const s = shorts(120, 70, 40, 56);
    const m = measureBottomMask(s.mask, s.w, s.h)!;
    expect(m.waist).toBeCloseTo(120, -1);
    expect(m.rise).toBeGreaterThan(64);
    expect(m.rise).toBeLessThan(76);
    expect(m.inseam).toBeGreaterThan(34);
    expect(m.inseam).toBeLessThan(46);
    expect(m.opening).toBeGreaterThan(50);
    expect(m.opening).toBeLessThan(60);
  });

  it("un short de correr es corto; una bermuda llega a la rodilla", () => {
    const run = bottomShapeFromMeasure(measureBottomMask(...Object.values(shorts(120, 70, 25, 60)) as [Uint8Array, number, number])!);
    const bermuda = bottomShapeFromMeasure(measureBottomMask(...Object.values(shorts(120, 70, 95, 58)) as [Uint8Array, number, number])!);
    expect(run.legT).toBeLessThan(0.4);
    expect(bermuda.legT).toBeGreaterThan(0.8);
  });

  it("uno ajustado tiene la boca más chica que uno holgado", () => {
    const tight = bottomShapeFromMeasure(measureBottomMask(...Object.values(shorts(120, 70, 45, 40)) as [Uint8Array, number, number])!);
    const loose = bottomShapeFromMeasure(measureBottomMask(...Object.values(shorts(120, 70, 45, 75)) as [Uint8Array, number, number])!);
    expect(loose.hemR).toBeGreaterThan(tight.hemR + 0.02);
  });

  it("si no se ven dos piernas (una remera, una pollera), no inventa medidas", () => {
    const w = 100;
    const h = 100;
    const mask = new Uint8Array(w * h);
    for (let y = 10; y < 90; y++) for (let x = 20; x < 80; x++) mask[y * w + x] = 1;
    expect(measureBottomMask(mask, w, h)).toBeNull();
  });
});

/** Silueta de una remera estirada (máscara de 240 × 240): pecho, largo, mangas, boca y ruedo. */
function tee(chest: number, length: number, sleeve: number, opening: number, hemRatio = 1) {
  const w = 240;
  const h = 240;
  const cx = 120;
  const top = 10;
  const c = chest / 2;
  const sy = top + 0.07 * chest;
  const armpit = sy + 0.3 * sleeve + opening * 0.6;
  const side = (s: number): [number, number][] => [
    [cx + s * 0.18 * chest, top],
    [cx + s * 0.45 * chest, sy],
    [cx + s * (c + sleeve), sy + 0.3 * sleeve],
    [cx + s * (c + sleeve - 0.15 * opening), sy + 0.3 * sleeve + opening],
    [cx + s * c, armpit],
    [cx + s * c * hemRatio, top + length],
  ];
  const poly = [...side(-1), ...side(1).reverse(), [cx, top + 0.05 * chest] as [number, number]];
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) mask[y * w + x] = 1;
    }
  return { mask, w, h };
}

describe("medidas de una remera desde la foto", () => {
  it("encuentra el pecho, el largo, las mangas y el ruedo", async () => {
    const { measureTopMask, topShapeFromMeasure } = await import("./photo-shape");
    const t = tee(110, 150, 30, 40);
    const m = measureTopMask(t.mask, t.w, t.h)!;
    expect(m).not.toBeNull();
    expect(m.chest).toBeGreaterThan(104);
    expect(m.chest).toBeLessThan(118);
    expect(m.length).toBeGreaterThan(145);
    expect(m.length).toBeLessThan(155);
    expect(m.sleeve).toBeGreaterThan(24);
    expect(m.sleeve).toBeLessThan(34);
    const r = topShapeFromMeasure(m);
    expect(r.hem).toBeGreaterThan(0.9);
    expect(r.hem).toBeLessThan(1.1);
  });

  it("una oversize sale más cuadrada y con mangas más largas; una que se abre abajo, con más ruedo", async () => {
    const { measureTopMask, topShapeFromMeasure } = await import("./photo-shape");
    const regular = topShapeFromMeasure(measureTopMask(...Object.values(tee(110, 150, 28, 40)) as [Uint8Array, number, number])!);
    const over = topShapeFromMeasure(measureTopMask(...Object.values(tee(130, 145, 45, 52)) as [Uint8Array, number, number])!);
    expect(over.length).toBeLessThan(regular.length);
    expect(over.sleeve).toBeGreaterThan(regular.sleeve);
    const aline = topShapeFromMeasure(measureTopMask(...Object.values(tee(110, 150, 28, 40, 1.2)) as [Uint8Array, number, number])!);
    expect(aline.hem).toBeGreaterThan(regular.hem + 0.1);
  });

  it("descarta lo que no es una remera de manga corta", async () => {
    const { measureTopMask } = await import("./photo-shape");
    // Un rectángulo (sin mangas): no hay axilas.
    const w = 100;
    const mask = new Uint8Array(w * w);
    for (let y = 10; y < 90; y++) for (let x = 30; x < 70; x++) mask[y * w + x] = 1;
    expect(measureTopMask(mask, w, w)).toBeNull();
  });
});

describe("medidas de un pantalón desde la foto", () => {
  it("mide el muslo y la rodilla, además de la boca", () => {
    // Un pantalón recto: la pierna arranca ancha y se angosta hasta la boca.
    const s = shorts(100, 50, 130, 30);
    const m = measureBottomMask(s.mask, s.w, s.h)!;
    expect(m.thigh).toBeGreaterThan(m.knee);
    expect(m.knee).toBeGreaterThan(m.opening - 2);
  });
});
