import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(20),
  minimumStock: z.coerce.number().min(0),
  costPerUnitCents: z.coerce.number().int().min(0),
  active: z.boolean(),
});
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { id } = await params;
    return NextResponse.json(
      await prisma.ingredient.update({
        where: { id },
        data: schema.parse(await req.json()),
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Änderung fehlgeschlagen" },
      { status: 400 },
    );
  }
}
