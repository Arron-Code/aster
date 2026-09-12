import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["PLANNED", "ONGOING", "COMPLETED"]),
});

const createEventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  eventDate: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().trim().min(2).max(120),
  capacity: z.coerce.number().int().min(1).max(5000).default(30),
  price: z.coerce.number().min(0).max(10000).default(0),
  description: z.string().trim().max(500).optional().or(z.literal("")),
}).refine(
  (payload) => Boolean(payload.eventDate || (payload.date && payload.time)),
  { message: "Datum und Uhrzeit sind erforderlich." },
);

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
    const payload = createEventSchema.parse(await request.json());
    const eventDate = new Date(payload.eventDate || `${payload.date}T${payload.time}:00`);

    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Ungültiges Datum oder Uhrzeit." }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title: payload.title,
        category: payload.category,
        eventDate,
        location: payload.location,
        capacity: payload.capacity,
        priceCents: Math.round(payload.price * 100),
        description: payload.description || "",
      },
      include: { attendees: true },
    });

    return NextResponse.json({
      ...event,
      price: event.priceCents / 100,
    }, { status: 201 });
  } catch (error) {
    console.error("admin event creation failed", error);
    return NextResponse.json({ error: "Event konnte nicht erstellt werden." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = statusSchema.parse(await request.json());
    const event = await prisma.event.update({
      where: { id: payload.eventId },
      data: { status: payload.status },
      include: { attendees: true },
    });

    return NextResponse.json({
      ...event,
      price: event.priceCents / 100,
    });
  } catch (error) {
    console.error("admin event status update failed", error);
    return NextResponse.json({ error: "Event-Status konnte nicht aktualisiert werden." }, { status: 400 });
  }
}
