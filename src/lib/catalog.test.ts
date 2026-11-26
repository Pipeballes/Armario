import { describe, expect, it } from "vitest";
import { slotOf } from "./avatar";
import { CATEGORIES, categoriesFor, categoryView, kindsFor } from "./catalog";
import type { Garment } from "./types";

describe("kindsFor", () => {
  const ids = (cat: Parameters<typeof kindsFor>[0], g?: string) => kindsFor(cat, g).map((k) => k.id);

  it("pijama tiene remera, short, pantalón, medias, buzo, accesorio y otro", () => {
    expect(ids("pijama", "hombre")).toEqual(
      expect.arrayContaining(["remera", "short", "pantalon", "medias", "buzo", "accesorio", "otro"]),
    );
  });

  it("la misma prenda tiene su nombre según el género", () => {
    const label = (g?: string) => kindsFor("interior", g).find((k) => k.id === "calzon")?.label;
    expect(label("hombre")).toBe("Calzoncillo");
    expect(label("mujer")).toBe("Bombacha");
    expect(label("otro")).toBe("Calzoncillo / Bombacha");
    const malla = (g?: string) => kindsFor("malla", g).find((k) => k.id === "malla-abajo")?.label;
    expect(malla("hombre")).toBe("Short de baño");
    expect(malla("mujer")).toBe("Bikini (abajo)");
  });

  it("corpiño solo para mujer", () => {
    expect(ids("interior", "mujer")).toContain("corpino");
    expect(ids("interior", "hombre")).not.toContain("corpino");
    expect(ids("pijama", "mujer")).toContain("calzon");
  });

  it("sin género muestra todo", () => {
    expect(ids("malla")).toEqual(expect.arrayContaining(["malla-abajo", "bikini-arriba", "enteriza", "sunga", "otro"]));
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
    expect(ids("malla", "hombre")).toEqual(["malla-abajo", "sunga", "remera-uv", "otro"]);
  });

  it('con "otro" (o sin elegir) se ve todo', () => {
    expect(ids("accessory", "otro")).toEqual(expect.arrayContaining(["corbata", "cartera", "panuelo"]));
  });

  it("íconos según el género", () => {
    expect(categoryView("malla", "hombre").emoji).toBe("🩳");
    expect(categoryView("malla", "mujer").emoji).toBe("👙");
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
    expect(slotOf(g({ category: "malla", kind: "malla-abajo" }))).toBe("bottom");
    expect(slotOf(g({ category: "top" }))).toBe("top");
  });
});

describe("talles de calzado US", () => {
  it("ofrece talles US según el género", async () => {
    const { shoeSizesUS } = await import("./catalog");
    expect(shoeSizesUS("hombre")[0]).toBe("6");
    expect(shoeSizesUS("hombre")).toContain("9.5");
    expect(shoeSizesUS("mujer")[0]).toBe("5");
  });
  it("pasa europeo y argentino a US", async () => {
    const { toUSShoe } = await import("./catalog");
    expect(toUSShoe(42, "eu", "hombre")).toBe("8.5");
    expect(toUSShoe(41, "ar", "hombre")).toBe("8.5");
    expect(toUSShoe(38, "eu", "mujer")).toBe("7.5");
    expect(toUSShoe(10, "eu", "hombre")).toBeNull();
  });
});

describe("cantidad de prendas iguales", () => {
  it("se pregunta solo en ropa interior, medias y mallas", async () => {
    const { isCountable, countUnit } = await import("./catalog");
    expect(isCountable("interior", "calzon")).toBe(true);
    expect(isCountable("interior", "medias")).toBe(true);
    expect(isCountable("pijama", "medias")).toBe(true);
    expect(isCountable("malla", "bikini-arriba")).toBe(true);
    expect(isCountable("pijama", "remera")).toBe(false);
    expect(isCountable("top", "remera")).toBe(false);
    expect(isCountable("bottom", "jean")).toBe(false);
    expect(countUnit("medias", 3)).toBe("pares");
    expect(countUnit("calzon", 1)).toBe("igual");
  });
});

describe("autoName", () => {
  it("arma el nombre sin repetir el color", async () => {
    const { autoName } = await import("./catalog");
    expect(autoName("Remera", "azul")).toBe("Remera azul");
    expect(autoName("Jean", "denim")).toBe("Jean");
    expect(autoName("Campera", "azul-marino")).toBe("Campera azul marino");
  });
});
