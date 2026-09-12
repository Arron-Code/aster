"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_GOOGLE_RESERVATION_URL,
  DEFAULT_GOOGLE_REVIEW_URL,
  fetchGoogleReviewSettings,
  type GoogleReviewSettings,
} from "@/lib/frontend-tools";

type Item = { id: string; quantity: number; unitPriceCents: number; active: boolean; menuItem: { name: string } };
type Order = { id: string; status: string; paymentStatus: string; table: { number: number; token: string }; items: Item[] };

const statusLabels: Record<string, string> = {
  NEW: "Neu eingegangen",
  CONFIRMED: "Bestätigt",
  PREPARING: "In Zubereitung",
  SERVED: "Serviert",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
};

const paymentEligibleStatuses = ["SERVED", "PAID"];

export default function PayPage() {
  return <Suspense fallback={<main className="wrap"><p>Zahlungsübersicht wird geladen...</p></main>}><PayContent /></Suspense>;
}

function PayContent() {
  const params = useSearchParams();
  const tableToken = params.get("table");
  const orderId = params.get("order");
  const paypalStatus = params.get("paypal");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState(paypalStatus === "cancelled" ? "Die PayPal-Zahlung wurde abgebrochen." : "");
  const [loading, setLoading] = useState<string | null>(null);
  const [cashRequested, setCashRequested] = useState<Record<string, boolean>>({});
  const [googleReviewSettings, setGoogleReviewSettings] = useState<GoogleReviewSettings>({
    enabled: false,
    reviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
    reservationUrl: DEFAULT_GOOGLE_RESERVATION_URL,
  });
  const [reviewShownForOrder, setReviewShownForOrder] = useState<string | null>(null);

  async function load() {
    if (!tableToken && !orderId) return;
    const response = orderId
      ? await fetch(`/api/orders/${orderId}/payment`, { cache: "no-store" })
      : await fetch(`/api/orders/table/${encodeURIComponent(tableToken || "")}`, { cache: "no-store" });
    if (response.ok) {
      const result = await response.json();
      setOrders(Array.isArray(result) ? result : [result]);
    }
  }

  useEffect(() => { load(); }, [tableToken, orderId]);

  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [tableToken, orderId]);

  useEffect(() => {
    fetchGoogleReviewSettings().then(setGoogleReviewSettings);
  }, [tableToken, orderId]);

  const paidOrder = useMemo(
    () => orders.find((order) => order.paymentStatus === "PAID"),
    [orders],
  );

  useEffect(() => {
    if (!paidOrder || !googleReviewSettings.enabled) return;
    if (reviewShownForOrder === paidOrder.id) return;
    setReviewShownForOrder(paidOrder.id);
  }, [paidOrder, googleReviewSettings.enabled, reviewShownForOrder]);

  useEffect(() => {
    const paypalOrderId = params.get("token");
    if (paypalStatus !== "success" || !orderId || !paypalOrderId) return;
    fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, paypalOrderId }),
    }).then(async (response) => {
      if (response.ok) {
        setMessage("Zahlung erfolgreich. Der Tisch ist wieder freigegeben.");
        load();
      } else setMessage((await response.json()).error || "Zahlung konnte nicht bestätigt werden.");
    });
  }, [paypalStatus, orderId]);

  const total = useMemo(() => orders.reduce((sum, order) => sum + order.items.filter((item) => item.active)
    .reduce((orderSum, item) => orderSum + item.quantity * item.unitPriceCents, 0), 0), [orders]);

  async function pay(order: Order) {
    setLoading(order.id);
    const response = await fetch("/api/paypal/create-order", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }),
    });
    const result = await response.json();
    setLoading(null);
    if (response.ok && result.approvalUrl) window.location.href = result.approvalUrl;
    else setMessage(result.error || "PayPal-Zahlung konnte nicht gestartet werden.");
  }

  function requestCashPayment(order: Order) {
    setCashRequested((current) => ({ ...current, [order.id]: true }));
    setMessage("Ein Mitarbeiter kommt gleich an deinen Tisch, um die Zahlung an der Kasse aufzunehmen.");
  }

  const showReview = Boolean(paidOrder) && googleReviewSettings.enabled;
  const currentOrder = orders.find((order) => order.id === orderId) ?? orders[0];
  const orderTableToken = tableToken || currentOrder?.table.token;

  return (
    <>
      <header className="hero" style={{ padding: "32px 24px" }}><div className="wrap"><div className="gold">ZAHLUNGSÜBERSICHT</div><h1 style={{ fontSize: 34 }}>Aster Caffe</h1></div></header>
      <main className="wrap payment-page">
        <div className="order-title-row"><div><p className="eyebrow">Tischzahlung</p><h2>Deine Bestellung</h2></div><Link className={`order-status-badge order-status-${(currentOrder?.status || "new").toLowerCase()}`} href={orderTableToken ? `/order?table=${encodeURIComponent(orderTableToken)}` : "/"}>Weiter bestellen</Link></div>
        {message && <p className="card">{message}</p>}
        {showReview && (
          <div className="card payment-review">
            <h3>Vielen Dank für deinen Besuch</h3>
            <div className="google-rating-stars" aria-label="Google-Bewertung: 5 von 5 Sternen">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className="google-star filled">★</span>
              ))}
            </div>
            <p>Wir freuen uns über deine Bewertung. Hilf uns mit einem kurzen Google-Review, damit andere Gäste uns genauso entdecken können.</p>
            <div className="google-rating-actions">
              <a className="btn" href={googleReviewSettings.reviewUrl} target="_blank" rel="noreferrer">Google-Bewertung schreiben</a>
              <a className="btn secondary" href={googleReviewSettings.reservationUrl} target="_blank" rel="noreferrer">Reservierung</a>
            </div>
          </div>
        )}
        {orders.length === 0 ? <div className="card cart-empty"><p>Keine offenen Bestellungen gefunden.</p></div> : orders.map((order) => {
          const orderTotal = order.items.filter((item) => item.active).reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
          const canPay = order.paymentStatus !== "PAID" && paymentEligibleStatuses.includes(order.status);
          const statusLabel = statusLabels[order.status] ?? order.status;

          return (
            <article className="card payment-order" key={order.id}>
              <div className="row">
                <strong>Tisch {order.table.number}</strong>
                <strong>{formatPrice(orderTotal)} €</strong>
              </div>
              {order.items.filter((item) => item.active).map((item) => (
                <p key={item.id}>{item.quantity} x {item.menuItem.name} — {formatPrice(item.quantity * item.unitPriceCents )} €</p>
              ))}

              <div className={`order-status-badge order-status-${order.status.toLowerCase()}`}>
                {statusLabel}
              </div>

              {order.paymentStatus === "PAID" ? (
                <p className="muted">Diese Bestellung wurde bereits bezahlt. Danke für deinen Besuch!</p>
              ) : canPay ? (
                <div className="payment-options">
                  <button className="btn paypal-button" onClick={() => pay(order)} disabled={loading === order.id}>
                    {loading === order.id ? "PayPal wird geöffnet..." : "Mit PayPal bezahlen"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => requestCashPayment(order)}
                    disabled={Boolean(cashRequested[order.id])}
                  >
                    {cashRequested[order.id] ? "Mitarbeiter wurde informiert" : "An der Kasse bezahlen"}
                  </button>
                </div>
              ) : (
                <p className="muted">Sobald deine Bestellung serviert wurde, kannst du hier bezahlen.</p>
              )}
            </article>
          );
        })}
        <div className="card payment-total"><span>Gesamt zu zahlen</span><strong>{formatPrice(total)} €</strong><p className="muted">Alternativ kannst du an der Kasse bezahlen.</p></div>
      </main>
    </>
  );
}