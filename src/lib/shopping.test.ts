import { describe, expect, it } from "vitest";
import { shoppingSuggestions } from "./shopping";
import { EMPTY_PROFILE, type Garment } from "./types";

let n = 0;
const g = (p: Partial<Garment> & Pick<Garment, "category" | "color">): Garment => {
  n += 1;
  return { id: `s${n}`, photo: "", name: "x", pattern: "liso", styles: ["casual"], formality: 2, warmth: "medium", createdAt: 0, ...p };
};

describe("shoppingSuggestions", () => {
  it("con ropa solo informal, sugiere algo que destraba un evento formal", () => {
    const ropa = [
      g({ category: "top", color: "blanco" }),
      g({ category: "top", color: "gris" }),
      g({ category: "bottom", color: "denim" }),
      g({ category: "shoes", color: "blanco" }),
    ];
    const s = shoppingSuggestions(ropa, EMPTY_PROFILE);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.gain > 0)).toBe(true);
    // No sugiere algo que ya tenés (jean azul, zapatillas blancas).
    expect(s.map((x) => x.name)).not.toContain("Jean azul");
    expect(s.map((x) => x.name)).not.toContain("Zapatillas blancas");
  });

  it("con muy poca ropa no sugiere nada", () => {
    expect(shoppingSuggestions([g({ category: "top", color: "blanco" })], EMPTY_PROFILE)).toEqual([]);
  });
});
