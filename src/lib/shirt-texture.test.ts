import { describe, expect, it } from "vitest";
import { borderColor, guessFabric, hexToRgb, rotatePoint, torsoRect } from "./shirt-texture";
import { parseFit } from "./ai-schema";

/** Dibuja una remera (cuerpo + mangas arriba) de un color sobre un fondo. */
function tee(w: number, h: number, bg: [number, number, number], fab: [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const body = x >= 40 && x < 80 && y >= 20 && y < 100;
      const sleeves = x >= 15 && x < 105 && y >= 20 && y < 45;
      const print = x >= 52 && x < 68 && y >= 40 && y < 56;
      const c = print ? [200, 30, 30] : body || sleeves ? fab : bg;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  return d;
}

describe("torsoRect", () => {
  it("encuentra el cuerpo de la remera sin las mangas", () => {
    const d = tee(120, 120, [20, 30, 70], [245, 245, 245]);
    const r = torsoRect(d, 120, 120, [240, 240, 240])!;
    expect(r).not.toBeNull();
    expect(r[0]).toBeGreaterThan(38);
    expect(r[0]).toBeLessThan(45);
    expect(r[2]).toBeGreaterThan(75);
    expect(r[2]).toBeLessThan(82);
    expect(r[1]).toBeLessThan(25);
    expect(r[3]).toBeGreaterThan(95);
  });

  it("sin ayuda adivina el color de la tela y el del fondo", () => {
    const d = tee(120, 120, [20, 30, 70], [245, 245, 245]);
    const bg = borderColor(d, 120, 120);
    expect(bg).toEqual([20, 30, 70]);
    const fab = guessFabric(d, 120, 120, bg)!;
    expect(fab[0]).toBeGreaterThan(230);
  });
});

describe("rotatePoint", () => {
  it("sin giro solo centra", () => {
    expect(rotatePoint(0, 0, 100, 50, 0, 120)).toEqual([10, 35]);
  });
  it("con 90° gira el punto", () => {
    const [x, y] = rotatePoint(100, 25, 100, 50, 90, 120);
    expect(Math.round(x)).toBe(60);
    expect(Math.round(y)).toBe(10);
  });
});

describe("parseFit", () => {
  it("convierte la caja de la IA a 0..1 y valida el color", () => {
    expect(parseFit({ box: [100, 200, 900, 800], angle: 25, fabric: "#F4F4F2" })).toEqual({
      angle: 25,
      box: [0.2, 0.1, 0.8, 0.9],
      fabric: "#f4f4f2",
    });
    expect(parseFit({ box: [100, 200, 900, 800], angle: 0, fabric: "blanco" })).toBeNull();
    expect(parseFit({ box: [100, 200, 900, 800], angle: 10, upside_down: true, fabric: "#000000" })!.angle).toBe(190);
  });
  it("hexToRgb", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  });
});
