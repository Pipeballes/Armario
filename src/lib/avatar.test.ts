import { describe, expect, it } from "vitest";
import { bodyDims, lookFrom, selectionFrom, skinColor } from "./avatar";
import { EMPTY_PROFILE, type Garment } from "./types";

const g = (p: Partial<Garment> & Pick<Garment, "id" | "category" | "color">): Garment => ({
  photo: "",
  name: "prenda",
  pattern: "liso",
  styles: [],
  formality: 2,
  warmth: "medium",
  createdAt: 0,
  ...p,
});

describe("bodyDims", () => {
  it("usa la altura y la silueta del perfil", () => {
    const d = bodyDims({ ...EMPTY_PROFILE, height: 186, bodyType: "triangulo-invertido" });
    expect(d.scale).toBeCloseTo(186 / 172);
    expect(d.shoulder).toBeGreaterThan(d.hip);
    const t = bodyDims({ ...EMPTY_PROFILE, bodyType: "triangulo" });
    expect(t.hip).toBeGreaterThan(t.shoulder);
  });
  it("sin altura o con una altura rara usa 1,72 m", () => {
    expect(bodyDims(EMPTY_PROFILE).heightM).toBe(1.72);
    expect(bodyDims({ ...EMPTY_PROFILE, height: 40 }).heightM).toBe(1.72);
  });
});

describe("skinColor", () => {
  it("cambia según tono y subtono", () => {
    const a = skinColor({ ...EMPTY_PROFILE, skinDepth: "clara", undertone: "frio" });
    const b = skinColor({ ...EMPTY_PROFILE, skinDepth: "oscura", undertone: "calido" });
    expect(a).not.toBe(b);
  });
});

describe("lookFrom", () => {
  const ropa = [
    g({ id: "t", category: "top", color: "blanco", name: "Remera blanca", warmth: "light" }),
    g({ id: "b", category: "bottom", color: "denim", name: "Jean" }),
    g({ id: "s", category: "bottom", color: "beige", name: "Bermuda beige" }),
    g({ id: "d", category: "dress", color: "rojo", name: "Vestido de fiesta", formality: 5 }),
    g({ id: "z", category: "shoes", color: "marron", name: "Botas marrones" }),
    g({ id: "c", category: "accessory", color: "negro", name: "Gorra negra" }),
  ];

  it("pone cada prenda en su lugar con su color", () => {
    const look = lookFrom(selectionFrom([ropa[0], ropa[1], ropa[4], ropa[5]]), ropa);
    expect(look.top).toMatchObject({ color: "#f7f7f5", sleeves: "short", dress: "none" });
    expect(look.bottom).toMatchObject({ kind: "pants" });
    expect(look.shoes).toMatchObject({ boots: true });
    expect(look.accessory).toMatchObject({ kind: "cap" });
  });

  it("reconoce bermudas y vestidos largos, y el vestido tapa lo de abajo", () => {
    expect(lookFrom({ bottom: "s" }, ropa).bottom?.kind).toBe("shorts");
    const look = lookFrom({ top: "d", bottom: "b" }, ropa);
    expect(look.top?.dress).toBe("long");
    expect(look.bottom).toBeNull();
  });
});
