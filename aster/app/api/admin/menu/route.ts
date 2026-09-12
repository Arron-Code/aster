import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";
const item = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  priceCents: z.number().int().min(0).max(1000000),
  category: z.enum(["FOOD", "DRINK", "COFFEE"]),
  available: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  quantity: z.number().int().min(0).max(1000000).optional(),
  unit: z.enum(["Stück", "Kilogramm", "Gramm", "Liter"]),
  deliveryTimeDays: z.number().int().min(0).max(365).nullable().optional(),
  supplierId: z.string().min(1).nullable().optional(),
});
function ok(req: NextRequest) {
  return validAdminToken(req.cookies.get(adminCookieName())?.value);
}
export async function GET(req: NextRequest) {
  if (!ok(req))
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  return NextResponse.json(
    await prisma.menuItem.findMany({
      include: { supplier: true },
      orderBy: [
        { quantity: "asc" },
        { deliveryTimeDays: "asc" },
        { supplier: { name: "asc" } },
        { name: "asc" },
      ],
    }),
  );
}
export async function POST(req: NextRequest) {
  if (!ok(req))
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const payload = item.parse(await req.json());
    return NextResponse.json(
      await prisma.menuItem.create({
        data: {
          ...payload,
          sortOrder: payload.sortOrder ?? 0,
          quantity: payload.quantity ?? 0,
          deliveryTimeDays: payload.deliveryTimeDays ?? null,
          supplierId: payload.supplierId || null,
          imageUrl: payload.imageUrl?.trim() || null,
        },
      }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Ungültige Produktdaten" },
      { status: 400 },
    );
  }
}
