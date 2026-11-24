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

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    setResult(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    try {
      // Fotos más chicas para que entren varias en un solo envío.
      const added = await Promise.all([...files].slice(0, room).map((f) => resizePhoto(f, 800).then((r) => r.dataUrl)));
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
      <p className="mb-2 text-sm text-muted">
        Subí <strong>de 1 a {MAX_PHOTOS} fotos</strong>: de frente, de costado, de cuerpo entero y una de la cara con luz
        natural. Con varias, la IA combina todo y no se queda con una sola impresión.
      </p>
      <p className="mb-3 text-xs text-muted">
        Las fotos se mandan a la IA de Google para analizarlas y <strong>no se guardan</strong> en la app. En el plan
        gratis, Google puede usarlas para mejorar sus productos. Si preferís, completá todo a mano más abajo.
      </p>

      {!result && (
        <>
          {photos.length > 0 && (
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
            </div>
          )}
          <div className="flex flex-col gap-2">
            {photos.length < MAX_PHOTOS && (
              <label
                className={`${photos.length ? "btn-ghost" : "btn-primary"} w-full cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}
              >
                {photos.length ? "＋ Agregar otra foto" : "Elegir fotos mías"}
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
            {photos.length > 0 && (
              <button type="button" className="btn-primary w-full" disabled={busy} onClick={analyze}>
                {busy
                  ? `Analizando ${photos.length === 1 ? "la foto" : `las ${photos.length} fotos`}…`
                  : `✨ Analizar ${photos.length === 1 ? "1 foto" : `${photos.length} fotos`}`}
              </button>
            )}
          </div>
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
