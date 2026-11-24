"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OCCASIONS } from "@/lib/catalog";
import { formatWhen, type AgendaEvent } from "@/lib/agenda";
import { fetchAgenda } from "@/lib/agenda-client";
import { useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";
import { calendarsOf } from "@/lib/types";

/** Próximos eventos de todos los calendarios, con el color de cada uno, para elegir el del outfit. */
export default function AgendaStrip({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (e: AgendaEvent) => void;
}) {
  const { account, profile } = useArmario();
  const calendars = useMemo(() => (account ? calendarsOf(profile) : []), [account, profile]);
  const key = calendars.map((c) => `${c.id}|${c.url}|${c.color}|${c.name}`).join(",");
  const [state, setState] = useState<{ key: string; events: AgendaEvent[]; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (calendars.length === 0) return;
    let alive = true;
    fetchAgenda(calendars)
      .then(({ events, failed }) => {
        if (!alive) return;
        const now = Date.now();
        // Solo lo que todavía no terminó.
        setState({
          key,
          events: events.filter((e) => e.allDay || new Date(e.end ?? e.start).getTime() >= now),
          failed,
        });
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "No pude leer tus calendarios."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!cloudEnabled) return null;

  if (calendars.length === 0) {
    return (
      <Link href="/perfil" className="card mb-6 flex items-center gap-3 p-3 text-sm">
        <span className="text-2xl" aria-hidden>
          📅
        </span>
        <span>
          <strong>Conectá tus calendarios</strong> y te armo el outfit para cada evento.
        </span>
      </Link>
    );
  }

  const events = state?.key === key ? state.events : null;

  return (
    <section className="mb-6">
      <span className="label">Tu agenda</span>
      {error && <p className="card p-3 text-sm text-danger">{error}</p>}
      {state && state.failed.length > 0 && (
        <p className="mb-2 text-xs text-danger">
          No pude leer: {state.failed.join(", ")}. Revisá el link en Perfil.
        </p>
      )}
      {!error && events === null && <p className="text-sm text-muted">Leyendo tus calendarios…</p>}
      {events && events.length === 0 && (
        <p className="text-sm text-muted">No tenés eventos en los próximos días. Elegí la ocasión abajo.</p>
      )}
      {events && events.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {events.slice(0, 20).map((e) => {
            const occ = OCCASIONS.find((o) => o.id === e.occasion)!;
            const color = e.calendarColor ?? "var(--accent)";
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selectedId === e.id}
                onClick={() => onSelect(e)}
                className={`card w-40 shrink-0 border-l-4 p-3 text-left ${selectedId === e.id ? "bg-accent-soft" : ""}`}
                style={{ borderLeftColor: color, ...(selectedId === e.id ? { borderColor: color } : {}) }}
              >
                <span className="block text-xs text-muted">{formatWhen(e)}</span>
                <span className="line-clamp-2 block text-sm font-semibold">{e.title}</span>
                <span className="mt-1 block text-xs">
                  {occ.emoji} {occ.label}
                </span>
                {e.calendarName && calendars.length > 1 && (
                  <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    {e.calendarName}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
