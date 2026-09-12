import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(20),
  stock: z.coerce.number(),
  minimumStock: z.coerce.number().min(0),
  costPerUnitCents: z.coerce.number().int().min(0),
  active: z.boolean().default(true),
});
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const rows = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(
    rows.map((x) => ({
      ...x,
      stock: Number(x.stock),
      minimumStock: Number(x.minimumStock),
    })),
  );
}
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const data = schema.parse(await req.json());
    const row = await prisma.$transaction(async (tx) => {
      const x = await tx.ingredient.create({ data });
      if (data.stock !== 0)
        await tx.stockMovement.create({
          data: {
            ingredientId: x.id,
            type: "ADJUSTMENT",
            quantity: data.stock,
            reason: "Anfangsbestand",
          },
        });
      return x;
    });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ungültige oder bereits vorhandene Zutat" },
      { status: 400 },
    );
  }
}
