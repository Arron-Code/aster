import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { id } = await params;
    const row = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
      if (!purchase) throw new Error("Einkauf nicht gefunden");
      if (purchase.status === "RECEIVED") throw new Error("Wareneingang wurde bereits gebucht");
      if (purchase.status === "CANCELLED") throw new Error("Stornierter Einkauf");

      const openItems = purchase.items.filter((item) => item.status === "ORDERED");
      for (const item of openItems) {
        if (item.menuItemId) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { quantity: { increment: Math.round(Number(item.quantity)) } },
          });
        } else if (item.ingredientId) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { stock: { increment: item.quantity }, costPerUnitCents: item.unitCostCents },
          });
          await tx.stockMovement.create({
            data: {
              ingredientId: item.ingredientId,
              type: "RECEIPT",
              quantity: item.quantity,
              reason: "Wareneingang",
              purchaseOrderId: id,
            },
          });
        } else {
          throw new Error("Bestellposition hat kein Produkt");
        }
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            status: "RECEIVED",
            receivedQuantity: item.quantity,
            receivedUnitCostCents: item.unitCostCents,
            receivedAt: new Date(),
          },
        });
      }
      return tx.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date() } });
    });
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wareneingang fehlgeschlagen" },
      { status: 400 },
    );
  }
}
