import { describe, expect, it } from "vitest";
import { colorHarmony, suggestOutfits } from "./outfits";
import { EMPTY_PROFILE, type Garment } from "./types";

let n = 0;
function g(partial: Partial<Garment> & Pick<Garment, "category" | "color">): Garment {
  n += 1;
  return {
    id: `g${n}`,
    photo: "",
    name: partial.name ?? `${partial.category}-${partial.color}`,
    pattern: "liso",
    styles: ["casual"],
    formality: 2,
    warmth: "medium",
    createdAt: 0,
    ...partial,
  };
}

describe("colorHarmony", () => {
  it("prefiere un solo color protagonista sobre tres colores fuertes", () => {
    const one = colorHarmony(["rojo", "negro", "blanco"]).score;
    const three = colorHarmony(["rojo", "verde", "violeta"]).score;
    expect(one).toBeGreaterThan(three);
  });

  it("acepta colores vecinos y complementarios, pero no cualquier par", () => {
    expect(colorHarmony(["mostaza", "naranja"]).score).toBeGreaterThan(0);
    expect(colorHarmony(["azul", "naranja"]).score).toBeGreaterThan(0);
    expect(colorHarmony(["verde", "rosa"]).score).toBeGreaterThan(0);
    expect(colorHarmony(["amarillo", "violeta"]).score).toBeGreaterThan(0);
    expect(colorHarmony(["rojo", "verde-oliva"]).score).toBeLessThan(0);
  });
});

describe("suggestOutfits", () => {
  const base = { occasion: "casual" as const, weather: "templado" as const, profile: EMPTY_PROFILE };

  it("dice qué falta cuando no alcanza la ropa", () => {
    const res = suggestOutfits([g({ category: "top", color: "blanco" })], base);
    expect(res.outfits).toHaveLength(0);
    expect(res.missing).toEqual(["al menos una parte de abajo", "al menos un calzado"]);
  });

  it("arma outfits completos y variados", () => {
    const wardrobe = [
      g({ category: "top", color: "blanco" }),
      g({ category: "top", color: "azul-marino" }),
      g({ category: "top", color: "rojo" }),
      g({ category: "bottom", color: "denim" }),
      g({ category: "bottom", color: "beige" }),
      g({ category: "shoes", color: "blanco" }),
    ];
    const res = suggestOutfits(wardrobe, base);
    expect(res.outfits).toHaveLength(3);
    for (const o of res.outfits) {
      expect(o.items.some((i) => i.category === "top")).toBe(true);
      expect(o.items.some((i) => i.category === "bottom")).toBe(true);
      expect(o.items.some((i) => i.category === "shoes")).toBe(true);
    }
    const keys = res.outfits.map((o) => o.items.map((i) => i.id).join());
    expect(new Set(keys).size).toBe(3);
  });

  it("para un evento formal elige lo arreglado", () => {
    const wardrobe = [
      g({ category: "top", color: "blanco", formality: 5, styles: ["elegante"] }),
      g({ category: "top", color: "gris", formality: 1, styles: ["deportivo"] }),
      g({ category: "bottom", color: "negro", formality: 5, styles: ["elegante"] }),
      g({ category: "bottom", color: "denim", formality: 1 }),
      g({ category: "shoes", color: "negro", formality: 5, styles: ["elegante"] }),
      g({ category: "shoes", color: "blanco", formality: 1, styles: ["deportivo"] }),
    ];
    const res = suggestOutfits(wardrobe, { ...base, occasion: "formal" });
    expect(res.outfits[0].items.every((i) => i.formality === 5)).toBe(true);
  });

  it("suma abrigo con frío y lo saca con calor", () => {
    const wardrobe = [
      g({ category: "top", color: "blanco" }),
      g({ category: "bottom", color: "denim" }),
      g({ category: "shoes", color: "negro" }),
      g({ category: "outerwear", color: "negro", warmth: "warm" }),
    ];
    const cold = suggestOutfits(wardrobe, { ...base, weather: "frio" });
    expect(cold.outfits[0].items.some((i) => i.category === "outerwear")).toBe(true);
    const hot = suggestOutfits(wardrobe, { ...base, weather: "calor" });
    expect(hot.outfits[0].items.some((i) => i.category === "outerwear")).toBe(false);
  });

  it("explica por qué el color favorece al tono de piel", () => {
    const wardrobe = [
      g({ category: "top", color: "mostaza" }),
      g({ category: "bottom", color: "denim" }),
      g({ category: "shoes", color: "marron" }),
    ];
    const res = suggestOutfits(wardrobe, {
      ...base,
      profile: { ...EMPTY_PROFILE, undertone: "calido", bodyType: "triangulo" },
    });
    expect(res.outfits[0].reasons.join(" ")).toContain("tono de piel cálido");
    expect(res.tip).toContain("claros");
  });
});
