import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const key = "admin-role-menu-permissions";
const schema = z.record(z.enum(["admin", "manager", "service", "kitchen", "backoffice"]), z.array(z.string()));

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  return NextResponse.json(setting ? JSON.parse(setting.value) : null);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const permissions = schema.parse(await req.json());
  await prisma.siteSetting.upsert({ where: { key }, update: { value: JSON.stringify(permissions) }, create: { key, value: JSON.stringify(permissions) } });
  return NextResponse.json(permissions);
}
