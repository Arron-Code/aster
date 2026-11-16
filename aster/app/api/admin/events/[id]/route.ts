import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    await prisma.eventAttendee.deleteMany({ where: { eventId: id } });
    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("admin event delete failed", error);
    return NextResponse.json({ error: "Event konnte nicht gelöscht werden." }, { status: 400 });
  }
}
