import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const table = await prisma.restaurantTable.findUnique({ where: { token } });
  if (!table) return NextResponse.json({ error: "Tisch nicht gefunden" }, { status: 404 });
  const orders = await prisma.order.findMany({
    where: { tableId: table.id, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "asc" },
    include: { table: true, items: { include: { menuItem: true } } },
  });
  return NextResponse.json(orders);
}
