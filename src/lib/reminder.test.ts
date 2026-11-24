import { describe, expect, it } from "vitest";
import type { PlanDay } from "./planner";
import { reminderMessage, reminderMessages } from "./reminder";
import type { Garment } from "./types";

const g = (name: string, category: Garment["category"]): Garment => ({
  id: name, photo: "", name, category, color: "negro", pattern: "liso", styles: ["casual"], formality: 2, warmth: "medium", createdAt: 0,
});

const day = (p: Partial<PlanDay> = {}): PlanDay => ({
  date: "2026-11-25", event: null, others: 0, occasion: "casual", weather: "templado", pinned: false,
  outfit: { items: [g("Remera blanca", "top"), g("Jean", "bottom"), g("Zapatillas", "shoes")], score: 5, reasons: [] },
  ...p,
});

describe("reminderMessage", () => {
  it("dice el evento, el clima y las prendas", () => {
    const m = reminderMessage(
      day({ occasion: "trabajo", event: { id: "1", title: "Parcial de Análisis", start: "", end: null, allDay: false, location: null, occasion: "trabajo" } }),
      { weather: "frio", feels: 9, rain: 70 },
    );
    expect(m.title).toBe("👕 Hoy: 💼 Parcial de Análisis · 🥶 9° ☔");
    expect(m.body).toBe("Ponete: Remera blanca, Jean, Zapatillas. Llevá paraguas.");
  });

  it("sin evento usa la ocasión y sin clima no lo menciona", () => {
    const m = reminderMessage(day());
    expect(m.title).toBe("👕 Hoy: ☀️ Día casual");
  });

  it("sin outfit invita a entrar", () => {
    expect(reminderMessage(day({ outfit: null })).body).toBe("Entrá a ver qué te ponés hoy.");
  });

  it("arma un mensaje por fecha", () => {
    const r = reminderMessages([day(), day({ date: "2026-11-26" })]);
    expect(Object.keys(r)).toEqual(["2026-11-25", "2026-11-26"]);
  });
});
