"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OCCASIONS } from "@/lib/catalog";
import { formatWhen, type AgendaEvent } from "@/lib/agenda";
import { fetchAgenda } from "@/lib/agenda-client";
import { useArmario } from "@/lib/store";
import { cloudEnabled } from "@/lib/supabase";

/** Próximos eventos del calendario para elegir para cuál armar el outfit. */
export default function AgendaStrip({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (e: AgendaEvent) => void;
}) {
  const { account, profile } = useArmario();
  const url = account ? profile.calendarUrl : undefined;
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetchAgenda(url)
      .then((evs) => {
        if (!alive) return;
        // Solo lo que todavía no terminó.
        const now = Date.now();
        setEvents(evs.filter((e) => new Date(e.end ?? e.start).getTime() >= now || e.allDay));
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "No pude leer tu calendario."));
    return () => {
      alive = false;
    };
  }, [url]);

  if (!cloudEnabled) return null;

  if (!url) {
    return (
      <Link href="/perfil" className="card mb-6 flex items-center gap-3 p-3 text-sm">
        <span className="text-2xl" aria-hidden>
          📅
        </span>
        <span>
          <strong>Conectá tu calendario</strong> y te armo el outfit para cada evento.
        </span>
      </Link>
    );
  }

  return (
    <section className="mb-6">
      <span className="label">Tu agenda</span>
      {error && <p className="card p-3 text-sm text-danger">{error}</p>}
      {!error && events === null && <p className="text-sm text-muted">Leyendo tu calendario…</p>}
      {events && events.length === 0 && (
        <p className="text-sm text-muted">No tenés eventos en los próximos días. Elegí la ocasión abajo.</p>
      )}
      {events && events.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {events.slice(0, 12).map((e) => {
            const occ = OCCASIONS.find((o) => o.id === e.occasion)!;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selectedId === e.id}
                onClick={() => onSelect(e)}
                className={`card w-40 shrink-0 p-3 text-left ${
                  selectedId === e.id ? "border-accent bg-accent-soft" : ""
                }`}
              >
                <span className="block text-xs text-muted">{formatWhen(e)}</span>
                <span className="line-clamp-2 block text-sm font-semibold">{e.title}</span>
                <span className="mt-1 block text-xs">
                  {occ.emoji} {occ.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
