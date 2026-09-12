import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";
const schema = z.object({
  quantity: z.coerce.number().refine((x) => x !== 0),
  reason: z.string().trim().min(1).max(200),
});
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { id } = await params;
    const data = schema.parse(await req.json());
    const row = await prisma.$transaction(async (tx) => {
      const x = await tx.ingredient.update({
        where: { id },
        data: { stock: { increment: data.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          ingredientId: id,
          type: "ADJUSTMENT",
          quantity: data.quantity,
          reason: data.reason,
        },
      });
      return x;
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json(
      { error: "Bestandsänderung fehlgeschlagen" },
      { status: 400 },
    );
  }
}
