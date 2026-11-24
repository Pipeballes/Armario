import { describe, expect, it } from "vitest";
import { parseChoice } from "./ai-schema";

describe("parseChoice", () => {
  it("ordena según la IA y agrega al final lo que no nombró", () => {
    expect(parseChoice({ order: ["2", "9", "2"], why: "Porque sí", tip: "Sumá un reloj" }, ["1", "2", "3"])).toEqual({
      order: ["2", "1", "3"],
      why: "Porque sí",
      tip: "Sumá un reloj",
    });
  });
  it("si la respuesta no sirve devuelve null", () => {
    expect(parseChoice({ order: ["x"] }, ["1", "2"])).toBeNull();
    expect(parseChoice(null, ["1"])).toBeNull();
  });
});
