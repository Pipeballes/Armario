import { describe, expect, it } from "vitest";
import { colorHarmony, outfitKey, suggestOutfits } from "./outfits";
import { sportFromText } from "./catalog";
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

describe("feedback 👍 / 👎", () => {
  const ropa = [
    g({ category: "top", color: "blanco" }),
    g({ category: "top", color: "azul-marino" }),
    g({ category: "bottom", color: "denim" }),
    g({ category: "bottom", color: "beige" }),
    g({ category: "shoes", color: "blanco" }),
  ];
  const req = { occasion: "casual" as const, weather: "templado" as const, profile: EMPTY_PROFILE };

  it("un outfit con 👎 no se vuelve a sugerir", () => {
    const first = suggestOutfits(ropa, req).outfits[0];
    const res = suggestOutfits(ropa, { ...req, feedback: { liked: [], disliked: [outfitKey(first.items)] } });
    expect(res.outfits.map((o) => outfitKey(o.items))).not.toContain(outfitKey(first.items));
  });

  it("un outfit con 👍 pasa primero", () => {
    const all = suggestOutfits(ropa, { ...req, count: 4 }).outfits;
    const last = all[all.length - 1];
    const res = suggestOutfits(ropa, { ...req, feedback: { liked: [outfitKey(last.items)], disliked: [] } });
    expect(outfitKey(res.outfits[0].items)).toBe(outfitKey(last.items));
    expect(res.outfits[0].reasons[0]).toContain("te gustó");
  });
});

describe("ropa deportiva", () => {
  const mk = (id: string, p: Partial<Garment> & Pick<Garment, "category" | "color">): Garment => ({
    id, photo: "", name: id, pattern: "liso", styles: ["deportivo"], formality: 1, warmth: "light", createdAt: 0, ...p,
  });
  const ropa = [
    mk("camiseta-futbol", { category: "top", color: "azul", sport: "futbol" }),
    mk("remera-dryfit", { category: "top", color: "negro", sport: "general" }),
    mk("short", { category: "bottom", color: "negro", sport: "general" }),
    mk("botines", { category: "shoes", color: "negro", sport: "futbol" }),
    mk("zapatillas-running", { category: "shoes", color: "blanco", sport: "running" }),
    mk("remera-casual", { category: "top", color: "blanco", styles: ["casual"], formality: 2 }),
    mk("jean", { category: "bottom", color: "denim", styles: ["casual"], formality: 2 }),
    mk("zapatillas", { category: "shoes", color: "blanco", styles: ["casual"], formality: 2 }),
  ];

  it("para fútbol elige botines y no las de running", () => {
    const r = suggestOutfits(ropa, { occasion: "deporte", sport: "futbol", weather: "templado", profile: EMPTY_PROFILE, count: 1 });
    const ids = r.outfits[0].items.map((i) => i.id);
    expect(ids).toContain("botines");
    expect(ids).not.toContain("zapatillas-running");
  });

  it("para running elige las zapatillas de running", () => {
    const r = suggestOutfits(ropa, { occasion: "deporte", sport: "running", weather: "templado", profile: EMPTY_PROFILE, count: 1 });
    expect(r.outfits[0].items.map((i) => i.id)).toContain("zapatillas-running");
  });

  it("un día casual no usa botines", () => {
    const r = suggestOutfits(ropa, { occasion: "casual", weather: "templado", profile: EMPTY_PROFILE, count: 1 });
    expect(r.outfits[0].items.map((i) => i.id)).not.toContain("botines");
  });
});

describe("sportFromText", () => {
  it("reconoce el deporte del evento", () => {
    expect(sportFromText("Fútbol con los pibes")).toBe("futbol");
    expect(sportFromText("Pádel 19hs")).toBe("padel-tenis");
    expect(sportFromText("Gym")).toBe("gimnasio");
    expect(sportFromText("Parcial")).toBeUndefined();
  });
});
