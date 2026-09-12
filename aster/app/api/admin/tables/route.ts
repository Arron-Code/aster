import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const tableSchema = z.object({
  number: z.number().int().min(1).max(9999),
  active: z.boolean(),
});

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  const tables = await prisma.restaurantTable.findMany({
    orderBy: { number: "asc" },
    include: {
      _count: { select: { orders: true, reservations: true } },
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
    ...table,
    latestOrderStatus: table.orders[0]?.status ?? null,
    latestReservationStatus: table.reservations[0]?.status ?? null,
    occupied: table.occupied || Boolean(table.orders[0]) || Boolean(table.reservations[0]),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const data = tableSchema.parse(await request.json());
    const table = await prisma.restaurantTable.create({
      data: { ...data, token: randomUUID() },
      include: { _count: { select: { orders: true } } },
    });
    return NextResponse.json(table, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Tischnummer ist ungültig oder bereits vergeben." },
      { status: 400 },
    );
  }
}
