"use client";

import { useEffect, useState } from "react";

type Reservation = {
  id: string;
  guestName: string;
  guestCount: number;
  phone?: string | null;
  email?: string | null;
  reservationDate: string;
  reservationTime: string;
  notes?: string | null;
  status: "PENDING" | "CONFIRMED" | "SEATED" | "CANCELLED";
  table?: { id: string; number: number; token: string } | null;
};

const statusLabels: Record<Reservation["status"], string> = {
  PENDING: "Ausstehend",
  CONFIRMED: "Bestätigt",
  SEATED: "Platz genommen",
  CANCELLED: "Storniert",
};

const statusClasses: Record<Reservation["status"], string> = {
  PENDING: "status-new",
  CONFIRMED: "status-confirmed",
  SEATED: "status-served",
  CANCELLED: "status-cancelled",
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/reservations", { cache: "no-store" });
    if (!response.ok) {
      setMessage("Reservierungen konnten nicht geladen werden.");
      return;
    }

    const result = (await response.json()) as Reservation[];
    setReservations(result);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(reservationId: string, status: Reservation["status"]) {
    const response = await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId, status }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(payload.error || "Reservierung konnte nicht aktualisiert werden.");
      return;
    }

    setMessage("Reservierung aktualisiert.");
    load();
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Reservierungen</h1>
        </div>
      </header>

      <section className="card admin-form">
        <h2>Aktuelle Tischreservierungen</h2>
        {message && <p>{message}</p>}

        {reservations.length === 0 ? (
          <p className="muted">Keine Reservierungen vorhanden.</p>
        ) : (
          <div className="admin-list">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="admin-list-item">
                <div className="row">
                  <div>
                    <h3>{reservation.guestName}</h3>
                    <p className="muted">
                      {new Date(reservation.reservationDate).toLocaleDateString("de-DE")} · {reservation.reservationTime} · {reservation.guestCount} Gäste
                    </p>
                  </div>
                  <span className={`badge ${statusClasses[reservation.status]}`}>{statusLabels[reservation.status]}</span>
                </div>

                <div className="reservation-meta">
                  <span>Tisch {reservation.table?.number ?? "—"}</span>
                  {reservation.phone && <span>{reservation.phone}</span>}
                  {reservation.email && <span>{reservation.email}</span>}
                </div>

                {reservation.notes && <p className="muted">Hinweis: {reservation.notes}</p>}

                <div className="actions">
                  {reservation.status !== "CONFIRMED" && (
                    <button className="btn secondary" type="button" onClick={() => updateStatus(reservation.id, "CONFIRMED")}>
                      Bestätigen
                    </button>
                  )}
                  {reservation.status !== "SEATED" && (
                    <button className="btn secondary" type="button" onClick={() => updateStatus(reservation.id, "SEATED")}>
                      Platz genommen
                    </button>
                  )}
                  {reservation.status !== "CANCELLED" && (
                    <button className="btn danger" type="button" onClick={() => updateStatus(reservation.id, "CANCELLED")}>
                      Stornieren
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
