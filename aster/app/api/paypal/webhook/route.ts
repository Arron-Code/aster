import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaypalWebhookSignature, paypalRequest } from "@/lib/paypal";
import { markOrderPaidFromPaypal } from "@/lib/order-payment";

/**
 * PayPal-Webhook: wird von PayPal serverseitig aufgerufen, sobald sich der
 * Zahlungsstatus ändert (z. B. wenn der Nutzer den Browser nach der Zahlung
 * schließt, bevor /api/paypal/capture-order aufgerufen werden konnte).
 *
 * Konfiguration im PayPal Developer Dashboard:
 *  - Webhook-URL: https://<deine-domain>/api/paypal/webhook
 *  - Events: PAYMENT.CAPTURE.COMPLETED, CHECKOUT.ORDER.APPROVED
 *  - Die dort angezeigte Webhook-ID muss als PAYPAL_WEBHOOK_ID in .env stehen.
 */
export async function POST(request: Request) {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      return NextResponse.json({ error: "PayPal-Webhook ist nicht konfiguriert." }, { status: 500 });
    }

    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const isValid = await verifyPaypalWebhookSignature({
      webhookId,
      headers: {
        transmissionId: request.headers.get("paypal-transmission-id") || "",
        transmissionTime: request.headers.get("paypal-transmission-time") || "",
        certUrl: request.headers.get("paypal-cert-url") || "",
        authAlgo: request.headers.get("paypal-auth-algo") || "",
        transmissionSig: request.headers.get("paypal-transmission-sig") || "",
      },
      body,
    });
    if (!isValid) {
      return NextResponse.json({ error: "Ungültige Webhook-Signatur." }, { status: 400 });
    }

    const eventType = body.event_type as string;
    if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
      const resource = body.resource || {};
      // Bei CHECKOUT.ORDER.APPROVED ist resource.id die PayPal-Order-ID.
      // Bei PAYMENT.CAPTURE.COMPLETED liegt sie unter supplementary_data.related_ids.order_id.
      const paypalOrderId: string | undefined =
        resource.supplementary_data?.related_ids?.order_id || resource.id;

      if (paypalOrderId) {
        const order = await prisma.order.findUnique({ where: { paypalOrderId } });
        if (order && order.paymentStatus !== "PAID") {
          if (eventType === "CHECKOUT.ORDER.APPROVED") {
            // Bestellung wurde genehmigt, aber ggf. noch nicht eingezogen (capture) -
            // Capture nachholen, damit Geld tatsächlich transferiert wird.
            const capture = await paypalRequest<{ status: string }>(
              `/v2/checkout/orders/${paypalOrderId}/capture`,
              { method: "POST", body: JSON.stringify({}) },
            );
            if (capture.status === "COMPLETED") {
              await markOrderPaidFromPaypal(order.id, paypalOrderId);
            }
          } else {
            await markOrderPaidFromPaypal(order.id, paypalOrderId);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook-Verarbeitung fehlgeschlagen." }, { status: 400 });
  }
}
