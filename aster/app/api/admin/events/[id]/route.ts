import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
