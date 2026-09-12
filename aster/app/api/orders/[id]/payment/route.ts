import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { table: true, items: { include: { menuItem: true } } },
  });
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden" }, { status: 404 });
  return NextResponse.json(order);
}
