import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { adminCookieName, makeAdminToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
const schema = z.object({
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(1),
});

function verifyPersonnelNumber(personnelNumber: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;
  const candidate = crypto.scryptSync(personnelNumber, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(storedHash, "hex"));
}

export async function POST(req: Request) {

  const { email, password } = schema.parse(await req.json());

  try {
    const staffMember = email
      ? await prisma.staffMember.findUnique({ where: { email: email.toLowerCase() } })
      : await prisma.staffMember.findUnique({ where: { personnelNumber: password } });

    if (staffMember?.active && verifyPersonnelNumber(password, staffMember.passwordHash)) {
      const r = NextResponse.json({ success: true });
      r.cookies.set(adminCookieName(), makeAdminToken({ staffId: staffMember.id, role: staffMember.role.toLowerCase() }),
        {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 12,
        }

      );
      return r;
    }
    if (!email && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      const r = NextResponse.json({ success: true });
      r.cookies.set(adminCookieName(), makeAdminToken(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
      return r;
    }
    return NextResponse.json({ error: "E-Mail-Adresse oder Personalnummer ist nicht korrekt" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
}
