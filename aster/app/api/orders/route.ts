import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAdminPushNotification } from "@/lib/push-notifications";

const orderSchema = z.object({
  tableToken: z.string().min(1),
  note: z.string().max(500).optional(),
  customer: z.object({
    name: z.string().max(80).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    address: z.string().max(250).optional(),
  }).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().min(1).max(20),
    }),
  ).min(1),
});

export async function POST(request: Request) {
  try {
    const data = orderSchema.parse(await request.json());
    const table = await prisma.restaurantTable.findUnique({
      where: { token: data.tableToken },
    });

    if (!table || !table.active) {
      return NextResponse.json({ error: "Ungültiger Tisch" }, { status: 400 });
    }

    const ids = [...new Set(data.items.map((item) => item.menuItemId))];
    const products = await prisma.menuItem.findMany({
      where: { id: { in: ids }, available: true },
    });

    if (products.length !== ids.length) {
      return NextResponse.json(
        { error: "Ein Artikel ist nicht verfügbar" },
        { status: 400 },
      );
    }

    const customerDetails = [
      data.customer?.name ? `Name: ${data.customer.name}` : null,
      data.customer?.email ? `E-Mail: ${data.customer.email}` : null,
      data.customer?.phone ? `Telefon: ${data.customer.phone}` : null,
      data.customer?.address ? `Adresse: ${data.customer.address}` : null,
    ].filter(Boolean);

    const noteText = [data.note, customerDetails.length ? customerDetails.join(" | ") : null]
      .filter((value): value is string => Boolean(value))
      .join(" | ");

    const byId = new Map(products.map((product) => [product.id, product]));
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tableId: table.id,
          note: noteText || null,
          status: "NEW",
          paymentStatus: "UNPAID",
          items: {
            create: data.items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPriceCents: byId.get(item.menuItemId)!.priceCents,
            })),
          },
        },
      });
      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { occupied: true },
      });
      return order;
    });

    sendAdminPushNotification({
      title: "Neue Bestellung",
      body: `Tisch ${table.number} hat eine neue Bestellung aufgegeben.`,
      url: "/admin/orders",
    }).catch((error: unknown) => {
      console.error("Push für neue Bestellung fehlgeschlagen.", error);
    });

    return NextResponse.json({ success: true, orderId: order.id });
  } catch {
    return NextResponse.json({ error: "Ungültige Bestellung" }, { status: 400 });
  }
}
