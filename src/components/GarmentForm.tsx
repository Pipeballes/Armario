"use client";

import { useRef, useState } from "react";
import {
  CATEGORIES,
  COLORS,
  FORMALITY_LABELS,
  SPECIAL_CATEGORIES,
  categoriesFor,
  SPORTS,
  kindById,
  kindsFor,
  STYLES,
  WARMTH,
  type Category,
  type StyleId,
} from "@/lib/catalog";
import { cleanBackground, guessColor, resizePhoto } from "@/lib/image";
import { AiUnavailable, analyzeGarment, type GarmentSide } from "@/lib/ai";
import { actions, newId, useArmario } from "@/lib/store";
import type { Garment } from "@/lib/types";
import { Chip, Section, Swatch } from "./ui";

const DEFAULT_FORMALITY: Record<Category, number> = {
  top: 2,
  bottom: 2,
  dress: 3,
  shoes: 2,
  outerwear: 3,
  accessory: 2,
  pijama: 1,
  interior: 1,
  malla: 1,
};

/** Prendas que necesitan foto de atrás (en el resto es opcional). */
export const needsBack = (c: Category) => c === "top" || c === "bottom" || c === "dress" || c === "outerwear";

type Side = "front" | "back" | "label";
const FIELD = {
  front: "photo",
  back: "photoBack",
  label: "photoLabel",
} as const;
const AI_SIDE: Record<Side, GarmentSide> = {
  front: "adelante",
  back: "atrás",
  label: "etiqueta",
};
const SIDES: Side[] = ["front", "back", "label"];

/** Talles más comunes, para tocar en vez de escribir. */
const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Único"];

/** Nombre del tipo (ej: "Short de pijama", o lo que escribiste si es "otro"). */
const KIND_TITLE: Record<Category, string> = {
  top: "¿Qué prenda de arriba es?",
  bottom: "¿Qué prenda de abajo es?",
  dress: "¿Qué tipo de vestido o enterito?",
  shoes: "¿Qué calzado es?",
  outerwear: "¿Qué abrigo es?",
  accessory: "¿Qué accesorio es?",
  pijama: "¿Qué prenda de pijama es?",
  interior: "¿Qué prenda de ropa interior es?",
  malla: "¿Qué malla es?",
};

function kindLabel(f: Pick<Garment, "category" | "kind" | "kindDetail">): string | null {
  if (!f.kind) return null;
  const base = f.kind === "otro" ? f.kindDetail?.trim() || "Prenda" : (kindById(f.category, f.kind)?.label ?? "Prenda");
  return f.category === "pijama" ? `${base} de pijama` : base;
}

function blank(): Omit<Garment, "id" | "createdAt"> {
  return {
    photo: "",
    name: "",
    category: "top",
    color: "negro",
    pattern: "liso",
    styles: ["casual"],
    formality: 2,
    warmth: "medium",
  };
}

