"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/format";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  priceCents: number;
  category: "FOOD" | "DRINK" | "COFFEE";
};

type OrderListItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  active: boolean;
  menuItem: { name: string };
};

type TableOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  items: OrderListItem[];
};

const statusLabels: Record<string, string> = {
  NEW: "Neu eingegangen",
  CONFIRMED: "Bestätigt",
  PREPARING: "In Zubereitung",
  SERVED: "Serviert",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
};

export default function OrderPage() {
  return (
    <Suspense fallback={<main className="wrap"><p>Speisekarte wird geladen...</p></main>}>
      <OrderContent />
    </Suspense>
  );
}

function OrderContent() {
  const params = useSearchParams();
  const tableToken = params.get("table") || "";
  const mode = params.get("mode") || "table";
  const customerName = params.get("name") || "";
  const customerEmail = params.get("email") || "";
  const customerPhone = params.get("phone") || "";
  const customerAddress = params.get("address") || "";
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
  const [showOrderList, setShowOrderList] = useState(false);

  const submittedStorageKey = tableToken ? `zema-submitted-order-${tableToken}` : "";

  // Ohne diese Wiederherstellung geht der Bestellstatus bei jedem Reload
  // verloren und die Seite fällt auf die Speisekarte zurück.
  useEffect(() => {
    if (!submittedStorageKey) return;
    const stored = window.sessionStorage.getItem(submittedStorageKey);
    if (stored) {
      setLastOrderId(stored);
      setDone(true);
    }
  }, [submittedStorageKey]);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Menü konnte nicht geladen werden");
        return response.json() as Promise<MenuItem[]>;
      })
      .then(setMenu)
      .catch(() => setMenuError(true));
  }, []);

  useEffect(() => {
    if (!done || !tableToken) return;

    let cancelled = false;
    const loadTableOrders = () => {
      fetch(`/api/orders/table/${encodeURIComponent(tableToken)}`, { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<TableOrder[]>) : []))
        .then((result) => {
          if (cancelled) return;
          const orders = Array.isArray(result) ? result : [];
          setTableOrders(orders);
          if (submittedStorageKey && lastOrderId && !orders.some((order) => order.id === lastOrderId)) {
            window.sessionStorage.removeItem(submittedStorageKey);
          }
        })
        .catch(() => {
          if (!cancelled) setTableOrders([]);
        });
    };

    loadTableOrders();
    const interval = window.setInterval(loadTableOrders, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [done, tableToken, lastOrderId, submittedStorageKey]);

  const total = useMemo(
    () => menu.reduce((sum, item) => sum + item.priceCents * (cart[item.id] || 0), 0),
    [cart, menu],
  );
  const tableIdLabel = tableToken || "nicht zugewiesen";
  const orderModeLabel =
    mode === "pickup" ? "Abholung" : mode === "delivery" ? "Lieferung" : "Tischbestellung";
  const cartItems = useMemo(
    () => menu.filter((item) => (cart[item.id] || 0) > 0),
    [cart, menu],
  );
  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, quantity) => sum + quantity, 0),
    [cart],
  );

  function changeQuantity(id: string, difference: number) {
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] || 0) + difference),
    }));
  }

  async function submitOrder() {
    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    if (!items.length) return;
    setLoading(true);

    const customer =
      customerName || customerEmail || customerPhone || customerAddress
        ? {
            name: customerName || undefined,
            email: customerEmail || undefined,
            phone: customerPhone || undefined,
            address: customerAddress || undefined,
          }
        : undefined;

    const combinedNote = [note, customer?.address ? `Lieferadresse: ${customer.address}` : ""]
      .filter(Boolean)
      .join(" | ");

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableToken, note: combinedNote, customer, items }),
    });

    setLoading(false);
    if (response.ok) {
      const result = await response.json();
      setLastOrderId(result.orderId);
      if (submittedStorageKey) {
        window.sessionStorage.setItem(submittedStorageKey, result.orderId);
      }
      setDone(true);
      return;
    }

    const result = await response.json().catch(() => ({}));
    alert(result.error || "Bestellung konnte nicht gesendet werden.");
  }

  if (done) {
    const currentOrder = tableOrders.find((order) => order.id === lastOrderId) ?? tableOrders[tableOrders.length - 1];
    const currentStatusLabel = currentOrder ? statusLabels[currentOrder.status] ?? currentOrder.status : "Wird bearbeitet";

    return (
      <>
        <header className="hero" style={{ padding: "32px 24px" }}>
          <div className="wrap">
            <div className="order-header">
              <div>
                <div className="gold">BESTELLUNG ÜBERMITTELT</div>
                <h1 style={{ fontSize: 34 }}>Vielen Dank!</h1>
              </div>
              <div className={`order-status-badge order-status-${(currentOrder?.status || "new").toLowerCase()}`}>
                {currentStatusLabel}
              </div>
              <button
                type="button"
                className="cart-button cart-button-icon-only"
                aria-label="Bestellliste des Tisches anzeigen"
                title="Bestellliste anzeigen"
                onClick={() => setShowOrderList((current) => !current)}
              >
                <span className="cart-icon" aria-hidden="true">📋</span>
              </button>
            </div>
          </div>
        </header>
        <main className="wrap success-media-page">
          <p>Deine Bestellung wurde übermittelt.</p>
          <div className="success-actions">
            <a className="btn" href={`/pay?order=${encodeURIComponent(lastOrderId || "")}`}>Direkt mit PayPal bezahlen</a>
            <a className="btn secondary" href={tableToken ? `/pay?table=${encodeURIComponent(tableToken)}` : "/"}>Später an der Kasse bezahlen</a>
          </div>

          {showOrderList ? (
            <section className="order-list-panel">
              <h2>Bestellliste Tisch {tableToken}</h2>
              {tableOrders.length === 0 ? (
                <p className="muted">Keine Bestellungen gefunden.</p>
              ) : (
                tableOrders.map((order) => {
                  const orderStatusLabel = statusLabels[order.status] ?? order.status;
                  const orderTotal = order.items
                    .filter((item) => item.active)
                    .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
                  return (
                    <article className="card order-list-entry" key={order.id}>
                      <div className="row">
                        <div className={`order-status-badge order-status-${order.status.toLowerCase()}`}>
                          {orderStatusLabel}
                        </div>
                        <strong>{formatPrice(orderTotal)}</strong>
                      </div>
                      {order.items.filter((item) => item.active).map((item) => (
                        <p key={item.id}>
                          {item.quantity} x {item.menuItem.name} — {formatPrice(item.quantity * item.unitPriceCents)}
                        </p>
                      ))}
                    </article>
                  );
                })
              )}
            </section>
          ) : null}
        </main>
      </>
    );
  }

  return (
    <>
      <header className="hero" style={{ padding: "32px 24px" }}>
        <div className="wrap">
          <div className="order-header">
            <div>
              <div className="gold">{orderModeLabel.toUpperCase()}</div>
              <h1 style={{ fontSize: 34 }}>Aster Caffe</h1>
            </div>
            <div className="card" style={{ padding: "10px 14px", minWidth: 170 }}>
              <small className="muted">{mode === "pickup" || mode === "delivery" ? "Bestell-ID" : "Tisch-ID"}</small>
              <strong>{tableIdLabel}</strong>
            </div>
            <button
              type="button"
              className="cart-button cart-button-icon-only"
              aria-label={`Warenkorb mit ${cartCount} Artikeln öffnen`}
              onClick={() => setShowCart(true)}
            >
              <span className="cart-icon" aria-hidden="true">🛒</span>
              <b className="cart-count">{cartCount}</b>
            </button>
          </div>
        </div>
      </header>
      <main className="wrap" style={{ paddingBottom: 130 }}>
        {!showCart ? (
          <>
            <div className="order-title-row">
              <div>
                <p className="eyebrow">{orderModeLabel}</p>
                <h2>Speisekarte</h2>
              </div>
              {cartCount > 0 && (
                <button type="button" className="btn" onClick={() => setShowCart(true)}>
                  Warenkorb ansehen
                </button>
              )}
            </div>
        {!tableToken && <p>Kein Tisch wurde angegeben.</p>}
        {menuError && <p>Die Speisekarte konnte nicht geladen werden.</p>}
        <div className="grid">
          {menu.map((item) => (
            <article className="card menu-item-card menu-item-card-premium" key={item.id}>
              <div className="menu-item-image-wrap">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="menu-item-image" />
                ) : (
                  <div className="menu-item-image placeholder">Bild</div>
                )}
              </div>
              <div className="menu-item-content">
                <div className="menu-item-copy">
                  <small>{item.category === "COFFEE" ? "KAFFEE" : item.category === "DRINK" ? "GETRÄNK" : "SPEISE"}</small>
                  <h3>{item.name}</h3>
                  <p className="muted">{item.description}</p>
                  <b className="menu-item-price">{formatPrice(item.priceCents)}</b>
                </div>
                <div className="menu-item-actions">
                  <span className="menu-item-note">Auswahl</span>
                  <div className="qty">
                    {(cart[item.id] || 0) > 0 && (
                      <>
                        <button className="circle" onClick={() => changeQuantity(item.id, -1)}>−</button>
                        <b>{cart[item.id]}</b>
                      </>
                    )}
                    <button className="circle" onClick={() => changeQuantity(item.id, 1)}>+</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
          </>
        ) : (
          <section className="cart-panel" aria-label="Warenkorb">
            <div className="order-title-row order-title-row-with-total">
              <div>
                <p className="eyebrow">Bestellübersicht</p>
                <h2>Dein Warenkorb</h2>
              </div>
              <div className="cart-total-header">
                <span>Gesamtbetrag</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <button type="button" className="btn secondary" onClick={() => setShowCart(false)}>
                Zurück zum Menü
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="card cart-empty">
                <p>Dein Warenkorb ist noch leer.</p>
                <button type="button" className="btn" onClick={() => setShowCart(false)}>
                  Zurück zum Menü
                </button>
              </div>
            ) : (
              <>
                <div className="cart-list">
                  {cartItems.map((item) => {
                    const quantity = cart[item.id] || 0;
                    const itemTotal = item.priceCents * quantity;

                    return (
                      <article className="card cart-item" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <p className="muted">{formatPrice(item.priceCents)} pro Stück</p>
                        </div>
                        <div className="cart-item-actions">
                          <div className="qty">
                            <button className="circle" onClick={() => changeQuantity(item.id, -1)} aria-label={`${item.name} reduzieren`}>−</button>
                            <b>{quantity}</b>
                            <button className="circle" onClick={() => changeQuantity(item.id, 1)} aria-label={`${item.name} erhöhen`}>+</button>
                          </div>
                          <strong>{formatPrice(itemTotal)}</strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="card cart-summary">
                  <div className="row"><span>Zwischensumme</span><strong>{formatPrice(total)}</strong></div>
                                    <div className="row cart-total"><span>Gesamtkosten</span><strong>{formatPrice(total)}</strong></div>
                  <h3>Anmerkung</h3>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    placeholder="z. B. bitte weniger scharf"
                  />
                  <div className="cart-actions">
                    <button type="button" className="btn secondary" onClick={() => setShowCart(false)}>
                      Zurück zum Menü
                    </button>
                    <button className="btn" disabled={loading || !tableToken} onClick={submitOrder}>
                      {loading ? "Wird gesendet …" : "Bestellen"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}
