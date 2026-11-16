import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ROLE_SETTINGS_KEY } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const schema = z.record(z.enum(["admin", "manager", "service", "kitchen", "backoffice"]), z.array(z.string()));

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const setting = await prisma.siteSetting.findUnique({ where: { key: ROLE_SETTINGS_KEY } });
  return NextResponse.json(setting ? JSON.parse(setting.value) : null);
}

export async function PUT(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const permissions = schema.parse(await req.json());
  await prisma.siteSetting.upsert({ where: { key: ROLE_SETTINGS_KEY }, update: { value: JSON.stringify(permissions) }, create: { key: ROLE_SETTINGS_KEY, value: JSON.stringify(permissions) } });
  return NextResponse.json(permissions);
}
