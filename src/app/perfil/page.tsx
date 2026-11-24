"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  BODY_TYPES,
  PALETTE_BY_UNDERTONE,
  SKIN_DEPTHS,
  STYLES,
  UNDERTONES,
  colorById,
  type StyleId,
} from "@/lib/catalog";
import { parseBackup, type Backup } from "@/lib/db";
import { resizePhoto } from "@/lib/image";
import { actions, useArmario } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { Chip, ErrorBox, Loading, Section, Swatch } from "@/components/ui";
import AccountSection from "@/components/AccountSection";
import ProfileAnalysis from "@/components/ProfileAnalysis";
import CalendarSection from "@/components/CalendarSection";

const MAX_INSPIRATION = 12;

export default function PerfilPage() {
  const { ready, profile, garments, error, account } = useArmario();
  const [status, setStatus] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  // Cada cambio se guarda al instante.
  const save = (patch: Partial<Profile>) => actions.saveProfile({ ...profile, ...patch });

  const toggleStyle = (id: StyleId) =>
    save({
      styles: profile.styles.includes(id) ? profile.styles.filter((s) => s !== id) : [...profile.styles, id],
    });

  async function addInspiration(files: FileList | null) {
    if (!files) return;
    const room = MAX_INSPIRATION - profile.inspiration.length;
    const photos = await Promise.all(
      [...files].slice(0, room).map((f) => resizePhoto(f, 700).then((r) => r.dataUrl)),
    );
    await save({ inspiration: [...profile.inspiration, ...photos] });
  }

  async function exportBackup() {
    setStatus("Preparando la copia…");
    // Las fotos de la nube son links temporales: se guardan dentro de la copia.
    const toData = async (src: string) => {
      if (src.startsWith("data:")) return src;
      const blob = await (await fetch(src)).blob();
      return new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
    };
    let backup: Backup;
    try {
      backup = {
        app: "armario",
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: { ...profile, inspiration: await Promise.all(profile.inspiration.map(toData)) },
        garments: await Promise.all(garments.map(async (g) => ({ ...g, photo: await toData(g.photo) }))),
      };
    } catch {
      setStatus("No se pudo preparar la copia. Revisá tu conexión.");
      return;
    }
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `armario-copia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Copia descargada. Guardala en un lugar seguro (Drive, mail, etc.).");
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Esto reemplaza tu armario actual por la copia (${backup.garments.length} prendas). ¿Seguir?`)) return;
      await actions.replaceAll(backup.garments, backup.profile);
      setStatus("¡Copia restaurada!");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "No se pudo leer la copia.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  const palette = profile.undertone ? PALETTE_BY_UNDERTONE[profile.undertone] : [];

  return (
    <div>
      <h1 className="page-title mb-1">Tu perfil</h1>
      <p className="mb-6 text-sm text-muted">
        Con esto los outfits se adaptan a vos.{" "}
        {account ? "Se guarda en tu cuenta." : "Por ahora se guarda solo en este dispositivo."}
      </p>

      <section className="card mb-6 p-4">
        <p className="mb-1 font-semibold">¿Con qué género te identificás?</p>
        <p className="mb-3 text-sm text-muted">Así adapto tu avatar, las prendas que te sugiero y los consejos.</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["hombre", "Hombre"],
              ["mujer", "Mujer"],
              ["otro", "Otro / prefiero no decir"],
            ] as const
          ).map(([id, text]) => (
            <Chip key={id} pressed={profile.gender === id} onClick={() => save({ gender: id })}>
              {text}
            </Chip>
          ))}
        </div>
      </section>

      <ProfileAnalysis />
      <AccountSection />
      <CalendarSection />

      <Section title="Tu nombre">
        <input
          className="input"
          defaultValue={profile.name}
          onBlur={(e) => save({ name: e.target.value.trim() })}
          placeholder="¿Cómo te llamo?"
        />
      </Section>

      <Section
        title="Subtono de piel"
        hint={profile.aiAdvice ? "✨ Lo completó la IA con tus fotos. No hace falta marcarlo; si no te convence, tocá otra opción." : "Mirá las venas de tu muñeca con luz natural."}
      >
        <div className="space-y-2">
          {UNDERTONES.map((u) => (
            <button
              key={u.id}
              type="button"
              aria-pressed={profile.undertone === u.id}
              onClick={() => save({ undertone: u.id })}
              className={`card block w-full p-3 text-left ${
                profile.undertone === u.id ? "border-accent bg-accent-soft" : ""
              }`}
            >
              <span className="font-semibold">{u.label}</span>
              <span className="block text-sm text-muted">{u.hint}</span>
            </button>
          ))}
        </div>
        {palette.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-sm">Los colores que más te favorecen cerca de la cara:</p>
            <div className="flex flex-wrap gap-2">
              {palette.map((id) => (
                <span key={id} className="chip">
                  <Swatch colorId={id} /> {colorById(id).label}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Tono de piel" hint={profile.aiAdvice && profile.skinDepth ? "✨ Lo completó la IA." : undefined}>
        <div className="flex flex-wrap gap-2">
          {SKIN_DEPTHS.map((s) => (
            <Chip key={s.id} pressed={profile.skinDepth === s.id} onClick={() => save({ skinDepth: s.id })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        title="Tu silueta"
        hint={profile.aiAdvice && profile.bodyType ? "✨ Lo completó la IA. Si no te convence, elegí otra (no hay una mejor que otra)." : "Elegí la que más se parezca. No hay una mejor que otra."}
      >
        <div className="space-y-2">
          {BODY_TYPES.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={profile.bodyType === b.id}
              onClick={() => save({ bodyType: b.id })}
              className={`card block w-full p-3 text-left ${
                profile.bodyType === b.id ? "border-accent bg-accent-soft" : ""
              }`}
            >
              <span className="font-semibold">{b.label}</span>
              <span className="block text-sm text-muted">{b.hint}</span>
              {profile.bodyType === b.id && <span className="mt-1 block text-sm">💡 {b.tip}</span>}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Altura en cm (opcional)">
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={100}
          max={230}
          defaultValue={profile.height ?? ""}
          onBlur={(e) => save({ height: e.target.value ? Number(e.target.value) : null })}
          placeholder="Ej: 175"
        />
      </Section>

      <Section title="Estilos que te gustan" hint="Elegí uno o más. Los outfits van a ir para ese lado.">
        <div className="grid grid-cols-2 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={profile.styles.includes(s.id)}
              onClick={() => toggleStyle(s.id)}
              className={`card p-3 text-left ${profile.styles.includes(s.id) ? "border-accent bg-accent-soft" : ""}`}
            >
              <span className="font-semibold">{s.label}</span>
              <span className="block text-xs text-muted">{s.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Looks que te inspiran"
        hint="Subí capturas de outfits que te gustan. Más adelante la IA los va a usar para entender tu estilo."
      >
        <div className="grid grid-cols-3 gap-2">
          {profile.inspiration.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Inspiración ${i + 1}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
              <button
                type="button"
                aria-label="Quitar"
                className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-sm text-white"
                onClick={() => save({ inspiration: profile.inspiration.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          {profile.inspiration.length < MAX_INSPIRATION && (
            <label className="card flex aspect-[3/4] cursor-pointer items-center justify-center bg-surface-2 text-center text-sm text-muted">
              <span>
                <span className="block text-2xl">＋</span>Agregar
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => addInspiration(e.target.files)}
              />
            </label>
          )}
        </div>
      </Section>

      <Section
        title="Copia de seguridad"
        hint={account ? "Tu armario ya está en la nube, pero podés bajarte una copia igual." : "Tu armario vive en este navegador. Si borrás los datos o cambiás de celular, se pierde. Descargá una copia cada tanto."}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-ghost flex-1" onClick={exportBackup}>
            ⬇️ Descargar copia
          </button>
          <label className="btn-ghost flex-1 cursor-pointer">
            ⬆️ Restaurar copia
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => importBackup(e.target.files?.[0])}
            />
          </label>
        </div>
        {status && <p className="mt-2 text-sm">{status}</p>}
      </Section>
      <p className="mt-6 text-center text-sm">
        <Link href="/privacidad" className="text-muted underline">
          Política de privacidad
        </Link>
      </p>
    </div>
  );
}
