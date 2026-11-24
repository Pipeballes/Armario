"use client";

import { useState } from "react";
import { BODY_TYPES, PALETTE_BY_UNDERTONE, SKIN_DEPTHS, UNDERTONES, colorById, type Undertone } from "@/lib/catalog";
import { Swatch } from "./ui";
import { AiUnavailable, analyzeProfile } from "@/lib/ai";
import type { ProfileAnalysis as Analysis } from "@/lib/ai-schema";
import { HAIRS, HAIR_COLOR_BY_ID, GLASSES, avatarOf } from "@/lib/avatar";
import { resizePhoto } from "@/lib/image";
import { actions, useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";

const MAX_PHOTOS = 15;

const label = (list: readonly { id: string; label: string }[], id: string | null | undefined) =>
  list.find((x) => x.id === id)?.label ?? "No se pudo ver";

/**
 * Convierte una foto guardada (link) en una más chica para mandarla a la IA.
 * Con muchas fotos se achican más, así entran todas en un solo envío.
 */
async function toDataUrl(src: string, count: number): Promise<string> {
  try {
    const blob = await (await fetch(src)).blob();
    const file = new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" });
    return (await resizePhoto(file, count > 8 ? 560 : count > 5 ? 680 : 800)).dataUrl;
  } catch {
    throw new Error("No pude leer una de tus fotos guardadas. Sacala y subila de nuevo.");
  }
}

export default function ProfileAnalysis() {
  const { account, profile } = useArmario();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!cloudEnabled) return null;

  if (!account) {
    return (
      <section className="card mb-6 border-accent p-4">
        <p className="mb-1 font-semibold">✨ Subí fotos tuyas y la IA arma tu perfil</p>
        <p className="mb-3 text-sm text-muted">
          Te dice tu subtono, tu tono de piel, tu silueta y arma tu avatar 3D. Para usar la IA primero entrá con tu mail
          (es gratis y sin contraseña).
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

  const photos = profile.selfies ?? [];
  const analyzed = Boolean(profile.undertone || profile.aiAdvice);

  async function addPhotos(list: FileList | null) {
    // Copia: el navegador vacía la lista cuando se resetea el campo.
    const files = list ? [...list] : [];
    if (!files.length) return;
    setMsg(null);
    setResult(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    setSaving(true);
    try {
      // Fotos más chicas para que entren varias en un solo envío.
      const added = await Promise.all(files.slice(0, room).map((f) => resizePhoto(f, 800).then((r) => r.dataUrl)));
      await actions.saveProfile({ ...profile, selfies: [...photos, ...added].slice(0, MAX_PHOTOS) });
      if (files.length > room) setMsg(`Hasta ${MAX_PHOTOS} fotos: guardé las primeras.`);
    } catch {
      setMsg("No pude guardar alguna de las fotos. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto(i: number) {
    setResult(null);
    await actions.saveProfile({ ...profile, selfies: photos.filter((_, j) => j !== i) });
  }

  async function analyze() {
    setBusy(true);
    setMsg(null);
    try {
      const images = await Promise.all(photos.map((p) => toDataUrl(p, photos.length)));
      setResult(await analyzeProfile(images, profile.gender));
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
    const current = avatarOf(profile);
    await actions.saveProfile({
      ...profile,
      undertone: r.undertone ?? profile.undertone,
      skinDepth: r.skinDepth ?? profile.skinDepth,
      bodyType: r.bodyType ?? profile.bodyType,
      aiAdvice: r.advice || profile.aiAdvice,
      // El avatar 3D toma tus rasgos de las fotos.
      avatar: {
        ...current,
        hair: r.avatar.hair ?? current.hair,
        hairColor: (r.avatar.hairColor && HAIR_COLOR_BY_ID[r.avatar.hairColor]) || current.hairColor,
        beard: profile.gender === "mujer" ? false : (r.avatar.beard ?? current.beard),
        glasses: r.avatar.glasses ?? current.glasses,
      },
    });
    setResult(null);
    setMsg("¡Listo! Guardé los datos en tu perfil y armé tu avatar en el Probador.");
  }

  const fileInput = (
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
  );

  return (
    <section className="card mb-6 border-accent p-4">
      <p className="mb-1 font-semibold">✨ Tus fotos y lo que ve la IA</p>
      <p className="mb-3 text-sm text-muted">
        Subí hasta {MAX_PHOTOS} fotos tuyas (de frente, de costado, la cara con luz natural; mientras más, mejor). La IA
        te dice tu subtono, tu tono de piel y tu silueta, y arma tu avatar 3D con tu peinado, color de pelo
        {profile.gender === "mujer" ? "" : ", barba"} y anteojos.
      </p>

      {!result && (
        <>
          {photos.length === 0 ? (
            <>
              {analyzed && (
                <p className="mb-2 rounded-xl bg-surface-2 p-3 text-sm">
                  Las fotos que usaste antes no se guardaban. Subilas de nuevo y van a quedar acá, con la opción de
                  sumar más.
                </p>
              )}
              <label className={`btn-primary w-full cursor-pointer ${saving ? "pointer-events-none opacity-60" : ""}`}>
                {saving ? "Guardando…" : "📷 Elegir fotos"}
                {fileInput}
              </label>
            </>
          ) : (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-2 text-sm font-semibold">
                Tus fotos ({photos.length}/{MAX_PHOTOS})
                {saving ? (
                  <span className="font-normal text-muted"> · Guardando… no cierres la app</span>
                ) : (
                  !busy && <span className="font-normal text-muted"> · ✕ para sacar · ＋ para sumar</span>
                )}
              </p>
              <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {photos.map((src, i) => (
                  <div key={src.slice(-40) + i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Tu foto ${i + 1}`} className="aspect-[3/4] w-full rounded-lg object-cover" />
                    {!busy && (
                      <button
                        type="button"
                        aria-label={`Sacar foto ${i + 1}`}
                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-black/70 text-xs text-white"
                        onClick={() => removePhoto(i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!busy && photos.length < MAX_PHOTOS && (
                  <label
                    className={`flex aspect-[3/4] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line text-xl text-muted ${saving ? "pointer-events-none opacity-60" : ""}`}
                    aria-label="Sumar más fotos"
                  >
                    {saving ? "…" : "＋"}
                    {fileInput}
                  </label>
                )}
              </div>
              <button
                type="button"
                className="btn-primary w-full text-base"
                disabled={busy || saving}
                onClick={analyze}
              >
                {busy
                  ? "✨ Analizando… (puede tardar unos segundos)"
                  : analyzed
                    ? "✨ Analizar de nuevo con todas"
                    : "✓ Listo, analizar"}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">
            Tus fotos quedan guardadas en tu cuenta, privadas, para que puedas sumar más. Se mandan a la IA de Google
            solo cuando tocás analizar (en el plan gratis, Google puede usarlas para mejorar sus productos).
          </p>
        </>
      )}

      {result && (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Esto ve la IA en tus fotos:</p>
          <p>
            <strong>Subtono:</strong> {label(UNDERTONES, result.undertone)} · <strong>Piel:</strong>{" "}
            {label(SKIN_DEPTHS, result.skinDepth)} · <strong>Silueta:</strong> {label(BODY_TYPES, result.bodyType)}
          </p>
          <p>
            <strong>Para tu avatar:</strong> pelo {label(HAIRS, result.avatar.hair).toLowerCase()}
            {result.avatar.hairColor ? ` ${result.avatar.hairColor.replace("-", " ")}` : ""}
            {result.avatar.beard && profile.gender !== "mujer" ? ", con barba" : ""}
            {result.avatar.glasses && result.avatar.glasses !== "ninguno"
              ? `, anteojos ${label(GLASSES, result.avatar.glasses).toLowerCase()}`
              : ""}
          </p>
          {result.undertone && <Palette undertone={result.undertone} />}
          {result.advice && <p className="rounded-xl bg-accent-soft p-3">💡 {result.advice}</p>}
          <div className="flex gap-2 pt-1">
            <button className="btn-primary flex-1" onClick={() => apply(result)}>
              Usar estos datos
            </button>
            <button className="btn-ghost flex-1" onClick={() => setResult(null)}>
              Descartar
            </button>
          </div>
          <p className="text-xs text-muted">
            &quot;Usar estos datos&quot; reemplaza tu perfil actual y arma tu avatar. &quot;Descartar&quot; deja todo
            como estaba.
          </p>
        </div>
      )}

      {msg && <p className="mt-2 text-sm">{msg}</p>}

      {!result && analyzed && (
        <div className="mt-4 space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold">Tu perfil ahora</p>
          {(profile.undertone || profile.skinDepth || profile.bodyType) && (
            <p className="text-muted">
              Subtono {label(UNDERTONES, profile.undertone).toLowerCase()} · piel{" "}
              {label(SKIN_DEPTHS, profile.skinDepth).toLowerCase()} · silueta{" "}
              {label(BODY_TYPES, profile.bodyType).toLowerCase()}
            </p>
          )}
          {profile.undertone && <Palette undertone={profile.undertone} />}
          {profile.aiAdvice && <p>💡 {profile.aiAdvice}</p>}
        </div>
      )}
    </section>
  );
}

/** Colores que más favorecen cerca de la cara según el subtono. */
function Palette({ undertone }: { undertone: Undertone }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">🎨 Tus colores</p>
      <div className="flex flex-wrap gap-1.5">
        {PALETTE_BY_UNDERTONE[undertone].map((id) => (
          <span key={id} className="chip px-2.5 py-1 text-xs">
            <Swatch colorId={id} size={14} /> {colorById(id).label}
          </span>
        ))}
      </div>
    </div>
  );
}
