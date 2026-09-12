"use client";
import { SubmitEvent, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
type Category = "FOOD" | "DRINK" | "COFFEE";
type Item = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: Category;
  available: boolean;
  sortOrder: number;
  quantity: number;
  deliveryTimeDays: number | null;
  supplierId: string | null;
  supplier: Supplier | null;
};
type Supplier = {
  id: string;
  name: string;
};
const empty = {
  name: "",
  description: "",
  price: "",
  category: "FOOD" as Category,
  available: true,
  sortOrder: 0,
  quantity: 0,
  deliveryTimeDays: "",
  supplierId: "",
};
export default function Admin() {
  const [logged, setLogged] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  function categoryLabel(category: Category) {
    if (category === "DRINK") return "Getränk";
    if (category === "COFFEE") return "Kaffee";
    return "Speise";
  }
  async function load() {
    const r = await fetch("/api/admin/menu", { cache: "no-store" }
    );
    if (r.status === 401) {
      setLogged(false);
      return;
    }
    if (r.ok) {
      setItems(await r.json());
      setLogged(true);
      loadSuppliers();
    }
  }
  async function loadSuppliers() {
    const r = await fetch("/api/admin/suppliers", { cache: "no-store" });
    if (r.ok) setSuppliers(await r.json());
  }
  useEffect(() => {
    load();
  }, []);
  async function login(e: SubmitEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (r.ok) {
      setPassword("");
      load();
    } else setMsg("Passwort ist nicht korrekt.");
  }
  function edit(x: Item) {
    setEditing(x.id);
    setForm({
      name: x.name,
      description: x.description,
      price: (x.priceCents / 100).toFixed(2),
      category: x.category,
      available: x.available,
      sortOrder: x.sortOrder,
      quantity: x.quantity,
      deliveryTimeDays: x.deliveryTimeDays === null ? "" : String(x.deliveryTimeDays),
      supplierId: x.supplierId ?? "",
    });
    scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save(e: SubmitEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(form.price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents)) {
      setMsg("Bitte einen gültigen Preis eingeben.");
      return;
    }
    const body = {
      name: form.name,
      description: form.description,
      priceCents,
      category: form.category,
      available: form.available,
      quantity: Number(form.quantity),
      deliveryTimeDays: form.deliveryTimeDays === "" ? null : Number(form.deliveryTimeDays),
      supplierId: form.supplierId || null,
    };
    const r = await fetch(
      editing ? `/api/admin/menu/${editing}` : "/api/admin/menu",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (r.ok) {
      setForm({ ...empty });
      setEditing(null);
      setMsg("Gespeichert.");
      load();
    } else setMsg((await r.json()).error || "Speichern fehlgeschlagen.");
  }
  async function del(id: string) {
    if (
      !confirm(
        "Produkt wirklich löschen? Für historische Bestellungen besser nur „verfügbar“ deaktivieren.",
      )
    )
      return;
    const r = await fetch(`/api/admin/menu/${id}`, { method: "DELETE" });
    if (r.ok) load();
    else setMsg((await r.json()).error);
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setLogged(false);
    setItems([]);
  }
  if (logged === null)
    return (
      <main className="wrap">
        <p>Lade Verwaltung …</p>
      </main>
    );
  if (!logged)
    return (
      <main className="wrap admin-narrow">
        <h1>Produktverwaltung</h1>
        <p className="muted">Mitarbeiter-Login</p>
        <form onSubmit={login} className="card admin-form">
          <label>
            Admin-Passwort oder Personalnummer
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn">Anmelden</button>
          {msg && <p>{msg}</p>}
        </form>
      </main>
    );
  return (
    <main className="wrap">
      <div className="row">
        <div>
          <h1>Produkt- & Preisverwaltung</h1>
          <p className="muted">Speisekarte, Preise und Verfügbarkeit ändern.</p>
        </div>
        <button className="btn secondary" onClick={logout}>
          Abmelden
        </button>
      </div>
      <form onSubmit={save} className="card admin-form">
        <h2>{editing ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
        <label>
          Name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={100}
          />
        </label>
        <label>
          Beschreibung
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={500}
          />
        </label>
        <div className="admin-cols">
          <label>
            Preis in €
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="12,90"
              required
            />
          </label>
          <label>
            Kategorie
            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as Category,
                })
              }
            >
              <option value="FOOD">Speise</option>
              <option value="DRINK">Getränk</option>
              <option value="COFFEE">Kaffee</option>
            </select>
          </label>
          <label>
            Menge
            <input
              type="number"
              min="0"
              max="1000000"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Lieferzeit (Tage)
            <input
              type="number"
              min="0"
              max="365"
              value={form.deliveryTimeDays}
              onChange={(e) =>
                setForm({ ...form, deliveryTimeDays: e.target.value })
              }
              placeholder="z. B. 3"
            />
          </label>
          <label>
            Lieferant
            <select
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            >
              <option value="">Kein Lieferant</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm({ ...form, available: e.target.checked })}
          />{" "}
          Im QR-Menü verfügbar
        </label>
        <div className="actions">
          <button className="btn">
            {editing ? "Änderungen speichern" : "Produkt anlegen"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setEditing(null);
                setForm({ ...empty });
              }}
            >
              Abbrechen
            </button>
          )}
        </div>
        {msg && <p>{msg}</p>}
      </form>
      <h2>Produkte ({items.length})</h2>
      <p className="muted">Sortiert nach Menge, Lieferzeit und Lieferant.</p>
      <div className="admin-list product-industrial-list">
        {items.map((x) => (
          <article className="product-industrial-card" key={x.id}>
            <div className="product-industrial-main">
              <div className="product-industrial-title-row">
                <b>{x.name}</b>
                <span className="badge product-industrial-badge">
                  {categoryLabel(x.category)}
                </span>
              </div>
              <p>{x.description}</p>
              <div className="product-industrial-meta">
                <span>
                  <small>Preis</small>
                  <strong>{formatPrice(x.priceCents)}</strong>
                </span>
                <span>
                  <small>Menge</small>
                  <strong>{x.quantity}</strong>
                </span>
                <span>
                  <small>Lieferzeit</small>
                  <strong>{x.deliveryTimeDays === null ? "-" : `${x.deliveryTimeDays} Tage`}</strong>
                </span>
                <span>
                  <small>Lieferant</small>
                  <strong>{x.supplier?.name ?? "-"}</strong>
                </span>
              </div>
              {!x.available && (
                <span className="badge off product-industrial-status">Nicht verfügbar</span>
              )}
            </div>
            <div className="actions product-industrial-actions">
              <button className="btn secondary" onClick={() => edit(x)}>
                Bearbeiten
              </button>
              <button className="danger" onClick={() => del(x.id)}>
                Löschen
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
