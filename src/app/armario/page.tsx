"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIES, COLORS, colorById, type Category } from "@/lib/catalog";
import { actions, useArmario } from "@/lib/store";
import type { Garment } from "@/lib/types";
import GarmentForm from "@/components/GarmentForm";
import GarmentPhoto from "@/components/GarmentPhoto";
import { Chip, ErrorBox, Loading, Swatch } from "@/components/ui";

export default function ArmarioPage() {
  const { ready, garments, error } = useArmario();
  const [category, setCategory] = useState<Category | "all">("all");
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Garment | null>(null);

  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  if (editing) {
    return (
      <div>
        <button className="mb-4 text-sm text-accent" onClick={() => setEditing(null)}>
          ← Volver al armario
        </button>
        <h1 className="page-title mb-6">Editar prenda</h1>
        <GarmentForm initial={editing} onDone={() => setEditing(null)} />
        <button
          className="btn mt-3 w-full text-danger"
          onClick={async () => {
            if (confirm(`¿Borrar "${editing.name}" del armario?`)) {
              await actions.deleteGarment(editing.id);
              setEditing(null);
            }
          }}
        >
          Borrar prenda
        </button>
      </div>
    );
  }

  const usedColors = COLORS.filter((c) => garments.some((g) => g.color === c.id));
  const shown = garments.filter(
    (g) => (category === "all" || g.category === category) && (!color || g.color === color),
  );

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="page-title">Tu armario</h1>
        <Link href="/armario/nueva" className="btn-primary shrink-0">
          + Agregar
        </Link>
      </header>

      {garments.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="mb-2 text-4xl">🚪</p>
          <p className="mb-1 font-semibold">Tu armario está vacío</p>
          <p className="mb-5 text-sm text-muted">Empezá sacándole foto a la ropa que más usás.</p>
          <Link href="/armario/nueva" className="btn-primary">
            Cargar mi primera prenda
          </Link>
        </div>
      ) : (
        <>
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip pressed={category === "all"} onClick={() => setCategory("all")}>
              Todo ({garments.length})
            </Chip>
            {CATEGORIES.map((c) => {
              const count = garments.filter((g) => g.category === c.id).length;
              if (count === 0) return null;
              return (
                <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(c.id)}>
                  <span aria-hidden>{c.emoji}</span> {c.plural} ({count})
                </Chip>
              );
            })}
          </div>

          {usedColors.length > 1 && (
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {usedColors.map((c) => (
                <Chip key={c.id} pressed={color === c.id} onClick={() => setColor(color === c.id ? null : c.id)}>
                  <Swatch colorId={c.id} /> {c.label}
                </Chip>
              ))}
            </div>
          )}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((g) => (
              <li key={g.id}>
                <button className="w-full text-left" onClick={() => setEditing(g)}>
                  <GarmentPhoto garment={g} />
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <Swatch colorId={g.color} size={10} />
                    <span className="truncate">{g.name}</span>
                  </p>
                  <p className="text-xs text-muted">{colorById(g.color).label}</p>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="py-8 text-center text-muted">No hay prendas con ese filtro.</p>}
        </>
      )}
    </div>
  );
}
