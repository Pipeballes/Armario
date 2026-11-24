"use client";

import { useState } from "react";
import { formatWhen, normalizeCalendarUrl, type AgendaEvent } from "@/lib/agenda";
import { fetchAgenda } from "@/lib/agenda-client";
import { actions, useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";

type Source = "iphone" | "google";

export default function CalendarSection() {
  const { account, profile } = useArmario();
  const [source, setSource] = useState<Source>("iphone");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<AgendaEvent[] | null>(null);

  if (!cloudEnabled) return null;

  if (!account) {
    return (
      <section className="card mb-6 p-4">
        <p className="mb-1 font-semibold">📅 Tu calendario</p>
        <p className="text-sm text-muted">
          Conectá el calendario del iPhone o de Google y te armo el outfit para cada evento. Primero entrá con tu mail
          (arriba).
        </p>
      </section>
    );
  }

  async function connect() {
    setMsg(null);
    setPreview(null);
    if (!normalizeCalendarUrl(link)) {
      setMsg("Ese link no parece de un calendario. Tiene que empezar con webcal:// o https:// (de iCloud o Google).");
      return;
    }
    setBusy(true);
    try {
      const events = await fetchAgenda(link.trim(), true);
      await actions.saveProfile({ ...profile, calendarUrl: link.trim() });
      setPreview(events);
      setLink("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No pude leer ese calendario.");
    } finally {
      setBusy(false);
    }
  }

  if (profile.calendarUrl) {
    return (
      <section className="card mb-6 p-4">
        <p className="mb-1 font-semibold">📅 Calendario conectado ✓</p>
        <p className="mb-3 text-sm text-muted">
          En &quot;¿Qué me pongo?&quot; vas a ver tus próximos eventos para armar el outfit de cada uno.
        </p>
        {preview && (
          <div className="mb-3 rounded-xl bg-accent-soft p-3 text-sm">
            {preview.length === 0 ? (
              <p>Lo leí bien, pero no tenés eventos en los próximos 8 días.</p>
            ) : (
              <>
                <p className="mb-1">¡Lo leí! Tus próximos eventos:</p>
                <ul className="space-y-0.5">
                  {preview.slice(0, 4).map((e) => (
                    <li key={e.id}>
                      <strong>{formatWhen(e)}</strong> — {e.title}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <button
          className="btn-ghost w-full"
          onClick={async () => {
            if (confirm("¿Desconectar el calendario de Armario?")) {
              await actions.saveProfile({ ...profile, calendarUrl: undefined });
              setPreview(null);
            }
          }}
        >
          Desconectar
        </button>
        <p className="mt-2 text-xs text-muted">
          Para cortar el acceso del todo, desactivá también el link en el {source === "google" ? "calendario" : "iPhone"}.
        </p>
      </section>
    );
  }

  return (
    <section className="card mb-6 p-4">
      <p className="mb-1 font-semibold">📅 Conectá tu calendario</p>
      <p className="mb-3 text-sm text-muted">Te armo el outfit para cada evento de tu agenda.</p>

      <div className="mb-3 flex gap-2">
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
            Tocá la <strong>ⓘ</strong> al lado del calendario donde tenés tus cosas.
          </li>
          <li>
            Activá <strong>Calendario público</strong> y tocá <strong>Compartir enlace…</strong> → <strong>Copiar</strong>.
          </li>
          <li>Pegalo acá abajo.</li>
        </ol>
      ) : (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
          <li>
            En la compu, abrí <strong>calendar.google.com</strong> → ⚙️ <strong>Configuración</strong>.
          </li>
          <li>A la izquierda, elegí tu calendario.</li>
          <li>
            Bajá hasta <strong>Dirección secreta en formato iCal</strong> y copiala.
          </li>
          <li>Pegala acá abajo.</li>
        </ol>
      )}

      <p className="mb-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">
        🔒 Armario solo <strong>lee</strong> tus eventos, nunca los cambia. Ojo: quien tenga ese link puede ver el
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
        <button className="btn-primary" disabled={busy}>
          {busy ? "Leyendo tu calendario…" : "Conectar"}
        </button>
        {msg && <p className="text-sm text-danger">{msg}</p>}
      </form>
    </section>
  );
}
