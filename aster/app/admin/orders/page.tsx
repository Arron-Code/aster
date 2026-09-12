"use client";

import { formatPrice } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";

const orderStatusFlow = ["NEW", "CONFIRMED", "PREPARING", "SERVED", "PAID"] as const;
const labels: Record<string, string> = {
  NEW: "Neu", CONFIRMED: "Bestätigt", PREPARING: "In Zubereitung",
  SERVED: "Serviert", PAID: "Bezahlt", CANCELLED: "Storniert",
};

const nextStatusFor = (status: string) => {
  const currentIndex = orderStatusFlow.indexOf(status as (typeof orderStatusFlow)[number]);
  if (currentIndex === -1) return null;
  return orderStatusFlow[currentIndex + 1] ?? null;
};

const statusClassMap: Record<string, string> = {
  NEW: "status-new",
  CONFIRMED: "status-confirmed",
  PREPARING: "status-preparing",
  SERVED: "status-served",
  PAID: "status-paid",
  CANCELLED: "status-cancelled",
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  active: boolean;
  menuItem: { name: string };
};
type Order = {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  table: { number: number };
  items: OrderItem[];
};

export default function Page() {
  const [rows, setRows] = useState<Order[]>([]);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);

  async function load() {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (response.status === 401) {
      location.href = "/admin";
      return;
    }
    if (!response.ok) {
      setMsg("Bestellungen konnten nicht geladen werden.");
      return;
    }
    setRows(await response.json());
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: string) {
    const response = await fetch(`/api/admin/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      setMsg("");
      load();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setMsg(data.error || "Status konnte nicht aktualisiert werden.");
  }

  async function updateItem(orderId: string, item: OrderItem, active: boolean) {
    const response = await fetch(`/api/admin/orders/${orderId}/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: editing === item.id ? editQuantity : item.quantity,
        active,
      }),
    });
    if (!response.ok) {
      setMsg((await response.json()).error);
      return;
    }
    setEditing(null);
    load();
  }

  async function deleteItem(orderId: string, itemId: string) {
    if (!confirm("Position wirklich löschen?")) return;
    const response = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
    if (response.ok) load();
    else setMsg((await response.json()).error);
  }

  const total = useMemo(
    () => rows.reduce((sum, order) => sum + order.items
      .filter((item) => item.active)
      .reduce((orderSum, item) => orderSum + item.quantity * item.unitPriceCents, 0), 0),
    [rows],
  );

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Number(a.table.number) - Number(b.table.number)),
    [rows],
  );

  return (
    <>
      <header className="admin-page-header">
        <div><p className="eyebrow">Service</p><h1>Bestellungen</h1></div>
        <div className="orders-total">Zu zahlen <strong>{formatPrice(total)}</strong></div>
      </header>
      {msg && <p>{msg}</p>}
      <div className="admin-list">
        {sortedRows.map((order) => {
          const orderTotal = order.items.filter((item) => item.active)
            .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
          const nextStatus = nextStatusFor(order.status);
          return (
            <article className="card order-card" key={order.id}>
              <div className="row order-card-header">
                <div className="table-chip-wrap">
                  <span className="table-chip">Tisch-ID {order.table.number}</span>
                  <p className="muted">{new Date(order.createdAt).toLocaleString("de-DE")}</p>
                </div>
                <div className="order-status-panel">
                  <span className={`order-status-badge ${statusClassMap[order.status] ?? "status-default"}`}>Status</span>
                  <strong className="order-status-value">{labels[order.status]}</strong>
                </div>
              </div>
              <div className="order-status-action-row">
                <div>
                  <span className="order-status-label">Aktueller Status</span>
                  <strong className={statusClassMap[order.status] ?? "status-default"}>{labels[order.status]}</strong>
                </div>
                {nextStatus ? (
                  <button
                    className="btn order-next-btn"
                    onClick={() => changeStatus(order.id, nextStatus)}
                  >
                    Weiter zu {labels[nextStatus]}
                  </button>
                ) : (
                  <span className="status-complete">Abgeschlossen</span>
                )}
              </div>
              <div className="order-items">
                {order.items.map((item) => (
                  <div className={`order-item ${item.active ? "order-item-active" : "order-item-inactive"}`} key={item.id}>
                    {editing === item.id ? (
                      <div className="order-item-edit">
                        <strong>{item.menuItem.name}</strong>
                        <input type="number" min="1" max="20" value={editQuantity} onChange={(event) => setEditQuantity(Number(event.target.value))} />
                        <button className="btn small" onClick={() => updateItem(order.id, item, true)}>Aktiv speichern</button>
                        <button className="btn secondary small order-cancel-btn" onClick={() => { setEditing(null); }}>Abbrechen</button>
                      </div>
                    ) : (
                      <>
                        <div><strong>{item.quantity} x {item.menuItem.name}</strong><small>{formatPrice(item.unitPriceCents)} je Stück</small></div>
                        <div className="actions">
                          <button className="btn secondary small order-edit-btn" onClick={() => { setEditing(item.id); setEditQuantity(item.quantity); }}>Ändern</button>
                          <button className={`item-toggle ${item.active ? "item-toggle-active" : ""}`} onClick={() => updateItem(order.id, item, !item.active)}>
                            {item.active ? "Aktiv" : "Inaktiv"}
                          </button>
                          <button className="danger small order-delete-btn" onClick={() => deleteItem(order.id, item.id)}>Löschen</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {order.note && <p>Hinweis: {order.note}</p>}
              <div className="order-card-foot">
                <strong>{formatPrice(orderTotal)}</strong>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
