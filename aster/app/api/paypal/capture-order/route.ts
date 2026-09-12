import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { paypalRequest } from "@/lib/paypal";
import { markOrderPaidFromPaypal } from "@/lib/order-payment";

const schema = z.object({ orderId: z.string(), paypalOrderId: z.string() });

export async function POST(request: Request) {
  try {
    const { orderId, paypalOrderId } = schema.parse(await request.json());
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Zahlungsauftrag ist ungültig." }, { status: 400 });
    }
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ success: true });
    }
    const paypalOrder = await paypalRequest<{
      status: string;
      purchase_units: Array<{ custom_id?: string; reference_id?: string }>;
    }>(
      `/v2/checkout/orders/${paypalOrderId}`,
      { method: "GET" },
    );

    const belongsToOrder = paypalOrder.purchase_units.some(
      (unit) => unit.custom_id === orderId || unit.reference_id === orderId,
    );
    if (!belongsToOrder) {
      return NextResponse.json({ error: "Zahlungsauftrag ist ungültig." }, { status: 400 });
    }

    if (paypalOrder.status !== "COMPLETED") {
      const capture = await paypalRequest<{ status: string }>(
        `/v2/checkout/orders/${paypalOrderId}/capture`,
        { method: "POST", body: JSON.stringify({}) },
      );
      if (capture.status !== "COMPLETED") {
        return NextResponse.json({ error: "PayPal-Zahlung wurde nicht abgeschlossen." }, { status: 400 });
      }
    }

    if (order.paypalOrderId !== paypalOrderId) {
      await prisma.order.update({ where: { id: orderId }, data: { paypalOrderId } });
    }

    await markOrderPaidFromPaypal(orderId, paypalOrderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal-Zahlung konnte nicht abgeschlossen werden." }, { status: 400 });
  }
}
