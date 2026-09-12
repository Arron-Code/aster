import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const DEFAULT_GOOGLE_REVIEW_URL = "https://www.google.de/maps/place/Zema/@50.9592474,6.9417788,17z/data=!4m8!3m7!1s0x47bf25fa97822a91:0x966a72726844da2a!8m2!3d50.959244!4d6.9443484!9m1!1b1!16s%2Fg%2F11mkvct_hy?entry=ttu&g_ep=EgoyMDI2MDgyNi4wIKXMDSoASAFQAw%3D%3D";
const DEFAULT_GOOGLE_RESERVATION_URL = "https://www.google.com/search?q=Habesha+Restaurant+Reservierung";

const KEYS = {
  enabled: "google_review_enabled",
  reviewUrl: "google_review_url",
  reservationUrl: "google_reservation_url",
} as const;

const bodySchema = z.object({
  enabled: z.boolean(),
  reviewUrl: z.string().trim().min(1),
  reservationUrl: z.string().trim().min(1),
});

export async function GET() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return NextResponse.json({
    enabled: map.get(KEYS.enabled) === "true",
    reviewUrl: map.get(KEYS.reviewUrl) || DEFAULT_GOOGLE_REVIEW_URL,
    reservationUrl: map.get(KEYS.reservationUrl) || DEFAULT_GOOGLE_RESERVATION_URL,
  });
}

export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const { enabled, reviewUrl, reservationUrl } = bodySchema.parse(await request.json());

    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: KEYS.enabled },
        create: { key: KEYS.enabled, value: String(enabled) },
        update: { value: String(enabled) },
      }),
      prisma.siteSetting.upsert({
        where: { key: KEYS.reviewUrl },
        create: { key: KEYS.reviewUrl, value: reviewUrl },
        update: { value: reviewUrl },
      }),
      prisma.siteSetting.upsert({
        where: { key: KEYS.reservationUrl },
        create: { key: KEYS.reservationUrl, value: reservationUrl },
        update: { value: reservationUrl },
      }),
    ]);

    return NextResponse.json({ enabled, reviewUrl, reservationUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen" },
      { status: 400 },
    );
  }
}