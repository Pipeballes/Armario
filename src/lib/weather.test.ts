import { describe, expect, it } from "vitest";
import { classify, readingFor, type Forecast } from "./weather";

describe("classify", () => {
  it("separa frío, templado y calor por sensación térmica", () => {
    expect(classify(8)).toBe("frio");
    expect(classify(14)).toBe("frio");
    expect(classify(15)).toBe("templado");
    expect(classify(23)).toBe("templado");
    expect(classify(24)).toBe("calor");
  });
});

describe("readingFor", () => {
  // Pronóstico de un día: 10° a la mañana, 28° a la tarde, lluvia a la noche.
  const base = new Date(2026, 10, 27, 0, 0, 0).getTime();
  const hours = Array.from({ length: 24 }, (_, i) => ({
    t: base + i * 3_600_000,
    feels: i < 12 ? 10 : 28,
    rain: i >= 20 ? 80 : 5,
  }));
  const f: Forecast = { hours, now: 20 };

  it("usa las horas del evento", () => {
    expect(readingFor(f, new Date(base + 8 * 3_600_000))).toMatchObject({ weather: "frio" });
    expect(readingFor(f, new Date(base + 15 * 3_600_000))).toMatchObject({ weather: "calor", rain: 5 });
    expect(readingFor(f, new Date(base + 20 * 3_600_000))?.rain).toBe(80);
  });

  it("para un día completo promedia de 9 a 21 hs", () => {
    const r = readingFor(f, new Date(base), { allDay: true })!;
    expect(r.weather).toBe("templado");
    expect(r.rain).toBe(80);
  });

  it("si no hay pronóstico para esa fecha, devuelve null", () => {
    expect(readingFor(f, new Date(base + 40 * 86_400_000))).toBeNull();
  });
});
