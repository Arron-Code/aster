import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const reservations = await prisma.reservation.findMany({
    orderBy: [{ reservationDate: "asc" }, { createdAt: "desc" }],
    include: { table: true },
  });

  return NextResponse.json(reservations);
}

export async function PATCH(request: Request) {
  try {
    const schema = z.object({
      reservationId: z.string().min(1),
      status: z.enum(["PENDING", "CONFIRMED", "SEATED", "CANCELLED"]),
    });

    const payload = schema.parse(await request.json());
    const reservation = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: payload.reservationId },
        data: { status: payload.status },
        include: { table: true },
      });

      const stillUsed = await tx.reservation.findFirst({
        where: {
          tableId: updated.tableId,
          status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
          id: { not: updated.id },
        },
      });

      const activeOrder = await tx.order.findFirst({
        where: {
          tableId: updated.tableId,
          status: { notIn: ["PAID", "CANCELLED"] },
        },
      });

      await tx.restaurantTable.update({
        where: { id: updated.tableId },
        data: { occupied: payload.status !== "CANCELLED" || Boolean(activeOrder) || Boolean(stillUsed) },
      });

      return updated;
    });

    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    console.error("reservation update failed", error);
    return NextResponse.json({ error: "Reservierung konnte nicht aktualisiert werden." }, { status: 400 });
  }
}
