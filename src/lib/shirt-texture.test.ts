import { describe, expect, it } from "vitest";
import { hexToRgb, removeFabric, rotatePoint, unrotatedSize } from "./shirt-texture";
import { parseFit } from "./ai-schema";

/** Un cuadro de tela blanca con sombras y un dibujo negro y rojo en el medio. */
function patch(w: number, h: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inPrint = x >= 20 && x < 40 && y >= 15 && y < 35;
      const shadow = x < 12; // arruga: la misma tela, más oscura
      const c = inPrint ? (y < 25 ? [20, 20, 20] : [200, 30, 30]) : shadow ? [190, 190, 186] : [246, 246, 242];
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  return d;
}

describe("removeFabric", () => {
  it("deja solo el dibujo (sin la tela ni las sombras)", () => {
    const d = patch(60, 50);
    const box = removeFabric(d, 60, 50, [246, 246, 242]);
    expect(box).toEqual([20, 15, 40, 35]);
    expect(d[(5 * 60 + 5) * 4 + 3]).toBe(0); // sombra → transparente
    expect(d[(20 * 60 + 25) * 4 + 3]).toBe(255); // negro del dibujo → queda
    expect(d[(30 * 60 + 25) * 4 + 3]).toBe(255); // rojo del dibujo → queda
  });

  it("sin dibujo devuelve null", () => {
    const d = new Uint8ClampedArray(40 * 40 * 4).fill(240);
    expect(removeFabric(d, 40, 40, [240, 240, 240])).toBeNull();
  });
});

describe("unrotatedSize", () => {
  it("sin giro no cambia", () => {
    expect(unrotatedSize(100, 50, 0)).toEqual([100, 50]);
  });
  it("deshace el agrandamiento de la caja de un dibujo girado", () => {
    // Un rectángulo de 100×50 girado 20° ocupa una caja recta de ≈111×81.
    const a = (20 * Math.PI) / 180;
    const bw = 100 * Math.cos(a) + 50 * Math.sin(a);
    const bh = 100 * Math.sin(a) + 50 * Math.cos(a);
    const [w, h] = unrotatedSize(bw, bh, 20);
    expect(Math.round(w)).toBe(100);
    expect(Math.round(h)).toBe(50);
  });
});

describe("rotatePoint", () => {
  it("sin giro solo centra", () => {
    expect(rotatePoint(0, 0, 100, 50, 0, 120)).toEqual([10, 35]);
  });
});

describe("parseFit", () => {
  it("convierte cajas y ubicación del estampado", () => {
    expect(
      parseFit({
        box: [100, 200, 900, 800],
        angle: 25,
        fabric: "#F4F4F2",
        has_print: true,
        print_box: [300, 400, 500, 600],
        print_x: 0.1,
        print_y: 0.3,
        print_width: 0.4,
      }),
    ).toEqual({
      v: 2,
      angle: 25,
      box: [0.2, 0.1, 0.8, 0.9],
      fabric: "#f4f4f2",
      print: { box: [0.4, 0.3, 0.6, 0.5], x: 0.1, y: 0.3, width: 0.4 },
    });
  });
  it("sin estampado o con color inválido", () => {
    expect(parseFit({ box: [100, 200, 900, 800], angle: 0, fabric: "#000000", has_print: false })!.print).toBeUndefined();
    expect(parseFit({ box: [100, 200, 900, 800], angle: 0, fabric: "blanco" })).toBeNull();
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  });
});
