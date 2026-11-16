"use client";

import { useCallback, useEffect, useState } from "react";

const columns = [
  { status: "NEW", title: "Neu", action: "Annehmen", next: "CONFIRMED" },
  { status: "CONFIRMED", title: "Bestätigt", action: "Zubereitung starten", next: "PREPARING" },
  { status: "PREPARING", title: "In Zubereitung", action: "Fertig / serviert", next: "SERVED" },
] as const;

type KitchenOrder = {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  table: { number: number };
  items: { id: string; quantity: number; active: boolean; menuItem: { name: string } }[];
};

function minutesSince(value: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
}

export default function Page() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (response.status === 401) {
      location.href = "/backoffice";
      return;
    }
    if (!response.ok) {
      setMsg("Bestellungen konnten nicht geladen werden.");
      return;
    }
    setMsg("");
    setOrders(await response.json());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  async function advance(id: string, status: string) {
    const response = await fetch(`/api/admin/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMsg(data.error || "Status konnte nicht aktualisiert werden.");
      return;
    }
    void load();
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Küche</p>
          <h1>Küchendisplay</h1>
        </div>
        <p className="muted">Aktualisiert sich alle 10 Sekunden</p>
      </header>
      {msg && <p>{msg}</p>}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
        {columns.map((column) => {
          const tickets = orders
            .filter((order) => order.status === column.status)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return (
            <section key={column.status} aria-label={column.title}>
              <h2>{column.title} ({tickets.length})</h2>
              <div className="admin-list">
                {tickets.length === 0 && <p className="muted">Keine Bestellungen</p>}
                {tickets.map((order) => {
                  const waiting = minutesSince(order.createdAt, now);
                  return (
                    <article className="card" key={order.id}>
                      <div className="row">
                        <strong>Tisch {order.table.number}</strong>
                        <span className="muted" style={waiting >= 15 ? { color: "#b91c1c", fontWeight: 700 } : undefined}>
                          {waiting} Min.
                        </span>
                      </div>
                      <ul style={{ margin: "10px 0", paddingLeft: 18 }}>
                        {order.items.filter((item) => item.active).map((item) => (
                          <li key={item.id}><strong>{item.quantity} ×</strong> {item.menuItem.name}</li>
                        ))}
                      </ul>
                      {order.note && <p>Hinweis: {order.note}</p>}
                      <button className="btn" onClick={() => advance(order.id, column.next)}>{column.action}</button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
