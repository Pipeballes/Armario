import { describe, expect, it } from "vitest";
import { bodyDims, skinColor } from "./avatar";
import { EMPTY_PROFILE } from "./types";


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
