import { describe, expect, it } from "vitest";
import { fillPlacard, sortForShelf } from "./placard";
import type { Garment } from "./types";

let n = 0;
const g = (p: Partial<Garment> & Pick<Garment, "category">): Garment => ({
  id: `g${++n}`,
  photo: "",
  name: p.kind ?? p.category,
  color: "negro",
  pattern: "liso",
  styles: [],
  formality: 2,
  warmth: "medium",
  createdAt: 0,
  ...p,
});

describe("placard", () => {
  const ropa = [
    g({ category: "top", kind: "remera", color: "negro" }),
    g({ category: "top", kind: "remera", color: "blanco" }),
    g({ category: "top", kind: "camisa" }),
    g({ category: "outerwear", kind: "campera" }),
    g({ category: "bottom", kind: "jean" }),
    g({ category: "interior", kind: "calzon", quantity: 5 }),
    g({ category: "interior", kind: "medias", quantity: 7 }),
    g({ category: "shoes", kind: "zapatillas" }),
    g({ category: "accessory", kind: "gorra" }),
    g({ category: "pijama", kind: "short" }),
    g({ category: "malla", kind: "malla-abajo" }),
  ];

  it("pone cada prenda en su lugar", () => {
    const zones = Object.fromEntries(fillPlacard(ropa, "hombre").map((z) => [z.zone.id, z.items.map((i) => i.kind)]));
    expect(zones.colgados).toEqual(["campera", "camisa"]);
    expect(zones.arriba).toEqual(["remera", "remera"]);
    expect(zones.abajo).toEqual(["jean"]);
    expect(zones.interior).toEqual(["calzon"]);
    expect(zones.medias).toEqual(["medias"]);
    expect(zones.pijamas).toEqual(["short"]);
    expect(zones.mallas).toEqual(["malla-abajo"]);
    expect(zones.accesorios).toEqual(["gorra"]);
    expect(zones.calzado).toEqual(["zapatillas"]);
  });

  it("no pierde ni repite prendas, y cuenta las iguales", () => {
    const filled = fillPlacard(ropa, "mujer");
    expect(filled.reduce((s, z) => s + z.items.length, 0)).toBe(ropa.length);
    expect(filled.find((z) => z.zone.id === "medias")!.units).toBe(7);
  });

  it("ordena de claro a oscuro dentro del mismo tipo", () => {
    const sorted = sortForShelf(ropa.filter((x) => x.kind === "remera"));
    expect(sorted.map((x) => x.color)).toEqual(["blanco", "negro"]);
  });
});
