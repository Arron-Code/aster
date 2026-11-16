import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { adminCookieName, makeAdminToken } from "@/lib/admin-auth";
import { clientIp, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { LOGIN_RETRY_AFTER_SECONDS, loginRateLimited, sameOrigin } from "@/lib/security";
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

function safeEqual(a: string, b: string) {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const base = { method: "POST", path: "/api/user/login", ip };

  if (!sameOrigin(req)) {
    await writeAudit({ ...base, action: "CSRF_BLOCKED", success: false });
    return NextResponse.json({ error: "Anfrage abgelehnt" }, { status: 403 });
  }

  let email: string | undefined;
  let password: string;
  try {
    ({ email, password } = schema.parse(await req.json()));
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const account = email ? email.toLowerCase() : null;
  if (await loginRateLimited(ip, account)) {
    return NextResponse.json(
      { error: "Zu viele fehlgeschlagene Anmeldungen. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(LOGIN_RETRY_AFTER_SECONDS) } },
    );
  }

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
      await writeAudit({ ...base, action: "LOGIN_OK", actorId: staffMember.id, actorRole: staffMember.role.toLowerCase(), actorName: staffMember.name });
      return r;
    }
    if (!email && process.env.ADMIN_PASSWORD && safeEqual(password, process.env.ADMIN_PASSWORD)) {
      const r = NextResponse.json({ success: true });
      r.cookies.set(adminCookieName(), makeAdminToken(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
      await writeAudit({ ...base, action: "LOGIN_OK", actorRole: "admin", actorName: "Admin (Passwort)" });
      return r;
    }
    await writeAudit({ ...base, action: "LOGIN_FAILED", success: false, actorName: account ?? "(ohne E-Mail)" });
    return NextResponse.json({ error: "E-Mail-Adresse oder Personalnummer ist nicht korrekt" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
}
