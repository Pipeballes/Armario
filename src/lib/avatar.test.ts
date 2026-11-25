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
    expect(look.shoes).toMatchObject({ kind: "boot" });
    expect(look.accessory).toMatchObject({ kind: "cap" });
  });

  it("reconoce bermudas y vestidos largos, y el vestido tapa lo de abajo", () => {
    expect(lookFrom({ bottom: "s" }, ropa).bottom?.kind).toBe("bermuda");
    const look = lookFrom({ top: "d", bottom: "b" }, ropa);
    expect(look.top?.dress).toBe("long");
    expect(look.bottom).toBeNull();
  });
});

describe("detalles de cada tipo de prenda", () => {
  const k = (p: Partial<Garment> & Pick<Garment, "category" | "kind">) =>
    g({ id: p.kind!, color: "negro", name: p.kind!, ...p });
  const ropa = [
    k({ category: "top", kind: "camisa" }),
    k({ category: "top", kind: "hoodie" }),
    k({ category: "top", kind: "polera" }),
    k({ category: "top", kind: "musculosa" }),
    k({ category: "top", kind: "chomba" }),
    k({ category: "top", kind: "crop-top" }),
    k({ category: "bottom", kind: "jogging" }),
    k({ category: "bottom", kind: "palazzo" }),
    k({ category: "bottom", kind: "pollera-midi" }),
    k({ category: "bottom", kind: "calza" }),
    k({ category: "shoes", kind: "tacos" }),
    k({ category: "shoes", kind: "botas-altas" }),
    k({ category: "shoes", kind: "ojotas" }),
    k({ category: "shoes", kind: "mocasines" }),
    k({ category: "outerwear", kind: "saco" }),
    k({ category: "outerwear", kind: "campera-inflable" }),
    k({ category: "outerwear", kind: "parka" }),
    k({ category: "accessory", kind: "gorro" }),
    k({ category: "accessory", kind: "sombrero" }),
    k({ category: "dress", kind: "enterito" }),
    k({ category: "interior", kind: "calzon" }),
    k({ category: "malla", kind: "bikini-arriba" }),
  ];
  const look = (slot: string, id: string) => lookFrom({ [slot]: id }, ropa);

  it("partes de arriba", () => {
    expect(look("top", "camisa").top).toMatchObject({ neck: "collar", buttons: 5, sleeves: "long" });
    expect(look("top", "hoodie").top).toMatchObject({ neck: "hood", pocket: true, ribbed: true });
    expect(look("top", "polera").top).toMatchObject({ neck: "turtle", sleeves: "long" });
    expect(look("top", "musculosa").top).toMatchObject({ sleeves: "none", neck: "straps" });
    expect(look("top", "chomba").top).toMatchObject({ neck: "collar", buttons: 2, sleeves: "short" });
    expect(look("top", "crop-top").top?.cut).toBe("crop");
    expect(look("top", "bikini-arriba").top?.cut).toBe("bra");
  });

  it("partes de abajo", () => {
    expect(look("bottom", "jogging").bottom).toMatchObject({ kind: "pants", cuffs: true });
    expect(look("bottom", "palazzo").bottom).toMatchObject({ kind: "pants", wide: true });
    expect(look("bottom", "pollera-midi").bottom).toMatchObject({ kind: "skirt", length: "midi" });
    expect(look("bottom", "calza").bottom).toMatchObject({ tight: true });
    expect(look("bottom", "calzon").bottom?.kind).toBe("brief");
  });

  it("calzado, abrigos y accesorios", () => {
    expect(look("shoes", "tacos").shoes?.kind).toBe("heel");
    expect(look("shoes", "botas-altas").shoes?.kind).toBe("tallboot");
    expect(look("shoes", "ojotas").shoes?.kind).toBe("sandal");
    expect(look("shoes", "mocasines").shoes?.kind).toBe("formal");
    expect(look("outerwear", "saco").outerwear?.kind).toBe("blazer");
    expect(look("outerwear", "campera-inflable").outerwear?.kind).toBe("puffer");
    expect(look("outerwear", "parka").outerwear).toMatchObject({ kind: "coat", hood: true });
    expect(look("accessory", "gorro").accessory?.kind).toBe("beanie");
    expect(look("accessory", "sombrero").accessory?.kind).toBe("hat");
  });

  it("el enterito es arriba y pantalón del mismo color", () => {
    const l = look("top", "enterito");
    expect(l.top?.dress).toBe("none");
    expect(l.bottom?.kind).toBe("pants");
  });
});
