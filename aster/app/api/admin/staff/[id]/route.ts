import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const staffSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  personnelNumber: z.string().trim().min(3).max(40),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "MANAGER", "SERVICE", "KITCHEN", "BACKOFFICE"]),
  department: z.string().trim().min(1).max(100),
  active: z.boolean(),
});

function passwordHash(personnelNumber: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(personnelNumber, salt, 64).toString("hex")}`;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await params;
  const payload = staffSchema.parse(await req.json());
  const existing = await prisma.staffMember.findUniqueOrThrow({ where: { id } });
  const staffMember = await prisma.staffMember.update({
    where: { id },
    data: {
      ...payload,
      email: payload.email.toLowerCase(),
      phone: payload.phone || null,
      ...(existing.personnelNumber === payload.personnelNumber ? {} : { passwordHash: passwordHash(payload.personnelNumber) }),
    },
    select: { id: true, name: true, email: true, personnelNumber: true, phone: true, role: true, department: true, active: true, createdAt: true },
  });
  return NextResponse.json(staffMember);
}
