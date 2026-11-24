import { describe, expect, it } from "vitest";
import type { AgendaEvent } from "./agenda";
import { outfitKey } from "./outfits";
import { dateKey, planWeek, prepList } from "./planner";
import { EMPTY_PROFILE, type Garment } from "./types";

let n = 0;
const g = (p: Partial<Garment> & Pick<Garment, "category" | "color">): Garment => {
  n += 1;
  return { id: `g${n}`, photo: "", name: `${p.category}-${p.color}`, pattern: "liso", styles: ["casual"], formality: 2, warmth: "medium", createdAt: 0, ...p };
};

const ropa = [
  g({ category: "top", color: "blanco" }),
  g({ category: "top", color: "azul-marino" }),
  g({ category: "top", color: "gris" }),
  g({ category: "top", color: "negro" }),
  g({ category: "bottom", color: "denim" }),
  g({ category: "bottom", color: "beige" }),
  g({ category: "bottom", color: "negro" }),
  g({ category: "shoes", color: "blanco" }),
  g({ category: "top", color: "blanco", formality: 5, styles: ["elegante"], name: "Camisa de vestir" }),
  g({ category: "bottom", color: "negro", formality: 5, styles: ["elegante"], name: "Pantalón de traje" }),
  g({ category: "shoes", color: "negro", formality: 5, styles: ["elegante"], name: "Zapatos" }),
];

const start = new Date(2026, 10, 23); // lunes 23/11/2026

describe("planWeek", () => {
  it("arma 7 días y no repite partes de arriba seguidas mientras alcance la ropa", () => {
    const plan = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start });
    expect(plan).toHaveLength(7);
    expect(plan[0].date).toBe("2026-11-23");
    const tops = plan.slice(0, 4).map((d) => d.outfit!.items.find((i) => i.category === "top")!.id);
    expect(new Set(tops).size).toBe(4);
  });

  it("usa el evento más importante del día", () => {
    const ev = (title: string, occasion: AgendaEvent["occasion"], h: number): AgendaEvent => ({
      id: title, title, start: new Date(2026, 10, 25, h).toISOString(), end: null, allDay: false, location: null, occasion,
    });
    const plan = planWeek({
      garments: ropa,
      profile: EMPTY_PROFILE,
      events: [ev("Clase", "trabajo", 9), ev("Casamiento", "formal", 20)],
      start,
    });
    const miercoles = plan.find((d) => d.date === "2026-11-25")!;
    expect(miercoles.event?.title).toBe("Casamiento");
    expect(miercoles.others).toBe(1);
    expect(miercoles.outfit!.items.every((i) => i.formality === 5)).toBe(true);
  });

  it("respeta los días fijados y no reusa esa ropa en otros días", () => {
    const fijo = [ropa[0].id, ropa[4].id, ropa[7].id];
    const plan = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start, days: 3, pinned: { "2026-11-24": fijo } });
    expect(plan[1].pinned).toBe(true);
    expect(plan[1].outfit!.items.map((i) => i.id)).toEqual(fijo);
    expect(plan[0].outfit!.items.some((i) => i.id === ropa[0].id)).toBe(false);
  });

  it("\"otra opción\" cambia ese día y no repite el outfit descartado", () => {
    const a = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start, days: 2 });
    const b = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start, days: 2, skips: { "2026-11-23": [outfitKey(a[0].outfit!.items)] } });
    expect(dateKey(start)).toBe("2026-11-23");
    expect(outfitKey(a[0].outfit!.items)).not.toBe(outfitKey(b[0].outfit!.items));
  });
});

describe("prepList", () => {
  it("junta la ropa de la semana con los días de uso", () => {
    const plan = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start, days: 3 });
    const list = prepList(plan);
    const zapas = list.find((x) => x.garment.category === "shoes");
    expect(zapas!.dates.length).toBeGreaterThan(0);
    expect(list.length).toBeGreaterThan(3);
  });
});

describe("planWeek con un favorito", () => {
  it("no repite el outfit con 👍 todos los días", () => {
    const base = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start, days: 1 });
    const fav = outfitKey(base[0].outfit!.items);
    const plan = planWeek({ garments: ropa, profile: EMPTY_PROFILE, events: [], start, days: 3, feedback: { liked: [fav], disliked: [] } });
    const keys = plan.map((d) => outfitKey(d.outfit!.items));
    expect(keys[0]).toBe(fav);
    expect(keys[1]).not.toBe(fav);
    expect(keys[2]).not.toBe(fav);
  });
});
