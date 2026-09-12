import { prisma } from "@/lib/prisma";

/**
 * Markiert eine Bestellung als bezahlt, bucht den Lagerverbrauch und gibt den Tisch frei.
 * Wird sowohl vom direkten Capture-Endpunkt als auch vom PayPal-Webhook aufgerufen.
 * Ist idempotent: bereits bezahlte Bestellungen werden nicht erneut verarbeitet.
 */
export async function markOrderPaidFromPaypal(orderId: string, paypalOrderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { menuItem: { include: { recipeItems: true } } } } },
  });

  if (!order || order.paypalOrderId !== paypalOrderId) {
    throw new Error("Zahlungsauftrag ist ungültig.");
  }

  if (order.paymentStatus === "PAID") {
    return { alreadyPaid: true as const };
  }

  await prisma.$transaction(async (tx) => {
    if (order.inventoryPostedAt) return;

    const totals = new Map<string, number>();
    for (const item of order.items.filter((entry) => entry.active)) {
      for (const recipe of item.menuItem.recipeItems) {
        totals.set(
          recipe.ingredientId,
          (totals.get(recipe.ingredientId) || 0) + Number(recipe.quantity) * item.quantity,
        );
      }
    }

    for (const [ingredientId, quantity] of totals) {
      await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: { decrement: quantity } } });
      await tx.stockMovement.create({
        data: { ingredientId, type: "CONSUMPTION", quantity: -quantity, reason: "Verbrauch durch PayPal-Zahlung", orderId },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: "PAID", paymentStatus: "PAID", paidAt: new Date(), inventoryPostedAt: new Date() },
    });
    await tx.restaurantTable.update({ where: { id: order.tableId }, data: { occupied: false } });
  });

  return { alreadyPaid: false as const };
}
