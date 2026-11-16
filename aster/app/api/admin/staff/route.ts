import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, guard } from "@/lib/admin-api";
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

export async function GET(req: NextRequest) {
  const actor = await authorize(req);
  if (actor instanceof NextResponse) return actor;
  const staff = await prisma.staffMember.findMany({
    select: { id: true, name: true, email: true, personnelNumber: true, phone: true, role: true, department: true, active: true, createdAt: true },
    orderBy: { personnelNumber: "asc" },
  });
  // The personnel number doubles as a login credential, so only admins may see it.
  return NextResponse.json(actor.role === "admin" ? staff : staff.map((member) => ({ ...member, personnelNumber: "" })));
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const payload = staffSchema.parse(await req.json());
  const staffMember = await prisma.staffMember.create({
    data: { ...payload, email: payload.email.toLowerCase(), phone: payload.phone || null, passwordHash: passwordHash(payload.personnelNumber) },
    select: { id: true, name: true, email: true, personnelNumber: true, phone: true, role: true, department: true, active: true, createdAt: true },
  });
  return NextResponse.json(staffMember, { status: 201 });
}
