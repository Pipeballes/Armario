"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, OCCASIONS, WEATHERS, type OccasionId, type Weather } from "@/lib/catalog";
import { outfitKey, suggestOutfits, type Outfit } from "@/lib/outfits";
import { AiUnavailable, chooseOutfit } from "@/lib/ai";
import type { ChoiceResult } from "@/lib/ai-schema";
import { actions, useArmario } from "@/lib/store";
import GarmentPhoto from "@/components/GarmentPhoto";
import AgendaStrip from "@/components/AgendaStrip";
import WeatherAuto from "@/components/WeatherAuto";
import { PROBAR_KEY, selectionFrom } from "@/lib/avatar";
import { useRouter } from "next/navigation";
import type { WeatherReading } from "@/lib/weather";
import { formatWhen, type AgendaEvent } from "@/lib/agenda";
import { Chip, ErrorBox, Loading, Section } from "@/components/ui";

// Generador de números pseudoaleatorios con semilla, para que "Otras opciones" sea estable.
function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function OutfitsPage() {
  const { ready, garments, profile, account, error } = useArmario();
  const router = useRouter();
  const [occasion, setOccasion] = useState<OccasionId>("casual");
  // Clima: el que elegiste a mano, o si no el del pronóstico.
  const [manualWeather, setManualWeather] = useState<Weather | null>(null);
  const [auto, setAuto] = useState<WeatherReading | null>(null);
  const weather: Weather = manualWeather ?? auto?.weather ?? "templado";
  const [seed, setSeed] = useState(0);
  const [worn, setWorn] = useState<Outfit | null>(null);
  const [event, setEvent] = useState<AgendaEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ai, setAi] = useState<{ key: string; choice: ChoiceResult } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [picked, setPicked] = useState<Outfit[] | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const result = useMemo(
    () =>
      suggestOutfits(garments, {
        occasion,
        weather,
        profile,
        random: seed ? seeded(seed) : undefined,
        feedback: profile.feedback,
      }),
    [garments, occasion, weather, profile, seed],
  );

  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  // Si la IA eligió para estas mismas opciones, se muestran en su orden.
  const pickedKey = picked?.map((o) => outfitKey(o.items)).join("|") ?? "";
  const stillValid =
    picked !== null && ai?.key === pickedKey && picked.every((o) => o.items.every((g) => garments.some((x) => x.id === g.id)));
  const choice = stillValid ? ai!.choice : null;
  const shownOutfits = choice && picked ? picked : result.outfits;

  async function askAi() {
    setAiBusy(true);
    setAiMsg(null);
    try {
      const occ = OCCASIONS.find((o) => o.id === occasion)!.label;
      const w = WEATHERS.find((x) => x.id === weather)!.label;
      const extra = suggestOutfits(garments, {
        occasion,
        weather,
        profile,
        feedback: profile.feedback,
        count: 5,
        random: seed ? seeded(seed) : undefined,
      }).outfits;
      const pool = extra.length > result.outfits.length ? extra : result.outfits;
      const c = await chooseOutfit({
        occasion: occ,
        weather: w,
        event: event?.title,
        profile: { undertone: profile.undertone, bodyType: profile.bodyType, styles: profile.styles, gender: profile.gender },
        options: pool.map((o, i) => ({
          id: String(i),
          items: o.items.map((g) => ({ name: g.name, category: g.category, color: g.color, formality: g.formality, pattern: g.pattern })),
        })),
      });
      // Se muestran las 3 mejores según la IA.
      const top = c.order.slice(0, 3).map((i) => pool[Number(i)]);
      const key = top.map((o) => outfitKey(o.items)).join("|");
      setPicked(top);
      setAi({ key, choice: { ...c, order: top.map((_, i) => String(i)) } });
    } catch (e) {
      setAiMsg(
        e instanceof AiUnavailable
          ? "Para que la IA elija, entrá con tu mail en Perfil."
          : e instanceof Error
            ? e.message
            : "La IA no respondió.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  const fb = profile.feedback ?? { liked: [], disliked: [] };
  const liked = new Set(fb.liked);

  /** 👍 guarda el outfit para priorizarlo; 👎 lo saca y no lo vuelve a sugerir. */
  async function rate(o: Outfit, kind: "liked" | "disliked") {
    const key = outfitKey(o.items);
    const other = kind === "liked" ? "disliked" : "liked";
    const already = fb[kind].includes(key);
    const next = {
      ...fb,
      [kind]: already ? fb[kind].filter((k) => k !== key) : [...fb[kind], key].slice(-200),
      [other]: fb[other].filter((k) => k !== key),
    };
    setToast(
      kind === "liked"
        ? already
          ? "Saqué el 👍."
          : "👍 Anotado: voy a sugerirte más cosas así."
        : "👎 Entendido: no te lo vuelvo a sugerir.",
    );
    await actions.saveProfile({ ...profile, feedback: next });
  }

  const reset = () => {
    setAi(null);
    setPicked(null);
    setSeed(0);
    setWorn(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="page-title">¿Qué me pongo?</h1>
        <Link href="/semana" className="btn-ghost shrink-0 px-3 py-2 text-xs">
          📆 Mi semana
        </Link>
      </div>

      <AgendaStrip
        selectedId={event?.id ?? null}
        onSelect={(e) => {
          setEvent(e);
          setOccasion(e.occasion);
          setManualWeather(null);
          setSeed(0);
          setWorn(null);
        }}
      />

      <Section title="Ocasión">
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <Chip
              key={o.id}
              pressed={occasion === o.id}
              onClick={() => {
                setOccasion(o.id);
                setEvent(null);
                reset();
              }}
            >
              <span aria-hidden>{o.emoji}</span> {o.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Clima">
        <div className="flex flex-wrap gap-2">
          {WEATHERS.map((w) => (
            <Chip
              key={w.id}
              pressed={weather === w.id}
              onClick={() => {
                setManualWeather(w.id === auto?.weather ? null : w.id);
                reset();
              }}
            >
              <span aria-hidden>{w.emoji}</span> {w.label}
            </Chip>
          ))}
        </div>
        <WeatherAuto event={event} manual={manualWeather !== null} onReading={setAuto} />
      </Section>

      {event && (
        <p className="card mb-4 border-accent p-3 text-sm">
          📅 Outfit para <strong>{event.title}</strong> · {formatWhen(event)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      )}

      {worn ? (
        <div className="card p-4">
          <p className="mb-1 font-semibold text-ok">¡Anotado! Este es tu outfit de hoy 🙌</p>
          <p className="mb-3 text-sm text-muted">No te lo voy a repetir en los próximos días.</p>
          <div className={`mb-4 grid gap-2 ${worn.items.length >= 4 ? "grid-cols-4" : "grid-cols-3"}`}>
            {worn.items.map((i) => (
              <figure key={i.id}>
                <GarmentPhoto garment={i} />
                <figcaption className="mt-1 truncate text-xs text-muted">{i.name}</figcaption>
              </figure>
            ))}
          </div>
          <button className="btn-ghost w-full" onClick={() => setWorn(null)}>
            Ver otras opciones
          </button>
        </div>
      ) : result.outfits.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="mb-2 text-3xl">🧺</p>
          <p className="mb-1 font-semibold">Todavía no puedo armar un outfit</p>
          <p className="mb-5 text-sm text-muted">Me falta {result.missing.join(", ")}.</p>
          <Link href="/armario/nueva" className="btn-primary">
            Cargar ropa
          </Link>
        </div>
      ) : (
        <>
          {result.tip && (
            <p className="card mb-4 bg-accent-soft p-4 text-sm">
              <strong>Tip para tu cuerpo:</strong> {result.tip}
            </p>
          )}

          {account && !choice && (
            <button type="button" className="btn-ghost mb-3 w-full" disabled={aiBusy} onClick={askAi}>
              {aiBusy ? "✨ La IA está eligiendo…" : "✨ Que la IA elija el mejor"}
            </button>
          )}
          {aiMsg && <p className="mb-3 text-sm text-danger">{aiMsg}</p>}
          {choice && (
            <div className="card mb-3 border-accent bg-accent-soft p-4 text-sm">
              <p className="mb-1 font-semibold">✨ La IA eligió la Opción 1</p>
              {choice.why && <p className="mb-2">{choice.why}</p>}
              {choice.tip && <p className="text-muted">💡 {choice.tip}</p>}
            </div>
          )}
          {toast && <p className="mb-3 rounded-xl bg-accent-soft p-3 text-sm">{toast}</p>}
          <ol className="space-y-4">
            {shownOutfits.map((o, idx) => {
              const key = o.items.map((i) => i.id).join("+");
              return (
                <li key={key} className="card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold">Opción {idx + 1}</h2>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        aria-label="Me gusta"
                        aria-pressed={liked.has(outfitKey(o.items))}
                        onClick={() => rate(o, "liked")}
                        className={`h-9 w-9 rounded-full border text-base ${liked.has(outfitKey(o.items)) ? "border-ok bg-ok/15" : "border-line"}`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        aria-label="No me gusta"
                        onClick={() => rate(o, "disliked")}
                        className="h-9 w-9 rounded-full border border-line text-base"
                      >
                        👎
                      </button>
                    </div>
                  </div>
                  <div className={`mb-3 grid gap-2 ${o.items.length >= 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                    {o.items.map((i) => (
                      <figure key={i.id}>
                        <GarmentPhoto garment={i} />
                        <figcaption className="mt-1 truncate text-xs text-muted">
                          {CATEGORIES.find((c) => c.id === i.category)?.emoji} {i.name}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  {o.reasons.length > 0 && (
                    <ul className="mb-3 space-y-1 text-sm">
                      {o.reasons.map((r) => (
                        <li key={r} className="flex gap-2">
                          <span aria-hidden className="text-ok">
                            ✓
                          </span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="btn-ghost mb-2 w-full"
                    onClick={() => {
                      try {
                        sessionStorage.setItem(PROBAR_KEY, JSON.stringify(selectionFrom(o.items)));
                      } catch {
                        /* sin almacenamiento: el probador arranca vacío */
                      }
                      router.push("/probador");
                    }}
                  >
                    🧍 Probar en 3D
                  </button>
                  <button
                    className="btn-ghost w-full"
                    onClick={async () => {
                      await actions.markWorn(o.items.map((i) => i.id));
                      setWorn(o);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Me lo pongo hoy
                  </button>
                </li>
              );
            })}
          </ol>

          <button className="btn-primary mt-4 w-full" onClick={() => {
              setAi(null);
              setPicked(null);
              setSeed((s) => s + 1);
            }}>
            🔄 Mostrame otras opciones
          </button>
          {!profile.undertone && (
            <p className="mt-4 text-center text-sm text-muted">
              Completá tu <Link href="/perfil" className="text-accent underline">perfil</Link> para que los
              consejos tengan en cuenta tu tono de piel y tu cuerpo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
