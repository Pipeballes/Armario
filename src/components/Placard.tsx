"use client";

import Link from "next/link";
import { useState } from "react";
import { countUnit } from "@/lib/catalog";
import { fillPlacard, type FilledZone } from "@/lib/placard";
import type { Garment } from "@/lib/types";
import GarmentPhoto from "./GarmentPhoto";

/** Perchita dibujada arriba de cada prenda colgada. */
function Hanger() {
  return (
    <svg viewBox="0 0 48 22" className="mx-auto -mb-1 block h-5 w-12 text-rod" aria-hidden>
      <path
        d="M24 9 V6 a3 3 0 1 1 3 -3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M24 9 L4 19 H44 Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function Tile({ g, onPick, small = false }: { g: Garment; onPick: (g: Garment) => void; small?: boolean }) {
  const qty = g.quantity && g.quantity > 1 ? g.quantity : 0;
  return (
    <button
      type="button"
      onClick={() => onPick(g)}
      className={`${small ? "w-20" : "w-24"} shrink-0 snap-start text-left`}
      aria-label={`${g.name}${qty ? `, ${qty} ${countUnit(g.kind, qty)}` : ""}`}
    >
      <GarmentPhoto garment={g} className="shadow-sm" />
      <p className="mt-1 truncate text-xs font-medium">{g.name}</p>
      {(g.size || qty > 0) && (
        <p className="truncate text-[11px] text-muted">
          {g.size ? `Talle ${g.size}` : ""}
          {g.size && qty ? " · " : ""}
          {qty ? `${qty} ${countUnit(g.kind, qty)}` : ""}
        </p>
      )}
    </button>
  );
}

function Empty({ z }: { z: FilledZone }) {
  return (
    <Link
      href={`/armario/nueva?categoria=${z.zone.addCategory}`}
      className="flex h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-wood/50 px-3 text-center text-xs text-muted"
    >
      Vacío · {z.zone.empty}
      <br />＋ Agregar
    </Link>
  );
}

function Row({ z, onPick }: { z: FilledZone; onPick: (g: Garment) => void }) {
  if (!z.items.length) return <Empty z={z} />;
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {z.items.map((g) => (
        <Tile key={g.id} g={g} onPick={onPick} />
      ))}
    </div>
  );
}

function Title({ z }: { z: FilledZone }) {
  const label =
    z.zone.id === "medias"
      ? `${z.units} ${z.units === 1 ? "par" : "pares"}`
      : z.units !== z.items.length
        ? `${z.units} (${z.items.length} modelos)`
        : String(z.items.length);
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="rounded-md bg-wood px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
        <span aria-hidden>{z.zone.emoji}</span> {z.zone.title}
      </span>
      {z.items.length > 0 && <span className="text-xs text-muted">{label}</span>}
    </div>
  );
}

/** Tabla de madera que separa los lugares del placard. */
const Plank = () => <div aria-hidden className="h-2.5 bg-wood shadow-[0_2px_0_var(--wood-dark)]" />;

function Barral({ z, onPick }: { z: FilledZone; onPick: (g: Garment) => void }) {
  return (
    <section id={`zona-${z.zone.id}`} className="scroll-mt-20 px-3 pt-3">
      <Title z={z} />
      <div className="relative">
        <div aria-hidden className="absolute top-0.5 right-0 left-0 h-1.5 rounded-full bg-rod shadow-sm" />
        {z.items.length ? (
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
            {z.items.map((g) => (
              <div key={g.id} className="shrink-0">
                <Hanger />
                <Tile g={g} onPick={onPick} />
              </div>
            ))}
          </div>
        ) : (
          <div className="pt-4 pb-3">
            <Empty z={z} />
          </div>
        )}
      </div>
    </section>
  );
}

function Estante({ z, onPick }: { z: FilledZone; onPick: (g: Garment) => void }) {
  return (
    <section id={`zona-${z.zone.id}`} className="scroll-mt-20 px-3 pt-3 pb-1">
      <Title z={z} />
      <Row z={z} onPick={onPick} />
    </section>
  );
}

