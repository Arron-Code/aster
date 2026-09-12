"use client";

import { formatPrice } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  active: boolean;
  menuItem: { name: string };
};

type Order = {
  id: string;
  status: string;
  createdAt: string;
  table: { number: number };
  items: Item[];
};

const statusLabels: Record<string, string> = {
  NEW: "Neu",
  CONFIRMED: "Bestätigt",
  PREPARING: "In Zubereitung",
  SERVED: "Serviert",
};

function orderTotal(order: Order) {
  return order.items
    .filter((item) => item.active)
    .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }
    if (!response.ok) {
      setMessage("Bestellungen konnten nicht geladen werden.");
      return;
    }
    const nextOrders = (await response.json()) as Order[];
    setOrders(nextOrders);
    setSelectedId((current) => current && nextOrders.some((order) => order.id === current)
      ? current
      : nextOrders[0]?.id ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) =>
      !normalized || String(order.table.number).includes(normalized),
    );
  }, [orders, query]);

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  async function pay() {
    if (!selectedOrder || selectedOrder.status !== "SERVED") return;
    setBusy(true);
    const response = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paymentMethod: "CASH" }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "Zahlung konnte nicht verbucht werden.");
      return;
    }

    setMessage("Barzahlung erfolgreich in Kasse und Buchhaltung verbucht.");
    await load();
  }

  async function printReceipt() {
    if (!selectedOrder || selectedOrder.status !== "PAID") return;
    setPrinting(true);
    const response = await fetch(`/api/admin/receipts/${selectedOrder.id}`, { method: "POST" });
    setPrinting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "Belegdaten konnten nicht erzeugt werden.");
      return;
    }
    const job = await response.json() as { payloadBase64: string };
    const download = document.createElement("a");
    download.href = `data:application/octet-stream;base64,${job.payloadBase64}`;
    download.download = `beleg-${selectedOrder.table.number}-${selectedOrder.id}.bin`;
    download.click();
    setMessage("ESC/POS-Beleg erstellt. Ein lokaler Druckdienst kann diese Datei an den Drucker senden.");
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Kasse</h1>
        </div>
        <div className="cashier-summary">
          <span>Offene Bons</span>
          <strong>{orders.length}</strong>
        </div>
      </header>

      {message && <p className="cashier-message">{message}</p>}
      <div className="cashier-layout">
        <section className="card cashier-orders">
          <div className="cashier-section-head">
            <div>
              <h2>Offene Bestellungen</h2>
              <p className="muted">Wähle einen Tisch zur Abrechnung aus.</p>
            </div>
            <input
              aria-label="Tisch suchen"
              className="cashier-search"
              placeholder="Tisch ..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="cashier-order-list">
            {filteredOrders.map((order) => (
              <button
                type="button"
                key={order.id}
                className={`cashier-order ${selectedId === order.id ? "selected" : ""}`}
                onClick={() => setSelectedId(order.id)}
              >
                <span className="cashier-table-number">Tisch {order.table.number}</span>
                <span className="cashier-order-meta">
                  {statusLabels[order.status] ?? order.status} · {order.items.filter((item) => item.active).length} Positionen
                </span>
                <strong>{formatPrice(orderTotal(order))}</strong>
              </button>
            ))}
            {filteredOrders.length === 0 && <p className="muted">Keine offenen Bestellungen gefunden.</p>}
          </div>
        </section>

        <section className="card cashier-ticket">
          {selectedOrder ? (
            <>
              <div className="cashier-ticket-head">
                <div>
                  <p className="eyebrow">Rechnung</p>
                  <h2>Tisch {selectedOrder.table.number}</h2>
                </div>
                <span className={`cashier-status ${selectedOrder.status === "SERVED" ? "ready" : ""}`}>
                  {statusLabels[selectedOrder.status] ?? selectedOrder.status}
                </span>
              </div>
              <div className="cashier-items">
                {selectedOrder.items.filter((item) => item.active).map((item) => (
                  <div className="cashier-item" key={item.id}>
                    <span>{item.quantity} x {item.menuItem.name}</span>
                    <strong>{formatPrice((item.quantity * item.unitPriceCents))}</strong>
                  </div>
                ))}
              </div>
              <div className="cashier-total">
                <span>Gesamt</span>
                <strong>{formatPrice(orderTotal(selectedOrder))}</strong>
              </div>
              <button
                type="button"
                className="btn cashier-pay-button"
                disabled={busy || selectedOrder.status !== "SERVED"}
                onClick={() => void pay()}
              >
                {busy ? "Wird verbucht ..." : selectedOrder.status === "SERVED" ? "Barzahlung verbuchen" : "Noch nicht abrechenbar"}
              </button>
              <button
                type="button"
                className="btn secondary cashier-pay-button"
                disabled={printing || selectedOrder.status !== "PAID"}
                onClick={() => void printReceipt()}
              >
                {printing ? "Beleg wird erstellt ..." : "Beleg für Druckdienst erstellen"}
              </button>
              {selectedOrder.status !== "SERVED" && (
                <p className="muted small">Die Bestellung kann abgerechnet werden, sobald sie als serviert markiert ist.</p>
              )}
            </>
          ) : (
            <p className="muted">Keine Bestellung ausgewählt.</p>
          )}
        </section>
      </div>
    </>
  );
}
