"use client";

import { useMemo } from "react";
import { shoppingSuggestions } from "@/lib/shopping";
import type { Garment, Profile } from "@/lib/types";
import { Swatch } from "./ui";

/** Qué prenda te conviene comprar para sumar más combinaciones. */
export default function ShoppingCard({ garments, profile }: { garments: Garment[]; profile: Profile }) {
  const list = useMemo(() => shoppingSuggestions(garments, profile), [garments, profile]);
  if (list.length === 0) return null;
  return (
    <section className="card mt-6 p-4">
      <h2 className="mb-1 font-semibold">🛍️ Qué te conviene comprar</h2>
      <p className="mb-3 text-sm text-muted">Las prendas que más combinaciones nuevas te suman con lo que ya tenés.</p>
      <ol className="space-y-2">
        {list.map((s) => (
          <li key={s.name} className="flex items-center gap-3 rounded-xl border border-line p-3">
            <span className="text-2xl" aria-hidden>
              {s.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Swatch colorId={s.color} size={12} /> {s.name}
              </p>
              <p className="text-xs text-muted">
                +{s.gain} outfit{s.gain === 1 ? "" : "s"} nuevo{s.gain === 1 ? "" : "s"}
                {s.unlocks.length > 0 && <> · te sirve para {s.unlocks.join(", ").toLowerCase()}</>}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
