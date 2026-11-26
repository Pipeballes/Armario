import { describe, expect, it } from "vitest";
import { fitNote, parseSize, sizeDiff } from "./sizes";

describe("talles", () => {
  it("lee talles escritos de muchas formas", () => {
    expect(parseSize("L")).toEqual({ system: "letter", value: 4 });
    expect(parseSize("talle m")).toEqual({ system: "letter", value: 3 });
    expect(parseSize("2XL")).toEqual({ system: "letter", value: 6 });
    expect(parseSize("XXL")).toEqual({ system: "letter", value: 6 });
    expect(parseSize("42")).toEqual({ system: "number", value: 42 });
    expect(parseSize("W32 L30")).toEqual({ system: "number", value: 32 });
    expect(parseSize("US 9.5")).toBeNull();
    expect(parseSize("")).toBeNull();
  });

  it("compara la prenda con tu talle", () => {
    expect(sizeDiff("L", "M")).toBe(1);
    expect(sizeDiff("S", "L")).toBe(-2);
    expect(sizeDiff("44", "40")).toBe(2);
    expect(sizeDiff("M", "M")).toBe(0);
    expect(sizeDiff("L", "42")).toBeNull();
    expect(sizeDiff("L", undefined)).toBeNull();
  });

  it("lo dice en palabras", () => {
    expect(fitNote(1)).toBe("te queda un poco grande");
    expect(fitNote(0)).toBe("es tu talle");
    expect(fitNote(-2)).toBe("te queda chica");
  });
});
