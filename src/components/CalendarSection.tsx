"use client";

import { useState } from "react";
import { formatWhen, normalizeCalendarUrl, type AgendaEvent } from "@/lib/agenda";
import { fetchCalendar } from "@/lib/agenda-client";
import { actions, newId, useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";
import { calendarsOf, type CalendarLink } from "@/lib/types";

type Source = "iphone" | "google";

/** Colores parecidos a los del calendario del iPhone, para elegir si el link no trae uno. */
const COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#af52de", "#a2845e", "#8e8e93"];

export default function CalendarSection() {
  const { account, profile } = useArmario();
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<Source>("iphone");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; events: AgendaEvent[] } | null>(null);

  if (!cloudEnabled) return null;

  if (!account) {
    return (
      <section className="card mb-6 p-4">
        <p className="mb-1 font-semibold">📅 Tus calendarios</p>
        <p className="text-sm text-muted">
          Conectá los calendarios del iPhone o de Google y te armo el outfit para cada evento. Primero entrá con tu mail
          (arriba).
        </p>
      </section>
    );
  }

  const calendars = calendarsOf(profile);

  async function saveCalendars(list: CalendarLink[]) {
    await actions.saveProfile({ ...profile, calendarUrl: undefined, calendars: list });
  }

  async function connect() {
    setMsg(null);
    setPreview(null);
    const url = link.trim();
    if (!normalizeCalendarUrl(url)) {
      setMsg("Ese link no parece de un calendario. Tiene que empezar con webcal:// o https:// (de iCloud o Google).");
      return;
    }
    if (calendars.some((c) => c.url === url)) {
      setMsg("Ese calendario ya está conectado.");
      return;
    }
    setBusy(true);
    try {
      const { events, calendar } = await fetchCalendar(url, true);
      const used = new Set(calendars.map((c) => c.color));
      const cal: CalendarLink = {
        id: newId(),
        name: calendar.name || `Calendario ${calendars.length + 1}`,
        color: calendar.color || COLORS.find((c) => !used.has(c)) || COLORS[0],
        url,
      };
      await saveCalendars([...calendars, cal]);
      setPreview({ name: cal.name, events });
      setLink("");
      setAdding(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No pude leer ese calendario.");
    } finally {
      setBusy(false);
    }
  }

  const update = (id: string, patch: Partial<CalendarLink>) =>
    saveCalendars(calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <section className="card mb-6 p-4">
      <p className="mb-1 font-semibold">📅 Tus calendarios</p>
      <p className="mb-3 text-sm text-muted">
        Conectá todos los que uses. En &quot;¿Qué me pongo?&quot; vas a ver los eventos de cada uno con su color.
      </p>

      {calendars.length > 0 && (
        <ul className="mb-3 space-y-2">
          {calendars.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-2">
              <label className="relative h-7 w-7 shrink-0 cursor-pointer" title="Cambiar color">
                <span className="block h-7 w-7 rounded-full border border-black/10" style={{ background: c.color }} />
                <input
                  type="color"
                  value={c.color}
                  onChange={(e) => update(c.id, { color: e.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`Color de ${c.name}`}
                />
              </label>
              <input
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm font-medium outline-none focus:underline"
                defaultValue={c.name}
                aria-label="Nombre del calendario"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== c.name) update(c.id, { name });
                }}
              />
              <button
                type="button"
                className="shrink-0 px-2 text-sm text-danger"
                onClick={async () => {
                  if (confirm(`¿Desconectar "${c.name}"?`)) await saveCalendars(calendars.filter((x) => x.id !== c.id));
                }}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="mb-3 rounded-xl bg-accent-soft p-3 text-sm">
          <p className="mb-1">
            ✓ Conecté <strong>{preview.name}</strong>.{" "}
            {preview.events.length === 0 ? "No tiene eventos en los próximos 8 días." : "Próximos eventos:"}
          </p>
          <ul className="space-y-0.5">
            {preview.events.slice(0, 3).map((e) => (
              <li key={e.id}>
                <strong>{formatWhen(e)}</strong> — {e.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!adding && (
        <button type="button" className={calendars.length ? "btn-ghost w-full" : "btn-primary w-full"} onClick={() => setAdding(true)}>
          {calendars.length ? "＋ Agregar otro calendario" : "Conectar un calendario"}
        </button>
      )}

      {adding && (
        <div className="rounded-xl border border-line p-3">
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={source === "iphone"} onClick={() => setSource("iphone")}>
              📱 Calendario del iPhone
            </button>
            <button type="button" className="chip" aria-pressed={source === "google"} onClick={() => setSource("google")}>
              Google Calendar
            </button>
          </div>

          {source === "iphone" ? (
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
              <li>
                Abrí la app <strong>Calendario</strong> del iPhone y tocá <strong>Calendarios</strong> (abajo).
              </li>
              <li>
                Tocá la <strong>ⓘ</strong> al lado de uno de tus calendarios.
              </li>
              <li>
                Activá <strong>Calendario público</strong> → <strong>Compartir enlace…</strong> → <strong>Copiar</strong>.
              </li>
              <li>Pegalo acá abajo. Repetí con cada calendario que quieras sumar.</li>
            </ol>
          ) : (
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
              <li>
                En la compu, abrí <strong>calendar.google.com</strong> → ⚙️ <strong>Configuración</strong>.
              </li>
              <li>A la izquierda, elegí el calendario.</li>
              <li>
                Bajá hasta <strong>Dirección secreta en formato iCal</strong> y copiala.
              </li>
              <li>Pegala acá abajo.</li>
            </ol>
          )}

          <p className="mb-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">
            🔒 Armario solo <strong>lee</strong> tus eventos, nunca los cambia. Quien tenga el link puede ver ese
            calendario, así que no lo compartas con nadie más.
          </p>

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              connect();
            }}
          >
            <input
              className="input"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={source === "iphone" ? "webcal://p…-caldav.icloud.com/published/…" : "https://calendar.google.com/…"}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy}>
                {busy ? "Leyendo…" : "Conectar"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setAdding(false);
                  setMsg(null);
                }}
              >
                Cancelar
              </button>
            </div>
            {msg && <p className="text-sm text-danger">{msg}</p>}
          </form>
        </div>
      )}
    </section>
  );
}
