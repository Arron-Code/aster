import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { paypalRequest } from "@/lib/paypal";

const schema = z.object({ orderId: z.string() });

export async function POST(request: Request) {
  try {
    const { orderId } = schema.parse(await request.json());
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.paymentStatus === "PAID") {
      return NextResponse.json({ error: "Bestellung ist nicht zahlbar." }, { status: 400 });
    }
    const totalCents = order.items
      .filter((item) => item.active)
      .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    if (totalCents <= 0) {
      return NextResponse.json({ error: "Bestellung enthält keine aktiven Positionen." }, { status: 400 });
    }

    const requestOrigin = new URL(request.url).origin;
    const origin = process.env.NODE_ENV === "development" ? requestOrigin : process.env.APP_URL || requestOrigin;
    const paymentPath = request.headers.get("referer")?.includes("/pay-premium") ? "/pay-premium" : "/pay";
    const paypalOrder = await paypalRequest<{ id: string; links: { rel: string; href: string }[] }>(
      "/v2/checkout/orders",
      {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: order.id,
            custom_id: order.id,
            amount: { currency_code: "EUR", value: (totalCents / 100).toFixed(2) },
          }],
          application_context: {
            brand_name: "Zem♫",
            user_action: "PAY_NOW",
            return_url: `${origin}${paymentPath}?order=${order.id}&paypal=success`,
            cancel_url: `${origin}${paymentPath}?order=${order.id}&paypal=cancelled`,
          },
        }),
      },
    );
    await prisma.order.update({ where: { id: order.id }, data: { paypalOrderId: paypalOrder.id } });
    return NextResponse.json({
      approvalUrl: paypalOrder.links.find((link) => link.rel === "approve")?.href,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal-Zahlung konnte nicht gestartet werden." }, { status: 400 });
  }
}
