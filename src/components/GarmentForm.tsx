"use client";

import { useRef, useState } from "react";
import {
  CATEGORIES,
  COLORS,
  FORMALITY_LABELS,
  STYLES,
  WARMTH,
  type Category,
  type StyleId,
} from "@/lib/catalog";
import { cleanBackground, guessColor, resizePhoto } from "@/lib/image";
import { AiUnavailable, analyzeGarment } from "@/lib/ai";
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
};

/** Prendas que necesitan foto de atrás (en calzado y accesorios es opcional). */
export const needsBack = (c: Category) => c === "top" || c === "bottom" || c === "dress" || c === "outerwear";

type Side = "front" | "back";
const FIELD = { front: "photo", back: "photoBack" } as const;

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

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function analyze(images: string[]) {
    if (!account || !images.length) return;
    setAi("working");
    try {
      const r = await analyzeGarment(images);
      setForm((f) => ({ ...f, ...r, name: f.name || r.name }));
      setAi("done");
    } catch (e) {
      setAi(e instanceof AiUnavailable ? "idle" : "error");
    }
  }

  async function onPhoto(side: Side, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { dataUrl: original, canvas } = await resizePhoto(file);
      const clean = cleanBackground(canvas);
      const dataUrl = clean ?? original;
      setVersions((v) => ({ ...v, [side]: { original, clean } }));
      if (side === "front") {
        const color = guessColor(canvas);
        setForm((f) => ({ ...f, photo: dataUrl, color }));
        setColorGuessed(true);
        // Con foto nueva de adelante, la IA vuelve a mirar (con la de atrás si ya está).
        await analyze([dataUrl, form.photoBack].filter((x): x is string => Boolean(x)));
      } else {
        setForm((f) => ({ ...f, photoBack: dataUrl }));
        // Si la de adelante ya estaba pero la IA todavía no la vio, analiza las dos juntas.
        if (form.photo && ai !== "done" && ai !== "working") await analyze([form.photo, dataUrl]);
      }
    } catch {
      setError("No se pudo leer esa foto. Probá con otra.");
    }
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
    setBusy(true);
    const cat = CATEGORIES.find((c) => c.id === form.category)!;
    const garment: Garment = {
      ...form,
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? Date.now(),
      name: form.name.trim() || `${cat.label} ${COLORS.find((c) => c.id === form.color)?.label.toLowerCase()}`,
    };
    try {
      await actions.saveGarment(garment);
      if (another) {
        setForm({ ...blank(), category: form.category, formality: DEFAULT_FORMALITY[form.category] });
        setColorGuessed(false);
        setVersions({});
        setAi("idle");
        if (frontRef.current) frontRef.current.value = "";
        if (backRef.current) backRef.current.value = "";
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
            : "La de atrás es opcional en calzado y accesorios."
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {(["front", "back"] as const).map((side) => {
            const src = form[FIELD[side]];
            const v = versions[side];
            const required = side === "front" || needsBack(form.category);
            return (
              <div key={side}>
                <label className="card flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden bg-surface-2">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={side === "front" ? "Adelante de la prenda" : "Atrás de la prenda"}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="p-3 text-center text-sm text-muted">
                      <span className="mb-1 block text-3xl">{side === "front" ? "📷" : "🔄"}</span>
                      {side === "front" ? "Tocá para la foto de adelante" : "Tocá para la foto de atrás"}
                    </span>
                  )}
                  <input
                    ref={side === "front" ? frontRef : backRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={side === "front" ? "Foto de adelante" : "Foto de atrás"}
                    onChange={(e) => onPhoto(side, e.target.files?.[0])}
                  />
                </label>
                <p className="mt-1 text-center text-xs font-semibold">
                  {side === "front" ? "Adelante" : "Atrás"}
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

      <Section title="¿Qué es?">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== "dress" || profile.gender !== "hombre" || form.category === "dress").map((c) => (
            <Chip
              key={c.id}
              pressed={form.category === c.id}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  category: c.id,
                  formality: initial ? f.formality : DEFAULT_FORMALITY[c.id],
                }))
              }
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </Chip>
          ))}
        </div>
      </Section>

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
