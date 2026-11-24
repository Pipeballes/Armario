// Clima automático con Open-Meteo (gratis, sin clave). Se consulta desde el celular del usuario.

import type { Weather } from "./catalog";

export interface Place {
  lat: number;
  lon: number;
  name: string;
}

export interface Forecast {
  /** Horas en milisegundos (UTC) con su sensación térmica y probabilidad de lluvia. */
  hours: { t: number; feels: number; rain: number }[];
  now: number | null;
}

export interface WeatherReading {
  weather: Weather;
  feels: number;
  rain: number;
}

/** Frío hasta 14°, templado de 15° a 23°, calor desde 24° (sensación térmica). */
export function classify(feels: number): Weather {
  if (feels <= 14) return "frio";
  if (feels >= 24) return "calor";
  return "templado";
}

/**
 * Qué clima tomar para un momento: si es un evento con hora, las horas que dura (o 3 horas desde
 * que empieza); si es un día completo, de 9 a 21 hs. Usa el promedio de sensación térmica y el
 * máximo de probabilidad de lluvia.
 */
export function readingFor(f: Forecast, start: Date, opts: { allDay?: boolean; end?: Date | null } = {}): WeatherReading | null {
  let from: number;
  let to: number;
  if (opts.allDay) {
    const d = new Date(start);
    d.setHours(9, 0, 0, 0);
    from = d.getTime();
    d.setHours(21, 0, 0, 0);
    to = d.getTime();
  } else {
    from = start.getTime() - 30 * 60_000;
    to = opts.end ? opts.end.getTime() : start.getTime() + 3 * 3_600_000;
  }
  const slice = f.hours.filter((h) => h.t >= from && h.t <= to);
  if (slice.length === 0) return null;
  const feels = slice.reduce((n, h) => n + h.feels, 0) / slice.length;
  const rain = Math.max(...slice.map((h) => h.rain));
  return { weather: classify(feels), feels: Math.round(feels), rain: Math.round(rain) };
}

const PLACE_KEY = "armario-ubicacion";

export function savedPlace(): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export function savePlace(p: Place | null) {
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLACE_KEY);
  } catch {
    /* sin almacenamiento: se vuelve a pedir la próxima vez */
  }
}

/** Pide la ubicación al celular (el navegador muestra el permiso). */
export function locate(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Este navegador no da la ubicación."));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          // Redondeado (~1 km): alcanza para el clima y no guarda la ubicación exacta.
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
          name: "Tu ubicación",
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "No diste permiso de ubicación. Escribí tu ciudad."
              : "No pude saber dónde estás. Escribí tu ciudad.",
          ),
        ),
      { timeout: 10_000, maximumAge: 30 * 60_000 },
    );
  });
}

export async function searchCity(name: string): Promise<Place[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=5&language=es&name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No pude buscar la ciudad.");
  const data = await res.json();
  return ((data.results ?? []) as { latitude: number; longitude: number; name: string; admin1?: string; country?: string }[]).map(
    (r) => ({
      lat: r.latitude,
      lon: r.longitude,
      name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    }),
  );
}

const cache = new Map<string, { at: number; f: Forecast }>();

export async function fetchForecast(p: Place): Promise<Forecast> {
  const key = `${p.lat},${p.lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.f;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    "&hourly=apparent_temperature,precipitation_probability&current=apparent_temperature" +
    "&timeformat=unixtime&forecast_days=16";
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.hourly) throw new Error("No pude traer el pronóstico. Elegí el clima a mano.");
  const h = data.hourly as { time: number[]; apparent_temperature: number[]; precipitation_probability: (number | null)[] };
  const f: Forecast = {
    hours: h.time.map((t, i) => ({ t: t * 1000, feels: h.apparent_temperature[i], rain: h.precipitation_probability[i] ?? 0 })),
    now: typeof data.current?.apparent_temperature === "number" ? data.current.apparent_temperature : null,
  };
  cache.set(key, { at: Date.now(), f });
  return f;
}
