"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SLOTS,
  bodyDims,
  lookFrom,
  selectionFrom,
  skinColor,
  slotOf,
  type Selection,
  type Slot,
  type View,
  PROBAR_KEY,
  HAIRS,
  HAIR_COLORS,
  avatarOf,
} from "@/lib/avatar";
import { suggestOutfits } from "@/lib/outfits";
import { actions, useArmario } from "@/lib/store";
import type { AvatarStyle } from "@/lib/types";
import GarmentPhoto from "@/components/GarmentPhoto";
import { ErrorBox, Loading } from "@/components/ui";

// El 3D solo corre en el navegador.
const Avatar3D = dynamic(() => import("@/components/Avatar3D"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Armando tu avatar…</div>,
});

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "frente", label: "Frente", hint: "" },
  { id: "costado", label: "Costado", hint: "" },
  { id: "espalda", label: "Espalda", hint: "" },
  { id: "cara", label: "🙂 Cara", hint: "" },
  { id: "otro", label: "👀 Cómo te ven", hint: "Así te vería alguien parado a unos 2 metros, a la altura de sus ojos." },
];


function initialSelection(): Selection {
  try {
    const raw = sessionStorage.getItem(PROBAR_KEY);
    if (raw) {
      sessionStorage.removeItem(PROBAR_KEY);
      return JSON.parse(raw) as Selection;
    }
  } catch {
    /* sin almacenamiento: se arranca vacío */
  }
  return {};
}

export default function ProbadorPage() {
  const { ready, garments, profile, error } = useArmario();
  const [sel, setSel] = useState<Selection>(initialSelection);
  const [slot, setSlot] = useState<Slot>("top");
  const [view, setView] = useState<View>("frente");
  const [touched, setTouched] = useState(false);
  const [editing, setEditing] = useState(false);

  const dims = useMemo(() => bodyDims(profile), [profile]);
  const skin = useMemo(() => skinColor(profile), [profile]);
  const look = useMemo(() => lookFrom(sel, garments), [sel, garments]);
  const style = useMemo(() => avatarOf(profile), [profile]);

  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const topIsDress = garments.find((g) => g.id === sel.top)?.category === "dress";
  const options = garments.filter((g) => slotOf(g) === slot);
  const missingProfile = !profile.bodyType || !profile.skinDepth || !profile.height;

  const setStyle = (patch: Partial<AvatarStyle>) => actions.saveProfile({ ...profile, avatar: { ...style, ...patch } });

  function pick(id: string | null) {
    setSel((s) => {
      const next = { ...s };
      if (id) next[slot] = id;
      else delete next[slot];
      return next;
    });
  }

  function surprise() {
    const r = suggestOutfits(garments, { occasion: "casual", weather: "templado", profile, random: Math.random });
    if (r.outfits[0]) setSel(selectionFrom(r.outfits[0].items));
  }

  const current = VIEWS.find((v) => v.id === view)!;

  return (
    <div>
      <h1 className="page-title mb-1">Probador 3D</h1>
      <p className="mb-4 text-sm text-muted">Elegí ropa de tu armario y mirá cómo te queda.</p>

      <div className="card relative mb-3 h-[58vh] min-h-[340px] overflow-hidden p-0">
        <Avatar3D dims={dims} skin={skin} look={look} view={view} style={style} onUserMove={() => setTouched(true)} />
        {!touched && view !== "otro" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted">
            👆 Arrastrá para girar · 🤏 pellizcá para acercar
          </p>
        )}
        {view === "otro" && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-white/85 p-2 text-center text-xs text-[#221d18]">
            {current.hint}
          </p>
        )}
      </div>

      <div className="mb-5 grid grid-cols-5 gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
            className={`rounded-xl border px-1 py-2 text-xs font-semibold ${
              view === v.id ? "border-accent bg-accent-soft" : "border-line bg-surface"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="card mb-4 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-semibold"
          aria-expanded={editing}
          onClick={() => setEditing((e) => !e)}
        >
          <span>✏️ Personalizá tu avatar</span>
          <span className="text-muted">{editing ? "▲" : "▼"}</span>
        </button>
        {editing && (
          <div className="mt-3 space-y-3">
            <div>
              <span className="label">Peinado</span>
              <div className="flex flex-wrap gap-2">
                {HAIRS.map((h) => (
                  <button key={h.id} type="button" className="chip" aria-pressed={style.hair === h.id} onClick={() => setStyle({ hair: h.id })}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Color de pelo</span>
              <div className="flex flex-wrap gap-2">
                {HAIR_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    aria-label={c.label}
                    aria-pressed={style.hairColor === c.hex}
                    onClick={() => setStyle({ hairColor: c.hex })}
                    className={`h-9 w-9 rounded-full border-2 ${style.hairColor === c.hex ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="label">Barba</span>
              <div className="flex gap-2">
                <button type="button" className="chip" aria-pressed={!style.beard} onClick={() => setStyle({ beard: false })}>
                  Sin barba
                </button>
                <button type="button" className="chip" aria-pressed={style.beard} onClick={() => setStyle({ beard: true })}>
                  Con barba
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">La altura, la silueta y el tono de piel salen de tu Perfil.</p>
          </div>
        )}
      </div>

      {missingProfile && (
        <Link href="/perfil" className="card mb-4 block p-3 text-sm">
          💡 Completá tu <strong>altura, silueta y tono de piel</strong> en Perfil para que el avatar se parezca más a
          vos.
        </Link>
      )}

      {garments.length === 0 ? (
        <div className="card p-5 text-center">
          <p className="mb-3 text-sm text-muted">Cargá ropa en tu armario para probártela.</p>
          <Link href="/armario/nueva" className="btn-primary">
            Cargar ropa
          </Link>
        </div>
      ) : (
        <>
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {SLOTS.map((s) => {
              const chosen = garments.find((g) => g.id === sel[s.id]);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="chip shrink-0"
                  aria-pressed={slot === s.id}
                  onClick={() => setSlot(s.id)}
                >
                  <span aria-hidden>{s.emoji}</span> {s.label}
                  {chosen && <span className="text-ok">✓</span>}
                </button>
              );
            })}
          </div>

          {slot === "bottom" && topIsDress && (
            <p className="mb-2 text-sm text-muted">Tenés puesto un vestido: lo de abajo no se ve.</p>
          )}

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            <button
              type="button"
              onClick={() => pick(null)}
              aria-pressed={!sel[slot]}
              className={`flex aspect-square w-20 shrink-0 items-center justify-center rounded-xl border text-xs ${
                !sel[slot] ? "border-accent bg-accent-soft font-semibold" : "border-line bg-surface text-muted"
              }`}
            >
              Nada
            </button>
            {options.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => pick(g.id)}
                aria-pressed={sel[slot] === g.id}
                aria-label={g.name}
                className={`w-20 shrink-0 rounded-xl border-2 p-0.5 ${sel[slot] === g.id ? "border-accent" : "border-transparent"}`}
              >
                <GarmentPhoto garment={g} />
                <span className="mt-0.5 block truncate text-[11px]">{g.name}</span>
              </button>
            ))}
            {options.length === 0 && (
              <p className="self-center text-sm text-muted">No tenés prendas de este tipo todavía.</p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={surprise}>
              🎲 Sorprendeme
            </button>
            <button type="button" className="btn-ghost flex-1" onClick={() => setSel({})}>
              Sacar todo
            </button>
          </div>
        </>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        El avatar es un maniquí con tus proporciones y los colores de tu ropa: sirve para ver combinaciones, no es una
        foto exacta.
      </p>
    </div>
  );
}