function Cajon({ z, onPick }: { z: FilledZone; onPick: (g: Garment) => void }) {
  const [open, setOpen] = useState(z.items.length > 0 && z.items.length <= 3);
  return (
    <section id={`zona-${z.zone.id}`} className="scroll-mt-20 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg border border-wood-dark/40 bg-wood/90 px-3 py-2.5 text-left text-white shadow-sm"
      >
        <span className="text-lg" aria-hidden>
          {z.zone.emoji}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{z.zone.title}</span>
          <span className="block text-[11px] opacity-90">
            {z.items.length === 0
              ? "Vacío"
              : z.zone.id === "medias"
                ? `${z.units} ${z.units === 1 ? "par" : "pares"}`
                : z.units !== z.items.length
                  ? `${z.units} prendas · ${z.items.length} modelos`
                  : `${z.items.length} ${z.items.length === 1 ? "prenda" : "prendas"}`}
          </span>
        </span>
        {/* Manija del cajón */}
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-wood-dark shadow-inner" />
        <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-surface-2/70 p-2 shadow-inner">
          <Row z={z} onPick={onPick} />
        </div>
      )}
    </section>
  );
}

function Organizador({ z, onPick }: { z: FilledZone; onPick: (g: Garment) => void }) {
  return (
    <section id={`zona-${z.zone.id}`} className="scroll-mt-20 px-3 pt-3 pb-2">
      <Title z={z} />
      {z.items.length ? (
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border-2 border-wood bg-wood">
          {z.items.map((g) => (
            <div key={g.id} className="flex justify-center bg-closet-in p-1.5">
              <Tile g={g} onPick={onPick} small />
            </div>
          ))}
          {/* Casilleros vacíos para completar la fila */}
          {Array.from({ length: (4 - (z.items.length % 4)) % 4 }, (_, i) => (
            <div key={`vacio-${i}`} aria-hidden className="bg-closet-in" />
          ))}
        </div>
      ) : (
        <Empty z={z} />
      )}
    </section>
  );
}

function Zapatero({ z, onPick }: { z: FilledZone; onPick: (g: Garment) => void }) {
  return (
    <section id={`zona-${z.zone.id}`} className="scroll-mt-20 px-3 pt-3 pb-3">
      <Title z={z} />
      <Row z={z} onPick={onPick} />
      {/* Barrotes del zapatero */}
      <div aria-hidden className="mt-1 h-1.5 -skew-x-12 rounded-full bg-wood-dark/80" />
    </section>
  );
}

/**
 * El armario como un placard: barral con perchas arriba, estantes con la ropa doblada, cajones para
 * ropa interior, medias, pijamas y mallas, organizador de accesorios y zapatero abajo.
 */
export default function Placard({
  garments,
  gender,
  onPick,
}: {
  garments: Garment[];
  gender: string | null | undefined;
  onPick: (g: Garment) => void;
}) {
  const zones = fillPlacard(garments, gender);
  const by = Object.fromEntries(zones.map((z) => [z.zone.id, z]));
  const drawers = zones.filter((z) => z.zone.kind === "cajon");
  return (
    <div className="overflow-hidden rounded-3xl border-[10px] border-wood bg-closet-in shadow-[inset_0_0_24px_rgba(0,0,0,0.08)]">
      <Barral z={by.colgados} onPick={onPick} />
      <Plank />
      <Estante z={by.arriba} onPick={onPick} />
      <Plank />
      <Estante z={by.abajo} onPick={onPick} />
      <Plank />
      <div className="py-1">
        {drawers.map((z) => (
          <Cajon key={z.zone.id} z={z} onPick={onPick} />
        ))}
      </div>
      <Plank />
      <Organizador z={by.accesorios} onPick={onPick} />
      <Plank />
      <Zapatero z={by.calzado} onPick={onPick} />
    </div>
  );
}

/** Versión chica para el Inicio: cada lugar del placard con cuántas prendas tiene y unas fotitos. */
export function PlacardPreview({ garments, gender }: { garments: Garment[]; gender: string | null | undefined }) {
  const zones = fillPlacard(garments, gender);
  return (
    <div className="overflow-hidden rounded-3xl border-[8px] border-wood bg-closet-in">
      {zones.map((z, i) => (
        <Link
          key={z.zone.id}
          href={`/armario#zona-${z.zone.id}`}
          className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t-4 border-wood" : ""}`}
        >
          <span className="w-7 text-center text-xl" aria-hidden>
            {z.zone.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{z.zone.title}</span>
            <span className="block text-xs text-muted">
              {z.items.length === 0
                ? "Vacío"
                : z.zone.id === "medias"
                  ? `${z.units} ${z.units === 1 ? "par" : "pares"}`
                  : `${z.units} ${z.units === 1 ? "prenda" : "prendas"}`}
            </span>
          </span>
          <span className="flex -space-x-3">
            {z.items.slice(0, 3).map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={g.id}
                src={g.photo}
                alt=""
                className="h-9 w-9 rounded-full border-2 border-closet-in bg-surface-2 object-cover"
              />
            ))}
          </span>
        </Link>
      ))}
    </div>
  );
}
