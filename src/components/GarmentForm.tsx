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
import { guessColor, resizePhoto } from "@/lib/image";
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
  const [ai, setAi] = useState<"idle" | "working" | "done" | "error">("idle");
  const { account } = useArmario();
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { dataUrl, canvas } = await resizePhoto(file);
      const color = guessColor(canvas);
      setForm((f) => ({ ...f, photo: dataUrl, color }));
      setColorGuessed(true);
      if (account) {
        setAi("working");
        try {
          const r = await analyzeGarment(dataUrl);
          setForm((f) => ({ ...f, ...r, name: f.name || r.name }));
          setAi("done");
        } catch (e) {
          setAi(e instanceof AiUnavailable ? "idle" : "error");
        }
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
      setError("Falta la foto de la prenda.");
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
        setAi("idle");
        if (fileRef.current) fileRef.current.value = "";
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
      <Section title="Foto">
        <label className="card flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden bg-surface-2">
          {form.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photo} alt="Foto de la prenda" className="h-full w-full object-contain" />
          ) : (
            <span className="p-6 text-center text-muted">
              <span className="mb-2 block text-4xl">📷</span>
              Tocá para sacar o elegir una foto.
              <br />
              <span className="text-sm">Mejor sobre un fondo liso (cama, piso o pared).</span>
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
        </label>
      </Section>

      {ai === "working" && (
        <p className="card mb-6 animate-pulse bg-accent-soft p-3 text-sm">✨ La IA está mirando la foto…</p>
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
          {CATEGORIES.map((c) => (
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
