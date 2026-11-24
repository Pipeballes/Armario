import { describe, expect, it } from "vitest";
import { slotOf } from "./avatar";
import { kindsFor } from "./catalog";
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

  it("las categorías comunes no tienen tipos", () => {
    expect(ids("top")).toEqual([]);
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
