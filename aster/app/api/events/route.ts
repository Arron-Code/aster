import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const eventSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  date: z.string().min(1),
  time: z.string().min(1),
  location: z.string().min(2).max(120),
  capacity: z.coerce.number().int().min(1).max(5000).default(30),
  price: z.coerce.number().min(0).max(10000).default(0),
  description: z.string().max(500).optional().or(z.literal("")),
});

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { eventDate: "asc" },
    include: { attendees: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(
    events.map((event) => ({
      ...event,
      price: event.priceCents / 100,
      attendees: event.attendees.map((attendee) => ({ ...attendee })),
    })),
  );
}

export async function POST(request: Request) {
  try {
    const payload = eventSchema.parse(await request.json());
    const eventDate = new Date(`${payload.date}T${payload.time}:00`);
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Ungültiges Datum oder Uhrzeit." }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title: payload.title.trim(),
        category: payload.category.trim(),
        location: payload.location.trim(),
        eventDate,
        capacity: payload.capacity,
        priceCents: Math.round(payload.price * 100),
        description: payload.description?.trim() || "",
      },
      include: { attendees: true },
    });

    return NextResponse.json({
      ...event,
      price: event.priceCents / 100,
    });
  } catch (error) {
    console.error("event creation failed", error);
    return NextResponse.json({ error: "Event konnte nicht erstellt werden." }, { status: 400 });
  }
}
