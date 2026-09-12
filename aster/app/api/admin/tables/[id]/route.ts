import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const tableSchema = z.object({
  number: z.number().int().min(1).max(9999),
  active: z.boolean(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const data = tableSchema.parse(await request.json());
    const { id } = await params;
    return NextResponse.json(
      await prisma.restaurantTable.update({
        where: { id },
        data,
        include: { _count: { select: { orders: true } } },
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Tisch konnte nicht geändert werden." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const { id } = await params;
    await prisma.restaurantTable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Tisch kann nicht gelöscht werden, solange Bestellungen vorhanden sind." },
      { status: 400 },
    );
  }
}
