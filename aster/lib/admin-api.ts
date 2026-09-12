import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";
export function isAdmin(req: NextRequest) {
  return validAdminToken(req.cookies.get(adminCookieName())?.value);
}
export function unauthorized() {
  return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
}
export function decimal(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Ungültige Zahl");
  return n;
}
