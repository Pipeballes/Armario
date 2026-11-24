"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, OCCASIONS, WEATHERS, type OccasionId, type Weather } from "@/lib/catalog";
import { suggestOutfits, type Outfit } from "@/lib/outfits";
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
  const { ready, garments, profile, error } = useArmario();
  const router = useRouter();
  const [occasion, setOccasion] = useState<OccasionId>("casual");
  // Clima: el que elegiste a mano, o si no el del pronóstico.
  const [manualWeather, setManualWeather] = useState<Weather | null>(null);
  const [auto, setAuto] = useState<WeatherReading | null>(null);
  const weather: Weather = manualWeather ?? auto?.weather ?? "templado";
  const [seed, setSeed] = useState(0);
  const [worn, setWorn] = useState<Outfit | null>(null);
  const [event, setEvent] = useState<AgendaEvent | null>(null);

  const result = useMemo(
    () =>
      suggestOutfits(garments, {
        occasion,
        weather,
        profile,
        random: seed ? seeded(seed) : undefined,
      }),
    [garments, occasion, weather, profile, seed],
  );

  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const reset = () => {
    setSeed(0);
    setWorn(null);
  };

  return (
    <div>
      <h1 className="page-title mb-6">¿Qué me pongo?</h1>

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

          <ol className="space-y-4">
            {result.outfits.map((o, idx) => {
              const key = o.items.map((i) => i.id).join("+");
              return (
                <li key={key} className="card p-4">
                  <h2 className="mb-3 font-display text-lg font-semibold">Opción {idx + 1}</h2>
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

          <button className="btn-primary mt-4 w-full" onClick={() => setSeed((s) => s + 1)}>
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
