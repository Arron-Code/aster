import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const orderStatusFlow = ["NEW", "CONFIRMED", "PREPARING", "SERVED", "PAID"] as const;

const bodySchema = z.object({
  status: z.enum([
    "NEW",
    "CONFIRMED",
    "PREPARING",
    "SERVED",
    "PAID",
    "CANCELLED",
  ]),
  paymentMethod: z.enum(["CASH", "CARD", "PAYPAL", "OTHER"]).optional(),
});

function nextStatusFor(status: string) {
  const index = orderStatusFlow.indexOf(status as (typeof orderStatusFlow)[number]);
  if (index === -1) return null;
  return orderStatusFlow[index + 1] ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { id } = await params;
    const { status, paymentMethod = "CASH" } = bodySchema.parse(await req.json());

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { menuItem: { include: { recipeItems: true } } } },
      },
    });

    if (!order) throw new Error("Bestellung nicht gefunden");

    const expectedStatus = nextStatusFor(order.status);
    const validAdvance = expectedStatus !== null && status === expectedStatus;
    const validCancellation = status === "CANCELLED" && order.status !== "PAID" && order.status !== "CANCELLED";

    if (!validAdvance && !validCancellation) {
      throw new Error("Statusänderung nur in der gültigen Reihenfolge erlaubt.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const orderTotalCents = order.items
        .filter((item) => item.active)
        .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);

      if (status === "PAID" && !order.inventoryPostedAt) {
        const totals = new Map<string, number>();
        for (const oi of order.items.filter((item) => item.active))
          for (const ri of oi.menuItem.recipeItems)
            totals.set(
              ri.ingredientId,
              (totals.get(ri.ingredientId) || 0) +
                Number(ri.quantity) * oi.quantity,
            );
        for (const [ingredientId, quantity] of totals) {
          await tx.ingredient.update({
            where: { id: ingredientId },
            data: { stock: { decrement: quantity } },
          });
          await tx.stockMovement.create({
            data: {
              ingredientId,
              type: "CONSUMPTION",
              quantity: -quantity,
              reason: "Verbrauch durch bezahlte Bestellung",
              orderId: id,
            },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === "PAID" && !order.inventoryPostedAt
            ? { inventoryPostedAt: new Date() }
            : {}),
          ...(status === "PAID"
            ? { paymentStatus: "PAID" as const, paidAt: new Date() }
            : {}),
        },
      });

      if (status === "PAID") {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { occupied: false },
        });

        const register = await tx.cashRegister.upsert({
          where: { name: "Hauptkasse" },
          update: { active: true },
          create: { name: "Hauptkasse", location: "Restaurant" },
        });
        const session = await tx.cashSession.findFirst({
          where: { registerId: register.id, status: "OPEN" },
          orderBy: { openedAt: "desc" },
        }) ?? await tx.cashSession.create({
          data: {
            registerId: register.id,
            openingBalanceCents: 0,
          },
        });
        const cashAccount = await tx.accountingAccount.upsert({
          where: { number: paymentMethod === "CASH" ? "1000" : "1200" },
          update: { active: true },
          create: {
            number: paymentMethod === "CASH" ? "1000" : "1200",
            name: paymentMethod === "CASH" ? "Kasse" : "Bank/Kartenzahlung",
            type: "ASSET",
          },
        });
        const revenueAccount = await tx.accountingAccount.upsert({
          where: { number: "8400" },
          update: { active: true },
          create: {
            number: "8400",
            name: "Erlöse Restaurant",
            type: "REVENUE",
          },
        });
        const transaction = await tx.cashTransaction.create({
          data: {
            sessionId: session.id,
            orderId: order.id,
            type: "SALE",
            paymentMethod,
            amountCents: orderTotalCents,
            reference: `ORDER-${order.id}`,
            note: paymentMethod === "CASH" ? "Barzahlung an der Kasse" : "Zahlung an der Kasse",
          },
        });

        await tx.journalEntry.create({
          data: {
            entryNumber: `KASSE-${Date.now()}-${order.id.slice(-6)}`,
            description: `Kassenbuchung Bestellung Tisch ${order.tableId}`,
            orderId: order.id,
            sessionId: session.id,
            cashTransactionId: transaction.id,
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: cashAccount.id,
                  description: paymentMethod === "CASH" ? "Barzahlung" : "Zahlungseingang",
                  debitCents: orderTotalCents,
                },
                {
                  accountId: revenueAccount.id,
                  description: "Restaurantumsatz",
                  creditCents: orderTotalCents,
                },
              ],
            },
          },
        });
      }

      return updated;
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen",
      },
      { status: 400 },
    );
  }
}
