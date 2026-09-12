"use client";

import { useEffect, useState } from "react";

type EventStatus = "PLANNED" | "ONGOING" | "COMPLETED";

type EventAttendee = {
  id: string;
  name: string;
};

type EventItem = {
  id: string;
  title: string;
  category: string;
  eventDate: string;
  location: string;
  capacity: number;
  price: number;
  description: string;
  status: EventStatus;
  attendees: EventAttendee[];
};

const EVENT_CATEGORIES = ["Beauty", "Melody", "Creativity", "Commedy", "Community"] as const;

const formatPrice = (value: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);

const getStatusLabel = (status: EventStatus) => {
  if (status === "PLANNED") return "Geplant";
  if (status === "ONGOING") return "Laufend";
  return "Abgeschlossen";
};

const getDateParts = (iso: string) => {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
  };
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [message, setMessage] = useState("");
  const [attendeeInputs, setAttendeeInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<"all" | (typeof EVENT_CATEGORIES)[number]>("all");

  async function loadEvents() {
    setLoading(true);
    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      if (!response.ok) throw new Error("Fehler beim Laden der Events");
      const data = (await response.json()) as EventItem[];
      setEvents(data);
    } catch {
      setMessage("Events konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const handleAddAttendee = async (eventId: string) => {
    const attendeeName = (attendeeInputs[eventId] || "").trim();
    if (!attendeeName) {
      setMessage("Bitte geben Sie einen Namen für die Anmeldung ein.");
      return;
    }

    try {
      const response = await fetch(`/api/events/${eventId}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: attendeeName }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Anmeldung fehlgeschlagen");
      }

      setAttendeeInputs((current) => ({ ...current, [eventId]: "" }));
      setMessage(`${attendeeName} wurde erfolgreich angemeldet.`);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.");
    }
  };

  const handleRemoveAttendee = async (eventId: string, attendeeName: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/attendees`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: attendeeName }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Teilnehmer konnte nicht entfernt werden");
      }

      setMessage(`${attendeeName} wurde entfernt.`);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Entfernen fehlgeschlagen.");
    }
  };

  const visibleEvents = activeCategory === "all" ? events : events.filter((event) => event.category === activeCategory);

  return (
    <main className="wrap event-page-shell">
      <section className="event-header card">
        <div>
          <p className="eyebrow">Veranstaltungen</p>
          <h1>Events & Veranstaltungen</h1>
        </div>
      </section>

      <section className="card event-list-card">
        <div className="event-category-tabs">
          <button type="button" className={activeCategory === "all" ? "active" : ""} onClick={() => setActiveCategory("all")}>
            Alle
          </button>
          {EVENT_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {message && <p className="event-message">{message}</p>}

        {loading ? (
          <div className="empty-state">Events werden geladen…</div>
        ) : (
          <div className="grid">
            {visibleEvents.length === 0 ? (
              <div className="empty-state">Keine Veranstaltungen gefunden.</div>
            ) : (
              visibleEvents.map((event) => {
                const { date, time } = getDateParts(event.eventDate);
                const seatsLeftCurrent = Math.max(event.capacity - event.attendees.length, 0);
                const fillRatio = event.capacity > 0 ? Math.min(event.attendees.length / event.capacity, 1) : 0;
                const fillPercent = Math.round(fillRatio * 100);
                const batteryLevel = fillRatio >= 1 ? "full" : fillRatio >= 0.66 ? "high" : fillRatio >= 0.33 ? "medium" : fillRatio > 0 ? "low" : "empty";

                return (
                  <article className="card menu-item-card menu-item-card-premium" key={event.id}>
                    <div className="menu-item-image-wrap">
                      <div className="menu-item-image placeholder">{event.category || "Event"}</div>
                    </div>
                    <div className="menu-item-content">
                      <div className="menu-item-copy">
                        <small>{date} • {time} • {event.location}</small>
                        <h3>
                          {event.title}{" "}
                          <span className={`status-badge ${event.status.toLowerCase()}`}>{getStatusLabel(event.status)}</span>
                        </h3>
                        <p className="muted">{event.description || "Beschreibung folgt."}</p>
                        <b className="menu-item-price">{formatPrice(event.price)}</b>
                      </div>
                      <div className="menu-item-actions menu-item-actions-column">
                        <div className="event-battery-wrap" title={`${event.attendees.length}/${event.capacity} Plätze belegt`}>
                          <div className={`event-battery level-${batteryLevel}`}>
                            <div className="event-battery-fill" style={{ width: `${fillPercent}%` }} />
                          </div>
                          <div className="event-battery-cap" />
                          <span className="event-battery-label">
                            {seatsLeftCurrent > 0 ? `${seatsLeftCurrent} Plätze frei` : "Ausgebucht"}
                          </span>
                        </div>
                        <div className="attendee-box">
                          <div className="attendee-form">
                            <input
                              value={attendeeInputs[event.id] ?? ""}
                              onChange={(inputEvent) => setAttendeeInputs((current) => ({ ...current, [event.id]: inputEvent.target.value }))}
                              placeholder="Teilnehmername"
                            />
                            <button type="button" className="btn small" onClick={() => handleAddAttendee(event.id)} disabled={seatsLeftCurrent === 0}>
                              Anmelden
                            </button>
                          </div>

                          <ul className="attendee-list">
                            {event.attendees.length === 0 ? (
                              <li>Noch keine Anmeldungen.</li>
                            ) : (
                              event.attendees.map((person) => (
                                <li key={person.id}>
                                  <span>{person.name}</span>
                                  <button type="button" className="text-link" onClick={() => handleRemoveAttendee(event.id, person.name)}>
                                    Entfernen
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
    </main>
  );
}
