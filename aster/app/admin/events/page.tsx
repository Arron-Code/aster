"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const emptyDraft = {
  title: "",
  category: "",
  date: "",
  time: "",
  location: "",
  capacity: "30",
  price: "25",
  description: "",
};

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

export default function EventManagementPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedView, setSelectedView] = useState<"all" | "upcoming" | "past">("all");
  const [message, setMessage] = useState("");
  const [attendeeInputs, setAttendeeInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
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

  const visibleEvents = useMemo(() => {
    if (selectedView === "upcoming") return events.filter((event) => event.status !== "COMPLETED");
    if (selectedView === "past") return events.filter((event) => event.status === "COMPLETED");
    return events;
  }, [events, selectedView]);

  const totalRevenue = events.reduce((sum, event) => sum + event.attendees.length * event.price, 0);
  const upcoming = events.filter((event) => event.status !== "COMPLETED").length;
  const seatsLeft = events.reduce((sum, event) => sum + Math.max(event.capacity - event.attendees.length, 0), 0);

  const handleCreateEvent = async (event: FormEvent) => {
    event.preventDefault();

    if (!draft.title.trim() || !draft.category.trim() || !draft.location.trim() || !draft.date || !draft.time) {
      setMessage("Bitte füllen Sie Titel, Kategorie, Ort, Datum und Uhrzeit aus.");
      return;
    }

    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          category: draft.category,
          date: draft.date,
          time: draft.time,
          location: draft.location,
          capacity: Number(draft.capacity),
          price: Number(draft.price),
          description: draft.description,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Event konnte nicht gespeichert werden.");
      }

      setDraft(emptyDraft);
      setMessage("Event erfolgreich erstellt.");
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Event konnte nicht gespeichert werden.");
    }
  };

  const handleAddAttendee = async (eventId: string) => {
    const attendeeName = (attendeeInputs[eventId] || "").trim();
    if (!attendeeName) {
      setMessage("Bitte geben Sie einen Namen ein.");
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

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Event konnte nicht gelöscht werden.");
      }
      setMessage("Event wurde gelöscht.");
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Event konnte nicht gelöscht werden.");
    }
  };

  const handleStatusCycle = async (eventId: string) => {
    const target = events.find((event) => event.id === eventId);
    if (!target) return;

    const nextStatus: EventStatus =
      target.status === "PLANNED" ? "ONGOING" : target.status === "ONGOING" ? "COMPLETED" : "PLANNED";

    try {
      const response = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status: nextStatus }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Status konnte nicht geändert werden.");
      }

      setMessage(`Status auf ${getStatusLabel(nextStatus)} gesetzt.`);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Eventmanagement</p>
          <h1>Events & Veranstaltungen</h1>
        </div>
      </header>

      <section className="event-stats-grid">
        <article className="stat-card card">
          <span>Gesamt Events</span>
          <strong>{events.length}</strong>
          <small>Aktive und historische Termine</small>
        </article>
        <article className="stat-card card">
          <span>Geplant & aktiv</span>
          <strong>{upcoming}</strong>
          <small>Bevorstehende Veranstaltungen</small>
        </article>
        <article className="stat-card card">
          <span>Freie Plätze</span>
          <strong>{seatsLeft}</strong>
          <small>Verfügbare Kapazitäten</small>
        </article>
        <article className="stat-card card">
          <span>Umsatz</span>
          <strong>{formatPrice(totalRevenue)}</strong>
          <small>Basierend auf Ticketzahlungen</small>
        </article>
      </section>

      <section className="event-manager-layout">
        <div className="card event-form-card">
          <div className="event-section-head">
            <h2>Event erstellen</h2>
          </div>

          <form onSubmit={handleCreateEvent} className="event-form">
            <label>
              Titel
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Festival Night" />
            </label>

            <div className="form-row-two">
              <label>
                Kategorie
                <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                  <option value="">Bitte wählen</option>
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ort
                <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Main Hall" />
              </label>
            </div>

            <div className="form-row-two">
              <label>
                Datum
                <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </label>
              <label>
                Uhrzeit
                <input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
              </label>
            </div>

            <div className="form-row-two">
              <label>
                Kapazität
                <input type="number" min={1} value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} />
              </label>
              <label>
                Preis (€)
                <input type="number" min={0} step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
              </label>
            </div>

            <label>
              Beschreibung
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Kurzbeschreibung des Events" />
            </label>

            {message && <p className="event-message">{message}</p>}

            <button className="btn" type="submit">Event speichern</button>
          </form>
        </div>

        <div className="card event-list-card">
          <div className="event-toolbar">
            <div className="event-section-head">
              <h2>Veranstaltungen</h2>
            </div>
            <div className="event-filter-tabs">
              <button type="button" className={selectedView === "all" ? "active" : ""} onClick={() => setSelectedView("all")}>Alle</button>
              <button type="button" className={selectedView === "upcoming" ? "active" : ""} onClick={() => setSelectedView("upcoming")}>Aktuell</button>
              <button type="button" className={selectedView === "past" ? "active" : ""} onClick={() => setSelectedView("past")}>Vergangen</button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Events werden geladen…</div>
          ) : (
            <div className="event-list">
              {visibleEvents.length === 0 ? (
                <div className="empty-state">Keine Veranstaltungen gefunden.</div>
              ) : (
                visibleEvents.map((event) => {
                  const { date, time } = getDateParts(event.eventDate);
                  const seatsLeftCurrent = Math.max(event.capacity - event.attendees.length, 0);

                  return (
                    <article key={event.id} className="event-card">
                      <div className="event-card-topline">
                        <span className="event-pill">{event.category}</span>
                        <span className={`status-badge ${event.status.toLowerCase()}`}>{getStatusLabel(event.status)}</span>
                      </div>

                      <h3>{event.title}</h3>
                      <p className="event-meta">{date} • {time} • {event.location}</p>
                      <p className="event-description">{event.description || "Beschreibung folgt."}</p>

                      <div className="event-quick-stats">
                        <span>{event.attendees.length}/{event.capacity} Gäste</span>
                        <span>{seatsLeftCurrent} frei</span>
                        <span>{formatPrice(event.price)}</span>
                      </div>

                      <div className="event-actions">
                        <button type="button" className="btn secondary small" onClick={() => handleStatusCycle(event.id)}>
                          Status ändern
                        </button>
                        <button type="button" className="danger small" onClick={() => handleDeleteEvent(event.id)}>
                          Löschen
                        </button>
                      </div>

                      <div className="attendee-box">
                        <div className="attendee-form">
                          <input
                            value={attendeeInputs[event.id] ?? ""}
                            onChange={(inputEvent) => setAttendeeInputs((current) => ({ ...current, [event.id]: inputEvent.target.value }))}
                            placeholder="Teilnehmername"
                          />
                          <button type="button" className="btn small" onClick={() => handleAddAttendee(event.id)}>
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
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
