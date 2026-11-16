import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/admin-api";
import { buildReceiptJob } from "@/lib/receipt-printer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const denied = await guard(req);
  if (denied) return denied;

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true, items: { include: { menuItem: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: "Bestellung nicht gefunden" }, { status: 404 });
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "Beleg kann erst nach der Zahlung gedruckt werden." }, { status: 409 });
  }

  return NextResponse.json(buildReceiptJob(order));
}
