import { describe, expect, it } from "vitest";
import { guessOccasion, normalizeCalendarUrl } from "./agenda";
import { eventsFromIcs } from "./ics";

describe("guessOccasion", () => {
  it("reconoce ocasiones comunes", () => {
    expect(guessOccasion("Reunión con cliente")).toBe("trabajo");
    expect(guessOccasion("Casamiento de Sofi")).toBe("formal");
    expect(guessOccasion("Gym")).toBe("deporte");
    expect(guessOccasion("Cumple de Juan")).toBe("noche");
    expect(guessOccasion("Asado con la familia")).toBe("familia");
    expect(guessOccasion("Cita con Lu")).toBe("cita");
    expect(guessOccasion("Comprar pan")).toBe("casual");
  });
});

describe("normalizeCalendarUrl", () => {
  it("acepta links de iCloud y Google, y convierte webcal", () => {
    expect(normalizeCalendarUrl("webcal://p123-caldav.icloud.com/published/2/abc")?.href).toBe(
      "https://p123-caldav.icloud.com/published/2/abc",
    );
    expect(normalizeCalendarUrl("https://calendar.google.com/calendar/ical/x/private-y/basic.ics")).not.toBeNull();
  });
  it("rechaza otros sitios", () => {
    expect(normalizeCalendarUrl("https://evil.example.com/cal.ics")).toBeNull();
    expect(normalizeCalendarUrl("http://p1-caldav.icloud.com/x")).toBeNull();
    expect(normalizeCalendarUrl("no es un link")).toBeNull();
  });
});

describe("eventsFromIcs", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:1",
    "DTSTART;TZID=America/Argentina/Buenos_Aires:20261126T100000",
    "DTEND;TZID=America/Argentina/Buenos_Aires:20261126T110000",
    "SUMMARY:Reunión con cliente",
    "LOCATION:Oficina",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:2",
    "DTSTART;TZID=America/Argentina/Buenos_Aires:20261103T190000",
    "DTEND;TZID=America/Argentina/Buenos_Aires:20261103T200000",
    "RRULE:FREQ=WEEKLY;BYDAY=TU",
    "SUMMARY:Gym",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:3",
    "DTSTART;VALUE=DATE:20261128",
    "DTEND;VALUE=DATE:20261129",
    "SUMMARY:Casamiento de Sofi",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:4",
    "DTSTART:20250101T100000Z",
    "SUMMARY:Evento viejo",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  it("trae los eventos de la semana, con los repetidos expandidos", () => {
    const from = new Date("2026-11-24T00:00:00-03:00");
    const to = new Date("2026-12-01T00:00:00-03:00");
    const events = eventsFromIcs(ics, from, to);
    const titles = events.map((e) => e.title);
    expect(titles).toEqual(["Gym", "Reunión con cliente", "Casamiento de Sofi"]);
    const meeting = events.find((e) => e.title === "Reunión con cliente")!;
    expect(meeting.start).toBe("2026-11-26T13:00:00.000Z");
    expect(meeting.occasion).toBe("trabajo");
    expect(meeting.location).toBe("Oficina");
    expect(events.find((e) => e.title === "Casamiento de Sofi")!.allDay).toBe(true);
    expect(events.find((e) => e.title === "Gym")!.start).toBe("2026-11-24T22:00:00.000Z");
  });
});
