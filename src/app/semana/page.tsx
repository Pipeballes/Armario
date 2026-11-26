"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OCCASIONS, WEATHERS, categoryView } from "@/lib/catalog";
import type { AgendaEvent } from "@/lib/agenda";
import { fetchAgenda } from "@/lib/agenda-client";
import { PROBAR_KEY, selectionFrom } from "@/lib/avatar";
import { dateKey, planWeek, prepList } from "@/lib/planner";
import { outfitKey } from "@/lib/outfits";
import { actions, useArmario } from "@/lib/store";
import { calendarsOf } from "@/lib/types";
import { fetchForecast, readingFor, savedPlace, type Forecast } from "@/lib/weather";
import GarmentPhoto from "@/components/GarmentPhoto";
import { ErrorBox, Loading } from "@/components/ui";

const dayName = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86_400_000));
  if (key === today) return "Hoy";
  if (key === tomorrow) return "Mañana";
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric" }).replace(/^\w/, (c) => c.toUpperCase());
};

export default function SemanaPage() {
  const router = useRouter();
  const { ready, garments, profile, account, error } = useArmario();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [skips, setSkips] = useState<Record<string, string[]>>({});
  const [showPrep, setShowPrep] = useState(false);
  const calendars = useMemo(() => (account ? calendarsOf(profile) : []), [account, profile]);
  const calKey = calendars.map((c) => c.url + c.defaultOccasion).join(",");

  useEffect(() => {
    if (!calendars.length) return;
    let alive = true;
    fetchAgenda(calendars)
      .then((r) => alive && setEvents(r.events))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calKey]);

  useEffect(() => {
    const place = savedPlace();
    if (!place) return;
    let alive = true;
    fetchForecast(place)
      .then((f) => alive && setForecast(f))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pinned = useMemo(() => profile.weekPlan ?? {}, [profile.weekPlan]);
  const plan = useMemo(() => {
    // Solo en el navegador (la fecha de hoy no se puede leer al preparar la página en el servidor).
    if (!ready) return [];
    const start = new Date();
    return planWeek({
      garments,
      profile,
      events,
      start,
      pinned,
      skips,
      feedback: profile.feedback,
      weatherFor: forecast
        ? (day, ev) => {
            const at = ev ? new Date(ev.start) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
            return readingFor(forecast, at, { allDay: ev ? ev.allDay : true })?.weather ?? null;
          }
        : undefined,
    });
  }, [ready, garments, profile, events, pinned, skips, forecast]);

  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  async function togglePin(date: string, ids: string[] | null) {
    const next = { ...pinned };
    if (ids) next[date] = ids;
    else delete next[date];
    // Se olvidan los días que ya pasaron.
    const today = dateKey(new Date());
    for (const k of Object.keys(next)) if (k < today) delete next[k];
    await actions.saveProfile({ ...profile, weekPlan: next });
  }

  const prep = prepList(plan);
  const missing = plan.every((d) => !d.outfit);

  return (
    <div>
      <Link href="/outfits" className="mb-3 inline-block text-sm text-accent">
        ← ¿Qué me pongo?
      </Link>
      <h1 className="page-title mb-1">Tu semana</h1>
      <p className="mb-4 text-sm text-muted">
        Un outfit por día según tu agenda y el clima, sin repetir ropa. Fijá 📌 los que te gusten y cambiá el resto.
      </p>

      {!calendars.length && (
        <Link href="/perfil" className="card mb-3 block p-3 text-sm">
          📅 Conectá tus calendarios en Perfil para que la semana siga tus eventos.
        </Link>
      )}
      {!forecast && (
        <Link href="/outfits" className="card mb-3 block p-3 text-sm">
          🌤️ Elegí tu ubicación en &quot;¿Qué me pongo?&quot; para usar el pronóstico de cada día.
        </Link>
      )}

      {missing ? (
        <div className="card p-6 text-center">
          <p className="mb-3 text-sm text-muted">Cargá parte de arriba, de abajo y calzado para armar la semana.</p>
          <Link href="/armario/nueva" className="btn-primary">
            Cargar ropa
          </Link>
        </div>
      ) : (
        <>
          <button type="button" className="btn-primary mb-4 w-full" onClick={() => setShowPrep((v) => !v)}>
            🧺 {showPrep ? "Ocultar" : "Ver"} la ropa que tenés que tener lista ({prep.length})
          </button>

          {showPrep && (
            <section className="card mb-5 p-4">
              <h2 className="mb-1 font-semibold">Para tener lista esta semana</h2>
              <p className="mb-3 text-xs text-muted">Lavada, planchada y a mano para el día que la usás.</p>
              <ul className="space-y-2">
                {prep.map(({ garment, dates }) => (
                  <li key={garment.id} className="flex items-center gap-3">
                    <div className="w-12 shrink-0">
                      <GarmentPhoto garment={garment} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{garment.name}</p>
                      <p className="text-xs text-muted">{dates.map(dayName).join(" · ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ol className="space-y-3">
            {plan.map((d) => {
              const occ = OCCASIONS.find((o) => o.id === d.occasion)!;
              const w = WEATHERS.find((x) => x.id === d.weather)!;
              return (
                <li key={d.date} className={`card p-4 ${d.pinned ? "border-accent" : ""}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold">{dayName(d.date)}</h2>
                      <p className="text-xs text-muted">
                        {occ.emoji} {occ.label} · {w.emoji} {w.label}
                        {forecast ? "" : " (estimado)"}
                      </p>
                      {d.event && (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-sm">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: d.event.calendarColor ?? "var(--accent)" }}
                          />
                          <span className="truncate">
                            {d.event.title}
                            {d.others > 0 && <span className="text-muted"> y {d.others} más</span>}
                          </span>
                        </p>
                      )}
                    </div>
                    {d.outfit && (
                      <button
                        type="button"
                        className={`chip shrink-0 ${d.pinned ? "" : ""}`}
                        aria-pressed={d.pinned}
                        onClick={() => togglePin(d.date, d.pinned ? null : d.outfit!.items.map((i) => i.id))}
                      >
                        📌 {d.pinned ? "Fijado" : "Fijar"}
                      </button>
                    )}
                  </div>

                  {d.outfit ? (
                    <>
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        {d.outfit.items.map((i) => (
                          <figure key={i.id}>
                            <GarmentPhoto garment={i} />
                            <figcaption className="mt-1 truncate text-[11px] text-muted">
                              {categoryView(i.category, profile.gender).emoji} {i.name}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {!d.pinned && (
                          <button
                            type="button"
                            className="btn-ghost flex-1 px-2 text-xs"
                            onClick={() =>
                              setSkips((s) => ({ ...s, [d.date]: [...(s[d.date] ?? []), outfitKey(d.outfit!.items)] }))
                            }
                          >
                            🔄 Otra opción
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost flex-1 px-2 text-xs"
                          onClick={() => {
                            try {
                              sessionStorage.setItem(PROBAR_KEY, JSON.stringify(selectionFrom(d.outfit!.items)));
                            } catch {
                              /* sin almacenamiento */
                            }
                            router.push("/probador");
                          }}
                        >
                          🧍 Probar en 3D
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted">
                      {skips[d.date]?.length ? (
                        <button
                          type="button"
                          className="text-accent underline"
                          onClick={() => setSkips((s) => ({ ...s, [d.date]: [] }))}
                        >
                          Ya viste todas las opciones: volver a empezar
                        </button>
                      ) : (
                        "No alcanza la ropa para este día. Cargá más prendas."
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
