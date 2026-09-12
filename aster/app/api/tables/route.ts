import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tables = await prisma.restaurantTable.findMany({
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { notIn: ["PAID", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
      reservations: {
        where: { status: { in: ["PENDING", "CONFIRMED", "SEATED"] } },
        orderBy: { reservationDate: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  const result = tables.map((table) => ({
    id: table.id,
    number: table.number,
    token: table.token,
    active: table.active,
    occupied: table.occupied || Boolean(table.orders[0]) || Boolean(table.reservations[0]),
  }));

  return NextResponse.json(result);
}
