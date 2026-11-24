"use client";

import { useState } from "react";
import { BODY_TYPES, SKIN_DEPTHS, UNDERTONES } from "@/lib/catalog";
import { AiUnavailable, analyzeProfile } from "@/lib/ai";
import type { ProfileAnalysis as Analysis } from "@/lib/ai-schema";
import { resizePhoto } from "@/lib/image";
import { actions, useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";

const MAX_PHOTOS = 5;

const label = (list: readonly { id: string; label: string }[], id: string | null) =>
  list.find((x) => x.id === id)?.label ?? "No se pudo ver";

export default function ProfileAnalysis() {
  const { account, profile } = useArmario();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  if (!cloudEnabled) return null;

  if (!account) {
    return (
      <section className="card mb-6 border-accent p-4">
        <p className="mb-1 font-semibold">✨ Subí fotos tuyas y la IA arma tu perfil</p>
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

  async function addPhotos(list: FileList | null) {
    // Copia: el navegador vacía la lista cuando se resetea el campo.
    const files = list ? [...list] : [];
    if (!files.length) return;
    setMsg(null);
    setResult(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    try {
      // Fotos más chicas para que entren varias en un solo envío.
      const added = await Promise.all(files.slice(0, room).map((f) => resizePhoto(f, 800).then((r) => r.dataUrl)));
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
      if (files.length > room) setMsg(`Hasta ${MAX_PHOTOS} fotos: usé las primeras.`);
    } catch {
      setMsg("No pude leer alguna de las fotos. Probá con otra.");
    }
  }

  async function analyze() {
    setBusy(true);
    setMsg(null);
    try {
      setResult(await analyzeProfile(photos));
    } catch (e) {
      setMsg(
        e instanceof AiUnavailable
          ? "La IA todavía no está activada. Completá los datos a mano por ahora."
          : e instanceof Error
            ? e.message
            : "No se pudieron analizar las fotos.",
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
    setPhotos([]);
    setMsg("¡Listo! Guardé los datos en tu perfil. Podés corregirlos abajo.");
  }

  return (
    <section className="card mb-6 border-accent p-4">
      <p className="mb-1 font-semibold">✨ Subí fotos tuyas y la IA arma tu perfil</p>
      <ol className="mb-2 list-decimal space-y-0.5 pl-5 text-sm">
        <li>
          Elegí <strong>de 1 a {MAX_PHOTOS} fotos</strong> tuyas (de frente, de costado, la cara con luz natural).
        </li>
        <li>
          Tocá <strong>✓ Listo</strong>.
        </li>
      </ol>
      <p className="mb-3 text-xs text-muted">
        Las fotos se mandan a la IA de Google para analizarlas y <strong>no se guardan</strong> en la app. En el plan
        gratis, Google puede usarlas para mejorar sus productos. Si preferís, completá todo a mano más abajo.
      </p>

      {!result && (
        <>
          {/* Paso 1: elegir fotos */}
          {photos.length === 0 && (
            <label className={`btn-primary w-full cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
              📷 Elegir fotos
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          {/* Paso 2: revisar y tocar Listo */}
          {photos.length > 0 && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-2 text-sm font-semibold">
                {photos.length === 1 ? "1 foto elegida" : `${photos.length} fotos elegidas`}
                {!busy && <span className="font-normal text-muted"> · tocá la ✕ para sacar una</span>}
              </p>
              <div className="mb-3 grid grid-cols-5 gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Foto ${i + 1}`} className="aspect-[3/4] w-full rounded-lg object-cover" />
                    {!busy && (
                      <button
                        type="button"
                        aria-label={`Quitar foto ${i + 1}`}
                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-black/70 text-xs text-white"
                        onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!busy && photos.length < MAX_PHOTOS && (
                  <label
                    className="flex aspect-[3/4] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line text-xl text-muted"
                    aria-label="Sumar más fotos"
                  >
                    ＋
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <button type="button" className="btn-primary w-full text-base" disabled={busy} onClick={analyze}>
                {busy ? "✨ Analizando… (puede tardar unos segundos)" : "✓ Listo"}
              </button>
            </div>
          )}
        </>
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
