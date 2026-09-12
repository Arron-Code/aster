import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const attendeeSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = attendeeSchema.parse(await request.json());
    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { attendees: true } });
    if (!event) {
      return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
    }

    if (event.attendees.length >= event.capacity) {
      return NextResponse.json({ error: "Das Event ist bereits voll." }, { status: 409 });
    }

    const attendee = await prisma.eventAttendee.create({
      data: {
        eventId,
        name: payload.name.trim(),
      },
    });

    return NextResponse.json(attendee, { status: 201 });
  } catch (error) {
    console.error("attendee creation failed", error);
    return NextResponse.json({ error: "Teilnehmer konnte nicht angemeldet werden." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = attendeeSchema.parse(await request.json());
    const { id: eventId } = await params;
    const attendee = await prisma.eventAttendee.findFirst({
      where: { eventId, name: payload.name.trim() },
    });

    if (!attendee) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }

    await prisma.eventAttendee.delete({ where: { id: attendee.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("attendee removal failed", error);
    return NextResponse.json({ error: "Teilnehmer konnte nicht entfernt werden." }, { status: 400 });
  }
}
