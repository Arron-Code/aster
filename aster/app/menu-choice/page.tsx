"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

type Mode = "pickup" | "delivery";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

export default function MenuChoicePage() {
  return (
    <Suspense fallback={<main className="wrap"><p>Wird geladen...</p></main>}>
      <MenuChoiceContent />
    </Suspense>
  );
}

function MenuChoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode | null>(
    initialMode === "pickup" || initialMode === "delivery" ? initialMode : null,
  );
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function continueToOrder(event: FormEvent) {
    event.preventDefault();

    if (!mode) {
      setMessage("Bitte wählen Sie eine Bestellart aus.");
      return;
    }

    if (mode === "delivery" && !form.address.trim()) {
      setMessage("Bitte geben Sie die Lieferadresse ein.");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/order-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
      }),
    });

    setLoading(false);

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      tableToken?: string;
    };

    if (!response.ok) {
      setMessage(payload.error || "Bestellung konnte nicht gestartet werden.");
      return;
    }

    const params = new URLSearchParams({
      table: payload.tableToken || "",
      mode,
      name: form.name,
      email: form.email,
      phone: form.phone,
    });

    if (mode === "delivery") params.set("address", form.address);

    router.push(`/order?${params.toString()}`);
  }

  if (mode === "pickup" || mode === "delivery") {
    return (
      <main className="wrap reserve-page">
        <div className="card reserve-shell premium-shell">
          <div className="reserve-header">
            <div>
              <p className="eyebrow">Menü</p>
              <h1>{mode === "pickup" ? "Abholung" : "Lieferung"}</h1>
            </div>
            <button type="button" className="btn secondary" onClick={() => setMode(null)}>
              Zurück
            </button>
          </div>

          <div className="selection-summary">
            <span className="selection-pill">{mode === "pickup" ? "🚚 Abholung" : "📦 Lieferung"}</span>
            <p>Bitte geben Sie Ihre Kontaktdaten ein, damit wir Ihre Bestellung perfekt vorbereiten können.</p>
          </div>

          <form className="admin-form premium-form" onSubmit={continueToOrder}>
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Max Mustermann"
                required
              />
            </label>

            <div className="admin-cols">
              <label>
                E-Mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="name@email.de"
                  required
                />
              </label>
              <label>
                Telefon
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="+49 170 1234567"
                  required
                />
              </label>
            </div>

            {mode === "delivery" && (
              <label>
                Lieferadresse
                <textarea
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  placeholder="Straße, Hausnummer, Stadt"
                  required
                />
              </label>
            )}

            {message && <p className="reservation-error">{message}</p>}

            <div className="actions">
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Wird vorbereitet..." : "Weiter zur Bestellung"}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap reserve-page">
      <div className="card reserve-shell premium-shell">
        <div className="reserve-header">
          <div>
            <p className="eyebrow">Menü</p>
            <h1>Bestellart wählen</h1>
          </div>
          <button type="button" className="btn secondary" onClick={() => router.push("/")}>
            Zurück zur Startseite
          </button>
        </div>

        <div className="selection-intro">
          <p>Wählen Sie Ihre bevorzugte Art der Bestellung – einfach, schnell und individuell für Ihren Moment.</p>
        </div>

        <div className="table-picker-grid option-grid">
          <button type="button" className="table-picker-card option-card pickup" onClick={() => setMode("pickup")}>
            <span className="option-icon">🏠</span>
            <span className="table-picker-number">Abholen</span>
            <span className="option-copy">Schnell und unkompliziert – Ihre Bestellung wird vorbereitet und steht für Sie bereit.</span>
            <span className="badge status-paid">Auswählen</span>
          </button>
          <button type="button" className="table-picker-card option-card delivery" onClick={() => setMode("delivery")}>
            <span className="option-icon">🚚</span>
            <span className="table-picker-number">Liefern</span>
            <span className="option-copy">Direkt zu Ihnen nach Hause oder ins Büro – mit Lieferadresse und Kontaktangaben.</span>
            <span className="badge status-confirmed">Auswählen</span>
          </button>
          <button type="button" className="table-picker-card option-card melody" onClick={() => router.push("/reserve")}>
            <span className="option-icon">🎵</span>
            <span className="table-picker-number">Mit Melodie geniessen</span>
            <span className="option-copy">Reservieren Sie einen Tisch für ein entspanntes Erlebnis mit Musik und kulinarischem Genuss.</span>
            <span className="badge status-served">Reservieren</span>
          </button>
        </div>
      </div>
    </main>
  );
}
