import { describe, expect, it } from "vitest";
import { slotOf } from "./avatar";
import { CATEGORIES, categoriesFor, kindsFor } from "./catalog";
import type { Garment } from "./types";

describe("kindsFor", () => {
  const ids = (cat: Parameters<typeof kindsFor>[0], g?: string) => kindsFor(cat, g).map((k) => k.id);

  it("pijama tiene remera, short, pantalón, medias, buzo, accesorio y otro", () => {
    expect(ids("pijama", "hombre")).toEqual(
      expect.arrayContaining(["remera", "short", "pantalon", "medias", "buzo", "accesorio", "otro"]),
    );
  });

  it("para mujer suma bombacha y corpiño, para hombre calzoncillo", () => {
    expect(ids("interior", "mujer")).toEqual(expect.arrayContaining(["bombacha", "corpino"]));
    expect(ids("interior", "mujer")).not.toContain("calzoncillo");
    expect(ids("interior", "hombre")).toContain("calzoncillo");
    expect(ids("interior", "hombre")).not.toContain("bombacha");
    expect(ids("pijama", "mujer")).toContain("bombacha");
  });

  it("sin género muestra todo", () => {
    expect(ids("malla")).toEqual(expect.arrayContaining(["short-bano", "bikini-arriba", "enteriza", "otro"]));
  });

  it("todas las categorías tienen tipos y la opción Otro", () => {
    for (const c of CATEGORIES) expect(ids(c.id)).toContain("otro");
  });

  it("hombre no ve prendas de mujer y mujer no ve las de hombre", () => {
    const allM = CATEGORIES.flatMap((c) => kindsFor(c.id, "mujer"));
    const allH = CATEGORIES.flatMap((c) => kindsFor(c.id, "hombre"));
    expect(allH.some((k) => k.only === "mujer")).toBe(false);
    expect(allM.some((k) => k.only === "hombre")).toBe(false);
    expect(ids("bottom", "hombre")).not.toContain("pollera-midi");
    expect(ids("shoes", "mujer")).toContain("tacos");
    expect(ids("accessory", "hombre")).toContain("corbata");
    expect(ids("accessory", "mujer")).not.toContain("corbata");
  });

  it('con "otro" (o sin elegir) se ve todo', () => {
    expect(ids("accessory", "otro")).toEqual(expect.arrayContaining(["corbata", "cartera"]));
  });

  it("vestidos no aparecen para hombre", () => {
    expect(categoriesFor("hombre").map((c) => c.id)).not.toContain("dress");
    expect(categoriesFor("mujer").map((c) => c.id)).toContain("dress");
  });

  it("no hay tipos repetidos dentro de una categoría", () => {
    for (const c of CATEGORIES) {
      const list = ids(c.id);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe("slotOf", () => {
  const g = (p: Partial<Garment>): Garment => ({
    id: "x", photo: "", name: "x", category: "top", color: "negro", pattern: "liso", styles: [], formality: 1, warmth: "light", createdAt: 0, ...p,
  });
  it("ubica pijama y malla según el tipo", () => {
    expect(slotOf(g({ category: "pijama", kind: "remera" }))).toBe("top");
    expect(slotOf(g({ category: "pijama", kind: "short" }))).toBe("bottom");
    expect(slotOf(g({ category: "interior", kind: "medias" }))).toBeNull();
    expect(slotOf(g({ category: "malla", kind: "short-bano" }))).toBe("bottom");
    expect(slotOf(g({ category: "top" }))).toBe("top");
  });
});
