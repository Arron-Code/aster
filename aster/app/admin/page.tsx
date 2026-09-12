"use client";
import { formatPrice } from "@/lib/format";
import { SubmitEvent, useEffect, useState } from "react";

type Overview = {
  ordersToday: number;
  openOrders: number;
  revenueCents: number;
  lowStock: number;
  ingredients: number;
};

export default function Admin() {  const [logged, setLogged] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [msg, setMsg] = useState("");
  async function load() {
    const r = await fetch("/api/admin/overview", { cache: "no-store" });
    console.log(r.status);
    if (r.status === 401) {
      setLogged(false);
      return;
    }
    if (r.ok) {
      setData(await r.json());
      setLogged(true);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function login(e: SubmitEvent) {
    e.preventDefault();
    const r = await fetch("/api/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) {
      setEmail("");
      setPassword("");
      load();
    } else setMsg("Passwort ist nicht korrekt ");
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setLogged(false);
    setData(null);
  }
  if (logged === null)
    return (
      <main className="wrap">
        <p>Verwaltung wird geladen...</p>
      </main>
    );
  if (!logged)
    return (
      <main className="wrap admin-narrow">
        <h1>Restaurant ERP</h1>
        <p className="muted">Mitarbeiter-Login</p>
        <form onSubmit={login} className="card admin-form">
          <label>
            E-Mail-Adresse
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Personalnummer
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <p className="muted small">Für den globalen Admin-Zugang kann die E-Mail-Adresse leer bleiben.</p>
          <button className="btn">Anmelden</button>
          {msg && <p>{msg}</p>}
        </form>
      </main>
    );
  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Übersicht</p>
          <h1>ERP-Dashboard</h1>
        </div>
      </header>

      <p className="muted">
        Aktueller Überblick über Restaurant, Bestellungen und Lager.
      </p>
      <div className="metric-grid">
        <Metric label="Heutige Bestellungen" value={data?.ordersToday ?? 0} />
        <Metric label="Offene Bestellungen" value={data?.openOrders ?? 0} />
        <Metric
          label="Heutiger bezahlter Umsatz"
          value={formatPrice(data?.revenueCents ?? 0)}
        />
        <Metric label="Lagerwarnungen" value={data?.lowStock ?? 0} />
        <Metric label="Aktive Zutaten" value={data?.ingredients ?? 0} />
      </div>
    </>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="card metric">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
