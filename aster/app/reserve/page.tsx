"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type PublicTable = {
  id: string;
  number: number;
  token: string;
  active: boolean;
  occupied: boolean;
};

const emptyForm = {
  guestName: "",
  phone: "",
  email: "",
  notes: "",
  date: new Date().toISOString().slice(0, 10),
  time: "19:00",
  guestCount: 2,
};

export default function ReservePage() {
  const [tables, setTables] = useState<PublicTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [savedReservation, setSavedReservation] = useState<{
    guestName: string;
    tableNumber: number;
    tableToken: string;
    date: string;
    time: string;
    guestCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/tables", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Tische konnten nicht geladen werden.");
        return response.json() as Promise<PublicTable[]>;
      })
      .then((result) => setTables(result))
      .catch(() => setMessage("Tische konnten nicht geladen werden."));
  }, []);

  const allTablesFree = tables.length > 0 && tables.every((table) => !table.occupied && table.active);

  const tableCards = useMemo(
    () =>
      tables.map((table, index) => ({
        ...table,
        visuallyOccupied: table.occupied || (allTablesFree && index < 2),
        selectable: table.active && !table.occupied && !(allTablesFree && index < 2),
      })),
    [allTablesFree, tables],
  );

  const selectedTable = tableCards.find((table) => table.id === selectedTableId) ?? null;

  function closeReservationForm() {
    setSelectedTableId(null);
    setMessage("");
  }

  useEffect(() => {
    if (!selectedTable) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReservationForm();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTable]);

  async function submitReservation(event: FormEvent) {
    event.preventDefault();
    if (!selectedTable || !selectedTable.selectable) {
      setMessage("Bitte wählen Sie einen freien Tisch aus.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.id,
          guestName: form.guestName,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
          date: form.date,
          time: form.time,
          guestCount: form.guestCount,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        tableNumber?: number;
        tableToken?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Reservierung fehlgeschlagen.");
      }

      setSavedReservation({
        guestName: form.guestName,
        tableNumber: selectedTable.number,
        tableToken: payload.tableToken || selectedTable.token,
        date: form.date,
        time: form.time,
        guestCount: form.guestCount,
      });
      setForm(emptyForm);
      setSelectedTableId(null);
      const refreshed = await fetch("/api/tables", { cache: "no-store" });
      if (refreshed.ok) setTables((await refreshed.json()) as PublicTable[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reservierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wrap reserve-page">
      <div className="card reserve-shell">
        <div className="reserve-header">
          <div>
            <p className="eyebrow">Tischreservierung</p>
            <h1>Platz für Ihren Abend sichern</h1>
          </div>
          <Link className="btn secondary" href="/">
            Zurück zur Startseite
          </Link>
        </div>

        {savedReservation ? (
          <div className="reservation-success">
            <h2>Reservierung bestätigt</h2>
            <p>
              Vielen Dank, {savedReservation.guestName}. Tisch {savedReservation.tableNumber} wurde für {savedReservation.guestCount}{" "}
              {savedReservation.guestCount === 1 ? "Person" : "Personen"} am{" "}
              {new Date(`${savedReservation.date}T00:00:00`).toLocaleDateString("de-DE")} um {savedReservation.time} Uhr reserviert.
            </p>
            <div className="actions">
              <Link className="btn" href={`/order?table=${encodeURIComponent(savedReservation.tableToken)}`}>
                Jetzt bestellen
              </Link>
              <Link className="btn secondary" href="/reserve">
                Weitere Reservierung
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="table-picker-grid">
              {tableCards.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  className={`table-picker-card${table.visuallyOccupied ? " occupied" : " free"}${selectedTableId === table.id ? " selected" : ""}`}
                  onClick={() => table.selectable && setSelectedTableId(table.id)}
                  disabled={!table.selectable}
                >
                  <span className="table-picker-number">Tisch {table.number}</span>
                  <span className={`badge ${table.visuallyOccupied ? "status-confirmed" : "status-paid"}`}>
                    {table.visuallyOccupied ? "Belegt" : "Frei"}
                  </span>
                </button>
              ))}
            </section>

            {selectedTable && (
              <div className="reservation-modal-backdrop" role="presentation" onMouseDown={closeReservationForm}>
                <section
                  className="reservation-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="reservation-modal-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="reservation-modal-header">
                    <h2 id="reservation-modal-title">Reservierung für Tisch {selectedTable.number}</h2>
                    <button className="reservation-modal-close" type="button" onClick={closeReservationForm} aria-label="Reservierungsformular schließen">
                      ×
                    </button>
                  </div>
                  <form className="admin-form reserve-form" onSubmit={submitReservation}>

                    <label>
                      Name
                      <input
                        type="text"
                        value={form.guestName}
                        onChange={(event) => setForm({ ...form, guestName: event.target.value })}
                        placeholder="Max Mustermann"
                        required
                        autoFocus
                      />
                    </label>

                    <div className="admin-cols">
                      <label>
                        Datum
                        <input
                          type="date"
                          value={form.date}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(event) => setForm({ ...form, date: event.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Uhrzeit
                        <input
                          type="time"
                          value={form.time}
                          onChange={(event) => setForm({ ...form, time: event.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Personenzahl
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={form.guestCount}
                          onChange={(event) => setForm({ ...form, guestCount: Number(event.target.value) })}
                          required
                        />
                      </label>
                    </div>

                    <div className="admin-cols">
                      <label>
                        E-Mail-Adresse
                        <input
                          type="email"
                          value={form.email}
                          onChange={(event) => setForm({ ...form, email: event.target.value })}
                          placeholder="name@email.de"
                          required
                        />
                      </label>
                      <label>
                        Telefonnummer
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(event) => setForm({ ...form, phone: event.target.value })}
                          placeholder="+49 170 1234567"
                          required
                        />
                      </label>
                    </div>

                    <label>
                      Hinweis
                      <textarea
                        value={form.notes}
                        onChange={(event) => setForm({ ...form, notes: event.target.value })}
                        placeholder="z. B. Fensterplatz, Geburtstag, Allergien"
                      />
                    </label>

                    {message && <p className="reservation-error">{message}</p>}

                    <div className="actions">
                      <button className="btn" type="submit" disabled={loading}>
                        {loading ? "Wird gespeichert..." : "Reservierung bestätigen"}
                      </button>
                      <button className="btn secondary" type="button" onClick={closeReservationForm}>
                        Abbrechen
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
