import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";
import { DEFAULT_FRONTPAGE_VERSION, isFrontpageVersionId } from "@/lib/frontpage-versions";

const KEY = "frontpage_active_version";

const bodySchema = z.object({
  version: z.string().trim().min(1),
});

export async function GET() {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const version = row?.value && isFrontpageVersionId(row.value) ? row.value : DEFAULT_FRONTPAGE_VERSION;
  return NextResponse.json({ version });
}

export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  try {
    const { version } = bodySchema.parse(await request.json());
    if (!isFrontpageVersionId(version)) {
      return NextResponse.json({ error: "Unbekannte Version" }, { status: 400 });
    }

    await prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: version },
      update: { value: version },
    });

    return NextResponse.json({ version });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen" },
      { status: 400 },
    );
  }
}
