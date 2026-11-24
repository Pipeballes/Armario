import { describe, expect, it } from "vitest";
import { parseChoice, parseSize } from "./ai-schema";

describe("parseChoice", () => {
  it("ordena según la IA y agrega al final lo que no nombró", () => {
    expect(parseChoice({ order: ["2", "9", "2"], why: "Porque sí", tip: "Sumá un reloj" }, ["1", "2", "3"])).toEqual({
      order: ["2", "1", "3"],
      why: "Porque sí",
      tip: "Sumá un reloj",
    });
  });
  it("entiende \"Opción 1\" y números", () => {
    expect(parseChoice({ order: ["Opción 2", 0], why: "", tip: "" }, ["0", "1", "2"])?.order).toEqual(["2", "0", "1"]);
  });
  it("si la respuesta no sirve devuelve null", () => {
    expect(parseChoice({ order: ["x"] }, ["1", "2"])).toBeNull();
    expect(parseChoice(null, ["1"])).toBeNull();
  });
});

describe("parseSize", () => {
  it("limpia el talle leído de la etiqueta", () => {
    expect(parseSize("Talle: m")).toBe("M");
    expect(parseSize(" 42 ")).toBe("42");
    expect(parseSize("")).toBeUndefined();
    expect(parseSize("no se ve")).toBeUndefined();
    expect(parseSize(null)).toBeUndefined();
    expect(parseSize("us9,5")).toBe("US 9.5");
  });
});
