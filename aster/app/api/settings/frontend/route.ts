import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";
import { DEFAULT_FRONTEND_SETTINGS } from "@/lib/frontend-tools";

const KEY = "frontend_settings";
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Ungültiger Farbwert");

const settingsSchema = z.object({
  brand: z.string().trim().min(1).max(100),
  heroTitle: z.string().trim().min(1).max(200),
  heroSubtitle: z.string().trim().min(1).max(500),
  ctaLabel: z.string().trim().min(1).max(100),
  headerBackgroundImage: z.string().trim().min(1).max(2048),
  bodyBackground: colorSchema,
  bodyTextColor: colorSchema,
  accentColor: colorSchema,
});

export async function GET() {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  if (!row) {
    return NextResponse.json({ settings: DEFAULT_FRONTEND_SETTINGS });
  }

  let value: unknown;
  try {
    value = JSON.parse(row.value);
  } catch {
    return NextResponse.json({ error: "Gespeicherte Frontend-Einstellungen sind beschädigt." }, { status: 500 });
  }

  const result = settingsSchema.safeParse(value);
  if (!result.success) {
    return NextResponse.json({ error: "Gespeicherte Frontend-Einstellungen sind ungültig." }, { status: 500 });
  }

  return NextResponse.json({ settings: result.data });
}

export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 });
  }

  const result = settingsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message || "Ungültige Einstellungen." }, { status: 400 });
  }

  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(result.data) },
    update: { value: JSON.stringify(result.data) },
  });

  return NextResponse.json({ settings: result.data });
}
