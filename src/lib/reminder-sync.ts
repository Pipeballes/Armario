"use client";

// Arma los mensajes de los próximos 7 días (agenda + clima + tu ropa) para el recordatorio.

import type { AgendaEvent } from "./agenda";
import { fetchAgenda } from "./agenda-client";
import { planWeek, type PlanDay } from "./planner";
import { reminderMessages, type ReminderMessage } from "./reminder";
import { calendarsOf, type Garment, type Profile } from "./types";
import { fetchForecast, readingFor, savedPlace, type Forecast } from "./weather";

const dayAt = (date: string, h: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, h);
};

function readingOf(forecast: Forecast | null, day: PlanDay) {
  if (!forecast) return null;
  return day.event
    ? readingFor(forecast, new Date(day.event.start), { allDay: day.event.allDay })
    : readingFor(forecast, dayAt(day.date, 12), { allDay: true });
}

export async function buildWeekMessages(garments: Garment[], profile: Profile): Promise<Record<string, ReminderMessage>> {
  const calendars = calendarsOf(profile);
  const place = savedPlace();
  const [agenda, forecast] = await Promise.all([
    calendars.length ? fetchAgenda(calendars).catch(() => ({ events: [] as AgendaEvent[] })) : { events: [] as AgendaEvent[] },
    place ? fetchForecast(place).catch(() => null) : null,
  ]);
  const plan = planWeek({
    garments,
    profile,
    events: agenda.events,
    start: new Date(),
    pinned: profile.weekPlan ?? {},
    feedback: profile.feedback,
    weatherFor: forecast
      ? (day, ev) => {
          const at = ev ? new Date(ev.start) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
          return readingFor(forecast, at, { allDay: ev ? ev.allDay : true })?.weather ?? null;
        }
      : undefined,
  });
  return reminderMessages(plan, (d) => readingOf(forecast, d));
}
