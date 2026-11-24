"use client";

import { useEffect, useState } from "react";
import { WEATHERS } from "@/lib/catalog";
import type { AgendaEvent } from "@/lib/agenda";
import {
  fetchForecast,
  locate,
  readingFor,
  savePlace,
  savedPlace,
  searchCity,
  type Forecast,
  type Place,
  type WeatherReading,
} from "@/lib/weather";

/**
 * Busca el pronóstico para tu ubicación (o tu ciudad) y avisa qué clima corresponde:
 * para ahora o, si elegiste un evento, para ese día y esa hora.
 */
export default function WeatherAuto({
  event,
  manual,
  onReading,
}: {
  event: AgendaEvent | null;
  /** true si elegiste el clima a mano (entonces solo se muestra el pronóstico). */
  manual: boolean;
  onReading: (r: WeatherReading | null) => void;
}) {
  const [place, setPlace] = useState<Place | null>(() => savedPlace());
  const [forecast, setForecast] = useState<{ key: string; f: Forecast } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Place[] | null>(null);

  const placeKey = place ? `${place.lat},${place.lon}` : "";

  useEffect(() => {
    if (!place) return;
    let alive = true;
    fetchForecast(place)
      .then((f) => {
        if (!alive) return;
        setForecast({ key: placeKey, f });
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "No pude traer el pronóstico."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey]);

  const f = forecast?.key === placeKey ? forecast.f : null;
  const when = event ? new Date(event.start) : new Date();
  const reading = f
    ? readingFor(f, when, { allDay: event?.allDay, end: event?.end ? new Date(event.end) : null })
    : null;
  const readingKey = reading ? `${reading.weather}|${reading.feels}|${reading.rain}` : "none";

  // Avisar al padre cuando cambia lo que hay que usar.
  useEffect(() => {
    onReading(reading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingKey]);

  function choose(p: Place) {
    savePlace(p);
    setPlace(p);
    setChanging(false);
    setOptions(null);
    setQuery("");
  }

  async function useMyLocation() {
    setBusy(true);
    setError(null);
    try {
      choose(await locate());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude saber dónde estás.");
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const found = await searchCity(query.trim());
      setOptions(found);
      if (found.length === 0) setError("No encontré esa ciudad. Probá escribiéndola distinto.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude buscar la ciudad.");
    } finally {
      setBusy(false);
    }
  }

  const picker = (
    <div className="mt-2 space-y-2">
      <button type="button" className="btn-ghost w-full" disabled={busy} onClick={useMyLocation}>
        📍 Usar mi ubicación
      </button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          className="input min-w-0 flex-1 py-2 text-sm"
          placeholder="o escribí tu ciudad"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ciudad"
        />
        <button className="btn-ghost shrink-0 px-4" disabled={busy}>
          Buscar
        </button>
      </form>
      {options && options.length > 0 && (
        <ul className="space-y-1">
          {options.map((o) => (
            <li key={`${o.lat},${o.lon}`}>
              <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => choose(o)}>
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!place || changing) {
    return (
      <div className="mt-3 rounded-xl border border-line p-3 text-sm">
        <p>
          <strong>🌤️ Clima automático:</strong> decime dónde estás y elijo frío, templado o calor según el pronóstico.
        </p>
        {picker}
        {changing && (
          <button type="button" className="mt-2 text-xs text-muted underline" onClick={() => setChanging(false)}>
            Cancelar
          </button>
        )}
        {error && <p className="mt-2 text-danger">{error}</p>}
      </div>
    );
  }

  const label = reading ? WEATHERS.find((w) => w.id === reading.weather) : null;
  return (
    <div className="mt-3 text-sm">
      {error && <p className="text-danger">{error}</p>}
      {!error && !f && <p className="text-muted">Buscando el pronóstico…</p>}
      {f && !reading && (
        <p className="text-muted">Todavía no hay pronóstico para esa fecha (llega hasta 16 días). Elegí el clima a mano.</p>
      )}
      {reading && label && (
        <p>
          {label.emoji} <strong>{reading.feels}°</strong> de sensación {event ? "para ese momento" : "ahora"} en{" "}
          {place.name} → <strong>{label.label}</strong>
          {manual ? <span className="text-muted"> (elegiste otro a mano)</span> : <span className="text-muted"> · automático</span>}
        </p>
      )}
      {reading && reading.rain >= 50 && (
        <p className="mt-1 rounded-lg bg-accent-soft p-2">
          ☔ {reading.rain}% de probabilidad de lluvia: mejor calzado cerrado y algo que aguante el agua.
        </p>
      )}
      <button type="button" className="mt-1 text-xs text-muted underline" onClick={() => setChanging(true)}>
        Cambiar ubicación
      </button>
    </div>
  );
}
