import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const updateSchema = z.object({
  action: z.enum(["cancel", "update", "store"]),
  quantity: z.coerce.number().positive().optional(),
  unitCostCents: z.coerce.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!isAdmin(req)) return unauthorized();

  try {
    const { id, itemId } = await params;
    const data = updateSchema.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.purchaseOrderItem.findFirst({
        where: { id: itemId, purchaseOrderId: id },
        include: { purchaseOrder: true },
      });
      if (!item) throw new Error("Bestellposition nicht gefunden");
      if (item.status !== "ORDERED") throw new Error("Diese Position ist bereits abgeschlossen");

      if (data.action === "cancel") {
        return tx.purchaseOrderItem.update({
          where: { id: itemId },
          data: { status: "CANCELLED" },
        });
      }

      if (data.action === "update") {
        if (data.quantity === undefined || data.unitCostCents === undefined) {
          throw new Error("Menge und Preis sind erforderlich");
        }
        return tx.purchaseOrderItem.update({
          where: { id: itemId },
          data: { quantity: data.quantity, unitCostCents: data.unitCostCents },
        });
      }

      const receivedQuantity = data.quantity ?? Number(item.quantity);
      const receivedUnitCostCents = data.unitCostCents ?? item.unitCostCents;
      if (item.menuItemId) {
        await tx.menuItem.update({
          where: { id: item.menuItemId },
          data: { quantity: { increment: Math.round(receivedQuantity) } },
        });
      } else if (item.ingredientId) {
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stock: { increment: receivedQuantity },
            costPerUnitCents: receivedUnitCostCents,
          },
        });
        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: "RECEIPT",
            quantity: receivedQuantity,
            reason: `Wareneingang Bestellung ${id}`,
            purchaseOrderId: id,
          },
        });
      } else {
        throw new Error("Bestellposition hat kein Produkt");
      }

      const updated = await tx.purchaseOrderItem.update({
        where: { id: itemId },
        data: {
          status: "RECEIVED",
          receivedQuantity,
          receivedUnitCostCents,
          receivedAt: new Date(),
        },
      });
      const openItems = await tx.purchaseOrderItem.count({
        where: { purchaseOrderId: id, status: "ORDERED" },
      });
      if (openItems === 0) {
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: "RECEIVED", receivedAt: new Date() },
        });
      }
      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Position konnte nicht aktualisiert werden" },
      { status: 400 },
    );
  }
}
