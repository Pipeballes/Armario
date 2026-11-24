"use client";

import { useState } from "react";
import { BODY_TYPES, SKIN_DEPTHS, UNDERTONES } from "@/lib/catalog";
import { AiUnavailable, analyzeProfile } from "@/lib/ai";
import type { ProfileAnalysis as Analysis } from "@/lib/ai-schema";
import { resizePhoto } from "@/lib/image";
import { actions, useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";

const label = (list: readonly { id: string; label: string }[], id: string | null) =>
  list.find((x) => x.id === id)?.label ?? "No se pudo ver";

export default function ProfileAnalysis() {
  const { account, profile } = useArmario();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!cloudEnabled) return null;

  if (!account) {
    return (
      <section className="card mb-6 border-accent p-4">
        <p className="mb-1 font-semibold">✨ Subí una foto tuya y la IA arma tu perfil</p>
        <p className="mb-3 text-sm text-muted">
          Te dice tu subtono, tu tono de piel y tu silueta en segundos. Para usar la IA primero entrá con tu mail (es
          gratis y sin contraseña).
        </p>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            const el = document.getElementById("cuenta");
            el?.scrollIntoView({ behavior: "smooth" });
            el?.querySelector("input")?.focus({ preventScroll: true });
          }}
        >
          Entrar con mi mail
        </button>
      </section>
    );
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const { dataUrl } = await resizePhoto(file, 1024);
      setResult(await analyzeProfile(dataUrl));
    } catch (e) {
      setMsg(
        e instanceof AiUnavailable
          ? "La IA todavía no está activada. Completá los datos a mano por ahora."
          : e instanceof Error
            ? e.message
            : "No se pudo analizar la foto.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function apply(r: Analysis) {
    await actions.saveProfile({
      ...profile,
      undertone: r.undertone ?? profile.undertone,
      skinDepth: r.skinDepth ?? profile.skinDepth,
      bodyType: r.bodyType ?? profile.bodyType,
      aiAdvice: r.advice || profile.aiAdvice,
    });
    setResult(null);
    setMsg("¡Listo! Guardé los datos en tu perfil. Podés corregirlos abajo.");
  }

  return (
    <section className="card mb-6 border-accent p-4">
      <p className="mb-1 font-semibold">✨ Subí una foto tuya y la IA arma tu perfil</p>
      <p className="mb-3 text-sm text-muted">
        Una foto con luz natural, sin filtros y, si podés, de cuerpo entero. Te sugiere tu subtono, tu tono de piel y tu
        silueta. La foto se manda a la IA de Google para analizarla y <strong>no se guarda</strong> en la app. Ojo: en
        el plan gratis, Google puede usarla para mejorar sus productos. Si preferís, completá todo a mano más abajo.
      </p>

      {!result && (
        <label className={`btn-primary w-full cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Analizando…" : "Elegir foto mía"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
      )}

      {result && (
        <div className="space-y-2 text-sm">
          <p>
            <strong>Subtono:</strong> {label(UNDERTONES, result.undertone)}
          </p>
          <p>
            <strong>Tono de piel:</strong> {label(SKIN_DEPTHS, result.skinDepth)}
          </p>
          <p>
            <strong>Silueta:</strong> {label(BODY_TYPES, result.bodyType)}
          </p>
          {result.advice && <p className="rounded-xl bg-accent-soft p-3">💡 {result.advice}</p>}
          <div className="flex gap-2 pt-1">
            <button className="btn-primary flex-1" onClick={() => apply(result)}>
              Usar estos datos
            </button>
            <button className="btn-ghost flex-1" onClick={() => setResult(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-2 text-sm">{msg}</p>}
      {profile.aiAdvice && !result && (
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">💡 {profile.aiAdvice}</p>
      )}
    </section>
  );
}
