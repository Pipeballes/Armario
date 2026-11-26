"use client";

import Link from "next/link";
import { useState } from "react";
import { COLORS } from "@/lib/catalog";
import { actions, useArmario } from "@/lib/store";
import type { Garment } from "@/lib/types";
import GarmentForm from "@/components/GarmentForm";
import Placard from "@/components/Placard";
import ShoppingCard from "@/components/ShoppingCard";
import { Chip, ErrorBox, Loading, Swatch } from "@/components/ui";

export default function ArmarioPage() {
  const { ready, garments, profile, error } = useArmario();
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
  const shown = color ? garments.filter((g) => g.color === color) : garments;

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Tu armario</h1>
          <p className="text-sm text-muted">
            {garments.length} {garments.length === 1 ? "prenda" : "prendas"}, cada una en su lugar
          </p>
        </div>
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
          {usedColors.length > 1 && (
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip pressed={!color} onClick={() => setColor(null)}>
                Todos los colores
              </Chip>
              {usedColors.map((c) => (
                <Chip key={c.id} pressed={color === c.id} onClick={() => setColor(color === c.id ? null : c.id)}>
                  <Swatch colorId={c.id} /> {c.label}
                </Chip>
              ))}
            </div>
          )}
          <Placard garments={shown} gender={profile.gender} onPick={setEditing} />
          <ShoppingCard garments={garments} profile={profile} />
        </>
      )}
    </div>
  );
}
