import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [orders, openOrders, lowStock, ingredients] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
      include: { items: true },
    }),
    prisma.order.count({
      where: { status: { in: ["NEW", "CONFIRMED", "PREPARING", "SERVED"] } },
    }),
    prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT COUNT(*)::bigint AS count FROM "Ingredient" WHERE active = true AND stock <= "minimumStock"`,
    prisma.ingredient.count({ where: { active: true } }),
  ]);
  const revenueCents = orders
    .filter((o) => o.status === "PAID")
    .reduce(
      (s, o) =>
        s + o.items.reduce((a, i) => a + i.quantity * i.unitPriceCents, 0),
      0,
    );
  return NextResponse.json({
    ordersToday: orders.length,
    openOrders,
    revenueCents,
    lowStock: Number(lowStock[0]?.count ?? 0),
    ingredients,
  });
}
