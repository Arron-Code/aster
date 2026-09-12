import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const itemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  taxRatePercent: z.coerce.number().min(0).max(100).default(19),
});

const schema = z.object({
  supplierId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
  supplierConfirmation: z.string().max(1000).optional(),
  items: z.array(itemSchema).min(1),
});

type PurchaseWithItems = Prisma.PurchaseOrderGetPayload<{
  include: { supplier: true; items: { include: { ingredient: true; menuItem: true } } };
}>;

function serializePurchase(purchase: PurchaseWithItems) {
  return {
    ...purchase,
    items: purchase.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      taxRatePercent: Number(item.taxRatePercent),
      receivedQuantity: item.receivedQuantity === null ? null : Number(item.receivedQuantity),
    })),
  };
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const [purchases, suppliers, products, ingredients] = await Promise.all([
    prisma.purchaseOrder.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { supplier: true, items: { include: { ingredient: true, menuItem: true } } },
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.menuItem.findMany({
      where: { available: true },
      include: { supplier: true },
      orderBy: [
        { category: "asc" },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    }),
    prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    purchases: purchases.map(serializePurchase),
    suppliers,
    products,
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
      stock: Number(ingredient.stock),
      minimumStock: Number(ingredient.minimumStock),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  try {
    const data = schema.parse(await req.json());
    const products = await prisma.menuItem.findMany({
      where: { id: { in: data.items.map((item) => item.menuItemId) } },
      include: { supplier: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const missingProduct = data.items.find((item) => !productById.has(item.menuItemId));
    if (missingProduct) {
      return NextResponse.json({ error: "Produkt aus dem Sortiment nicht gefunden" }, { status: 400 });
    }

    const supplierIds = Array.from(new Set(products.map((product) => product.supplierId).filter((supplierId): supplierId is string => Boolean(supplierId))));
    if (supplierIds.length === 0) {
      return NextResponse.json({ error: "Die gewählten Produkte haben keinen Lieferanten im Sortiment" }, { status: 400 });
    }
    if (supplierIds.length > 1) {
      return NextResponse.json({ error: "Eine Bestellung darf nur Produkte desselben Lieferanten enthalten" }, { status: 400 });
    }
    const supplierId = supplierIds[0];
    if (!supplierId) {
      return NextResponse.json({ error: "Die gewählten Produkte haben keinen Lieferanten im Sortiment" }, { status: 400 });
    }
    if (data.supplierId && data.supplierId !== supplierId) {
      return NextResponse.json({ error: "Die Produkte gehören nicht zum ausgewählten Lieferanten" }, { status: 400 });
    }

    const purchase = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        note: data.note,
        supplierConfirmation: data.supplierConfirmation,
        status: "ORDERED",
        orderedAt: new Date(),
        items: {
          create: data.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitCostCents: productById.get(item.menuItemId)!.priceCents,
            deliveryTimeDays: productById.get(item.menuItemId)!.deliveryTimeDays,
            taxRatePercent: item.taxRatePercent,
          })),
        },
      },
      include: { supplier: true, items: { include: { ingredient: true, menuItem: true } } },
    });
    return NextResponse.json(serializePurchase(purchase), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Einkaufsbestellung ungültig" }, { status: 400 });
    }
    return NextResponse.json({ error: "Einkaufsbestellung konnte nicht gespeichert werden" }, { status: 500 });
  }
}
