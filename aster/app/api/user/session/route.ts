import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, readAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getRolePermissions, ROLE_DEFINITIONS, type Role } from "@/lib/user-roles";

export async function GET(req: NextRequest) {
  const session = readAdminSession(req.cookies.get(adminCookieName())?.value);

  if (!session) {
    return NextResponse.json({ isAdmin: false });
  }

  if (!session.staffId || !session.role) {
    return NextResponse.json({
      isAdmin: true,
      role: "admin",
      permissions: getRolePermissions("admin"),
    });
  }

  const staffMember = await prisma.staffMember.findUnique({
    where: { id: session.staffId },
    select: { name: true, email: true, active: true },
  });

  if (!staffMember?.active) {
    return NextResponse.json({ isAdmin: false });
  }

  if (!(session.role in ROLE_DEFINITIONS)) {
    return NextResponse.json({ isAdmin: false });
  }

  const role = session.role as Role;
  return NextResponse.json({
    isAdmin: true,
    name: staffMember.name,
    email: staffMember.email,
    role,
    permissions: getRolePermissions(role),
  });
}
