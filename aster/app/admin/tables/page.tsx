"use client";

import QRCode from "qrcode";
import { SubmitEvent, useEffect, useState } from "react";

type Table = {
  id: string;
  number: number;
  token: string;
  active: boolean;
  occupied: boolean;
  latestOrderStatus?: string | null;
  latestReservationStatus?: string | null;
  _count: { orders: number; reservations: number };
};

const emptyForm = { number: 1, active: true };

const tableStatusLabels: Record<string, string> = {
  NEW: "Neu",
  CONFIRMED: "Bestätigt",
  PREPARING: "In Zubereitung",
  SERVED: "Serviert",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
  PENDING: "Reserviert",
  SEATED: "Am Tisch",
};

const tableStatusClasses: Record<string, string> = {
  NEW: "status-new",
  CONFIRMED: "status-confirmed",
  PREPARING: "status-preparing",
  SERVED: "status-served",
  PAID: "status-paid",
  CANCELLED: "status-cancelled",
  PENDING: "status-new",
  SEATED: "status-served",
};

export default function TableManagement() {
  const [tables, setTables] = useState<Table[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/tables", { cache: "no-store" });
    if (response.status === 401) {
      location.href = "/admin";
      return;
    }
    if (!response.ok) {
      setMessage("Tische konnten nicht geladen werden.");
      return;
    }
    const result = (await response.json()) as Table[];
    setTables(result);
    const origin = window.location.origin;
    const codes = await Promise.all(
      result.map(async (table) => {
        const link = `${origin}/pay?table=${encodeURIComponent(table.token)}`;
        return [table.id, await QRCode.toDataURL(link, { width: 220, margin: 2 })] as const;
      }),
    );
    setQrCodes(Object.fromEntries(codes));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const response = await fetch(
      editing ? `/api/admin/tables/${editing}` : "/api/admin/tables",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    if (!response.ok) {
      setMessage((await response.json()).error || "Tisch konnte nicht gespeichert werden.");
      return;
    }
    setForm(emptyForm);
    setEditing(null);
    setMessage("Tisch gespeichert.");
    load();
  }

  function edit(table: Table) {
    setEditing(table.id);
    setForm({ number: table.number, active: table.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(table: Table) {
    if (!confirm(`Tisch ${table.number} wirklich löschen?`)) return;
    const response = await fetch(`/api/admin/tables/${table.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage((await response.json()).error || "Tisch konnte nicht gelöscht werden.");
      return;
    }
    load();
  }

  function tableLink(table: Table) {
    return `${window.location.origin}/pay?table=${encodeURIComponent(table.token)}`;
  }

  function tableStatus(table: Table) {
    if (!table.active) return { label: "Inaktiv", className: "status-cancelled" };
    if (table.latestOrderStatus) {
      const status = table.latestOrderStatus;
      return {
        label: tableStatusLabels[status] ?? status,
        className: tableStatusClasses[status] ?? "status-default",
      };
    }
    if (table.latestReservationStatus) {
      const status = table.latestReservationStatus;
      return {
        label: tableStatusLabels[status] ?? status,
        className: tableStatusClasses[status] ?? "status-default",
      };
    }
    return table.occupied
      ? { label: "Belegt", className: "status-confirmed" }
      : { label: "Frei", className: "status-paid" };
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>TischManagement</h1>
        </div>
        <button className="btn" type="button" onClick={() => window.print()}>
          Alle QR-Codes drucken
        </button>
      </header>

      <section className="table-monitor">
        <div className="table-monitor-header">
          <div>
            <p className="eyebrow">Service</p>
            <h2>Tischmonitor</h2>
          </div>
        </div>
        <div className="table-monitor-grid">
          {tables.map((table) => {
            const status = tableStatus(table);
            return (
              <div key={table.id} className="table-monitor-card">
                <div className="table-monitor-top">
                  <span className="table-monitor-number">Tisch {table.number}</span>
                  <span className={`badge ${status.className}`}>{status.label}</span>
                </div>
                <div className="table-monitor-meta">
                  <span>{table.occupied ? "Belegt" : "Frei"}</span>
                  <span>{table._count.orders} Bestellungen</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <form className="card admin-form table-form" onSubmit={save}>
        <h2>{editing ? "Tisch bearbeiten" : "Tisch anlegen"}</h2>
        <div className="admin-cols">
          <label>
            Tischnummer
            <input
              type="number"
              min="1"
              max="9999"
              value={form.number}
              onChange={(event) => setForm({ ...form, number: Number(event.target.value) })}
              required
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Tisch aktiv
          </label>
        </div>
        <div className="actions">
          <button className="btn">{editing ? "Änderungen speichern" : "Tisch anlegen"}</button>
          {editing && (
            <button type="button" className="btn secondary" onClick={() => { setEditing(null); setForm(emptyForm); }}>
              Abbrechen
            </button>
          )}
        </div>
        {message && <p>{message}</p>}
      </form>

      <section className="table-management-grid">
       {tables.map((table) => {
         const status = tableStatus(table);
         return (
           <article className={`card table-card${table.active ? "" : " inactive"}${table.occupied ? " occupied" : ""}`} key={table.id}>
             <div className="row">
               <div>
                 <p className="eyebrow">Tisch</p>
                 <h2>{table.number}</h2>
                 <span className={`badge ${status.className}${table.occupied || !table.active ? " off" : ""}`}>
                   {status.label}
                 </span>
               </div>
               {qrCodes[table.id] && (
                 <img className="table-qr" src={qrCodes[table.id]} alt={`QR-Code für Tisch ${table.number}`} />
               )}
             </div>
             <p className="muted">{table._count.orders} Bestellungen · {table._count.reservations} Reservierungen</p>
             <label className="table-link-label">
               Gültiger Bestelllink
               <input readOnly value={tableLink(table)} onFocus={(event) => event.currentTarget.select()} />
             </label>
             <div className="actions">
               <button className="btn secondary" type="button" onClick={() => edit(table)}>Ändern</button>
               <button className="btn secondary" type="button" onClick={() => window.open(tableLink(table), "_blank")}>Anzeigen</button>
               <button className="btn secondary" type="button" onClick={() => window.print()}>Drucken</button>
               <button className="danger" type="button" onClick={() => remove(table)}>Löschen</button>
             </div>
           </article>
         );
       })}
      </section>
    </>
  );
}
