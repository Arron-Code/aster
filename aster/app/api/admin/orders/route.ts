import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/admin-api";
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const orders = await prisma.order.findMany({
    where: {
      status: { notIn: ["PAID", "CANCELLED"] },
      paymentStatus: { not: "PAID" },
    },
    take: 100,
    orderBy: [{ table: { number: "asc" } }, { createdAt: "desc" }],
    include: { table: true, items: { include: { menuItem: true } } },
  });
  return NextResponse.json(orders);
}
