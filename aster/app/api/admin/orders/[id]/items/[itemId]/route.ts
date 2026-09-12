import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const itemSchema = z.object({
  quantity: z.number().int().min(1).max(20),
  active: z.boolean(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const { id, itemId } = await params;
    const data = itemSchema.parse(await request.json());
    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId: id },
    });
    if (!item) return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });

    return NextResponse.json(
      await prisma.orderItem.update({ where: { id: itemId }, data }),
    );
  } catch {
    return NextResponse.json({ error: "Position konnte nicht geändert werden" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const { id, itemId } = await params;
    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId: id },
    });
    if (!item) return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });

    await prisma.orderItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Position konnte nicht gelöscht werden" }, { status: 400 });
  }
}