export default function GarmentForm({
  initial,
  onDone,
  allowAnother = false,
}: {
  initial?: Garment;
  onDone: (another: boolean) => void;
  allowAnother?: boolean;
}) {
  const [form, setForm] = useState(() => (initial ? { ...initial } : blank()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorGuessed, setColorGuessed] = useState(false);
  // Foto original y con fondo limpio de cada lado, para poder elegir.
  const [versions, setVersions] = useState<Partial<Record<Side, { original: string; clean: string | null }>>>({});
  const [ai, setAi] = useState<"idle" | "working" | "done" | "error">("idle");
  const { account, profile } = useArmario();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const refs = { front: frontRef, back: backRef, label: labelRef };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Fotos para la IA, en orden: adelante, atrás, etiqueta (las que haya). */
  const photosFor = (f: typeof form) =>
    SIDES.filter((side) => f[FIELD[side]]).map((side) => ({
      src: f[FIELD[side]]!,
      side: AI_SIDE[side],
    }));

  /** onlySize: la IA ya completó todo; solo se toma el talle (para no pisar lo que corregiste). */
  async function analyze(next: typeof form, onlySize = false) {
    if (!account || !next.photo) return;
    setAi("working");
    try {
      const { size, ...r } = await analyzeGarment(photosFor(next));
      // Si la IA eligió un tipo que no corresponde a tu género (o a esa categoría), se deja para que lo elijas vos.
      if (!kindsFor(r.category, profile.gender).some((k) => k.id === r.kind)) r.kind = undefined;
      setForm((f) =>
        onlySize ? { ...f, size: f.size || size } : { ...f, ...r, name: f.name || r.name, size: f.size || size },
      );
      setAi("done");
    } catch (e) {
      setAi(e instanceof AiUnavailable ? (onlySize ? "done" : "idle") : "error");
    }
  }

  async function onPhoto(side: Side, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      // La etiqueta se guarda más grande y sin limpiar, para que se lea el texto.
      const { dataUrl: original, canvas } = await resizePhoto(file, side === "label" ? 1200 : 900);
      const clean = side === "label" ? null : cleanBackground(canvas);
      const dataUrl = clean ?? original;
      setVersions((v) => ({ ...v, [side]: { original, clean } }));
      const next = { ...form, [FIELD[side]]: dataUrl };
      if (side === "front") {
        next.color = guessColor(canvas);
        setColorGuessed(true);
      }
      setForm((f) => ({
        ...f,
        [FIELD[side]]: dataUrl,
        ...(side === "front" ? { color: next.color } : {}),
      }));
      if (ai === "working") return;
      if (side === "front") await analyze(next);
      else if (ai !== "done") await analyze(next);
      else if (side === "label" && !form.size) await analyze(next, true);
    } catch {
      setError("No se pudo leer esa foto. Probá con otra.");
    }
  }

  /** Marca si es deportiva (y de qué deporte); si lo es, suma el estilo deportivo. */
  function setSport(sport: string | undefined) {
    setForm((f) => ({
      ...f,
      sport,
      styles: sport && !f.styles.includes("deportivo") ? [...f.styles, "deportivo"] : f.styles,
      formality: sport ? Math.min(f.formality, 2) : f.formality,
    }));
  }

  function toggleStyle(id: StyleId) {
    setForm((f) => ({
      ...f,
      styles: f.styles.includes(id) ? f.styles.filter((s) => s !== id) : [...f.styles, id],
    }));
  }

  async function save(another: boolean) {
    if (!form.photo) {
      setError("Falta la foto de adelante de la prenda.");
      return;
    }
    if (!form.photoBack && needsBack(form.category)) {
      setError("Falta la foto de atrás de la prenda (dala vuelta y sacale otra).");
      return;
    }
    if (!form.kind) {
      setError("Elegí qué tipo de prenda es (remera, jean, zapatillas…).");
      document.getElementById("tipo")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (form.kind === "otro" && !form.kindDetail?.trim()) {
      setError("Escribí qué prenda es.");
      return;
    }
    if (!form.size?.trim()) {
      setError("Falta el talle. Escribilo o sacale foto a la etiqueta.");
      document.getElementById("talle")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    const cat = CATEGORIES.find((c) => c.id === form.category)!;
    const garment: Garment = {
      ...form,
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? Date.now(),
      name:
        form.name.trim() ||
        `${kindLabel(form) ?? cat.label} ${COLORS.find((c) => c.id === form.color)?.label.toLowerCase()}`,
      sport: SPECIAL_CATEGORIES.includes(form.category) ? undefined : form.sport,
      kind: form.kind,
      kindDetail: form.kind === "otro" ? form.kindDetail?.trim() : undefined,
    };
    try {
      await actions.saveGarment(garment);
      if (another) {
        setForm({
          ...blank(),
          category: form.category,
          formality: DEFAULT_FORMALITY[form.category],
        });
        setColorGuessed(false);
        setVersions({});
        setAi("idle");
        if (frontRef.current) frontRef.current.value = "";
        if (backRef.current) backRef.current.value = "";
        if (labelRef.current) labelRef.current.value = "";
      }
      onDone(another);
    } catch {
      setError("No se pudo guardar. Puede que el navegador no tenga más espacio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <Section
        title="Fotos"
        hint={
          needsBack(form.category)
            ? "Sacale una de adelante y otra de atrás (dala vuelta), sobre un fondo liso."
            : "La de atrás es opcional en este tipo de prenda."
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {SIDES.map((side) => {
            const src = form[FIELD[side]];
            const v = versions[side];
            const required = side === "front" || (side === "back" && needsBack(form.category));
            return (
              <div key={side}>
                <label className="card flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden bg-surface-2">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={
                        side === "front"
                          ? "Adelante de la prenda"
                          : side === "back"
                            ? "Atrás de la prenda"
                            : "Etiqueta de la prenda"
                      }
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="p-2 text-center text-xs text-muted">
                      <span className="mb-1 block text-2xl">
                        {side === "front" ? "📷" : side === "back" ? "🔄" : "🏷️"}
                      </span>
                      {side === "front"
                        ? "Foto de adelante"
                        : side === "back"
                          ? "Foto de atrás"
                          : "Foto de la etiqueta"}
                    </span>
                  )}
                  <input
                    ref={refs[side]}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={
                      side === "front" ? "Foto de adelante" : side === "back" ? "Foto de atrás" : "Foto de la etiqueta"
                    }
                    onChange={(e) => onPhoto(side, e.target.files?.[0])}
                  />
                </label>
                <p className="mt-1 text-center text-xs font-semibold">
                  {side === "front" ? "Adelante" : side === "back" ? "Atrás" : "Etiqueta"}
                  {!required && <span className="font-normal text-muted"> (opcional)</span>}
                </p>
                {v?.clean && src && (
                  <button
                    type="button"
                    className="mx-auto block text-xs text-accent underline"
                    onClick={() => update(FIELD[side], src === v.clean ? v.original : v.clean!)}
                  >
                    {src === v.clean ? "Usar la original" : "Limpiar fondo"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {ai === "working" && (
        <p className="card mb-6 animate-pulse bg-accent-soft p-3 text-sm">✨ La IA está mirando la prenda…</p>
      )}
      {ai === "done" && (
        <p className="card mb-6 bg-accent-soft p-3 text-sm">
          ✨ La IA completó los datos. Revisalos y corregí lo que haga falta.
        </p>
      )}
      {ai === "error" && (
        <p className="card mb-6 p-3 text-sm text-muted">No pude analizar la foto con IA. Completalo a mano.</p>
      )}

      <Section title="Categoría">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => categoriesFor(profile.gender).includes(c) || form.category === c.id).map(
            (c) => (
              <Chip
                key={c.id}
                pressed={form.category === c.id}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    category: c.id,
                    formality: initial ? f.formality : DEFAULT_FORMALITY[c.id],
                    kind: kindById(c.id, f.kind) ? f.kind : undefined,
                  }))
                }
              >
                <span aria-hidden>{c.emoji}</span> {c.label}
              </Chip>
            ),
          )}
        </div>
      </Section>

      <div id="tipo">
        <Section title={KIND_TITLE[form.category]}>
          <div className="flex flex-wrap gap-2">
            {kindsFor(form.category, profile.gender).map((k) => (
              <Chip key={k.id} pressed={form.kind === k.id} onClick={() => update("kind", k.id)}>
                {k.label}
              </Chip>
            ))}
          </div>
          {form.kind === "otro" && (
            <input
              className="input mt-2"
              value={form.kindDetail ?? ""}
              onChange={(e) => update("kindDetail", e.target.value.slice(0, 40))}
              placeholder="Escribí qué es"
              aria-label="Qué prenda es"
            />
          )}
        </Section>
      </div>

      <Section
        title="Color principal"
        hint={colorGuessed && ai !== "done" ? "Lo adiviné por la foto. Si no es, tocá el correcto." : undefined}
      >
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <Chip key={c.id} pressed={form.color === c.id} onClick={() => update("color", c.id)}>
              <Swatch colorId={c.id} /> {c.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="¿Lisa o estampada?">
        <div className="flex gap-2">
          <Chip pressed={form.pattern === "liso"} onClick={() => update("pattern", "liso")}>
            Lisa
          </Chip>
          <Chip pressed={form.pattern === "estampado"} onClick={() => update("pattern", "estampado")}>
            Estampada / rayada / a cuadros
          </Chip>
        </div>
      </Section>

      {!SPECIAL_CATEGORIES.includes(form.category) && (
        <Section title="¿Es deportiva?">
          <div className="flex gap-2">
            <Chip pressed={!form.sport} onClick={() => setSport(undefined)}>
              No
            </Chip>
            <Chip pressed={Boolean(form.sport)} onClick={() => setSport(form.sport || "general")}>
              🏃 Sí, es deportiva
            </Chip>
          </div>
          {form.sport && (
            <>
              <p className="mt-3 mb-2 text-sm text-muted">
                ¿Para qué deporte? Así la uso cuando tengas ese deporte en la agenda.
              </p>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((sp) => (
                  <Chip key={sp.id} pressed={form.sport === sp.id} onClick={() => setSport(sp.id)}>
                    <span aria-hidden>{sp.emoji}</span> {sp.label}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      <Section title="Estilo" hint="Podés elegir más de uno.">
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <Chip key={s.id} pressed={form.styles.includes(s.id)} onClick={() => toggleStyle(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={`Qué tan arreglada es: ${FORMALITY_LABELS[form.formality]}`}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={form.formality}
          onChange={(e) => update("formality", Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Formalidad"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>Para estar en casa</span>
          <span>Para un casamiento</span>
        </div>
      </Section>

      <Section title="¿Para qué clima?">
        <div className="flex flex-wrap gap-2">
          {WARMTH.map((w) => (
            <Chip key={w.id} pressed={form.warmth === w.id} onClick={() => update("warmth", w.id)}>
              {w.label}
            </Chip>
          ))}
        </div>
      </Section>

      <div id="talle">
        <Section
          title="Talle"
          hint={
            form.photoLabel && ai === "done" && form.size
              ? "Lo leí de la etiqueta. Si no es, corregilo."
              : "Escribilo o sacale foto a la etiqueta y lo leo yo."
          }
        >
          <div className="mb-2 flex flex-wrap gap-2">
            {QUICK_SIZES.map((sz) => (
              <Chip key={sz} pressed={form.size === sz} onClick={() => update("size", sz)}>
                {sz}
              </Chip>
            ))}
          </div>
          <input
            className="input"
            value={form.size ?? ""}
            onChange={(e) => update("size", e.target.value.slice(0, 12))}
            placeholder="Ej: M, 42, 10, 38/40"
            aria-label="Talle"
          />
        </Section>
      </div>

      <Section title="Nombre (opcional)">
        <input
          className="input"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Ej: camisa blanca de lino"
        />
      </Section>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        <button type="submit" className="btn-primary" disabled={busy || ai === "working"}>
          {busy ? "Guardando…" : initial ? "Guardar cambios" : "Guardar prenda"}
        </button>
        {allowAnother && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => save(true)}>
            Guardar y cargar otra
          </button>
        )}
      </div>
    </form>
  );
}
