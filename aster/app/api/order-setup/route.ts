import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const setupSchema = z.object({
  mode: z.enum(["pickup", "delivery"]),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(5).max(40),
  address: z.string().max(250).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const data = setupSchema.parse(await request.json());

    for (let number = 90; number <= 99; number += 1) {
      const existing = await prisma.restaurantTable.findUnique({
        where: { number },
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

      if (!existing) {
        const created = await prisma.restaurantTable.create({
          data: {
            number,
            token: `pickup-${number}-${randomUUID()}`,
            active: true,
            occupied: false,
          },
        });

        return NextResponse.json({
          success: true,
          tableId: created.id,
          tableNumber: created.number,
          tableToken: created.token,
          mode: data.mode,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address || "",
        });
      }

      const hasActivity = existing.occupied || existing.orders.length > 0 || existing.reservations.length > 0;
      if (!existing.active || hasActivity) continue;

      return NextResponse.json({
        success: true,
        tableId: existing.id,
        tableNumber: existing.number,
        tableToken: existing.token,
        mode: data.mode,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address || "",
      });
    }

    return NextResponse.json({ error: "Alle Tisch-IDs 90 bis 99 sind derzeit belegt." }, { status: 409 });
  } catch (error) {
    console.error("order setup failed", error);
    return NextResponse.json({ error: "Bestellungsdaten konnten nicht verarbeitet werden." }, { status: 400 });
  }
}
