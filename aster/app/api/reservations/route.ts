import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/admin-api";
import { clientIp } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sendAdminPushNotification } from "@/lib/push-notifications";
import { hitLimit } from "@/lib/security";

const reservationSchema = z.object({
  tableId: z.string().min(1),
  guestName: z.string().min(2).max(80),
  phone: z.string().min(4).max(30),
  email: z.string().email(),
  notes: z.string().max(250).optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  guestCount: z.number().int().min(1).max(20),
});

export async function POST(request: Request) {
  if (hitLimit(`reservation:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }, { status: 429 });
  }
  try {
    const data = reservationSchema.parse(await request.json());

    const table = await prisma.restaurantTable.findUnique({
      where: { id: data.tableId },
      include: {
        orders: {
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
          take: 1,
          select: { id: true },
        },
        reservations: {
          where: { status: { in: ["PENDING", "CONFIRMED", "SEATED"] } },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!table || !table.active) {
      return NextResponse.json({ error: "Der ausgewählte Tisch ist nicht verfügbar." }, { status: 400 });
    }

    if (table.occupied || table.orders.length > 0 || table.reservations.length > 0) {
      return NextResponse.json({ error: "Der Tisch ist bereits belegt." }, { status: 409 });
    }

    const reservationDate = new Date(`${data.date}T${data.time}:00`);
    if (Number.isNaN(reservationDate.getTime())) {
      return NextResponse.json({ error: "Ungültiges Reservierungsdatum." }, { status: 400 });
    }
    if (reservationDate < new Date()) {
      return NextResponse.json({ error: "Reservierungen müssen in der Zukunft liegen." }, { status: 400 });
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          tableId: table.id,
          guestName: data.guestName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          guestCount: data.guestCount,
          reservationDate,
          reservationTime: data.time,
          notes: data.notes?.trim() || null,
          status: "PENDING",
        },
        include: { table: true },
      });

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { occupied: true },
      });

      return created;
    });

    sendAdminPushNotification({
      title: "Neue Reservierung",
      body: `${reservation.guestName} hat Tisch ${reservation.table.number} reserviert.`,
      url: "/admin/reservations",
    }).catch((error: unknown) => {
      console.error("Push für neue Reservierung fehlgeschlagen.", error);
    });

    return NextResponse.json({
      success: true,
      reservationId: reservation.id,
      tableToken: reservation.table.token,
      tableNumber: reservation.table.number,
    });
  } catch (error) {
    console.error("reservation creation failed", error);
    return NextResponse.json({ error: "Reservierung konnte nicht angelegt werden." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  const reservations = await prisma.reservation.findMany({
    orderBy: { reservationDate: "asc" },
    include: { table: true },
  });

  return NextResponse.json(reservations);
}
