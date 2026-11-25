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
