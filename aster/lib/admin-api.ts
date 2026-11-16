import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, readAdminSession } from "@/lib/admin-auth";
import { clientIp, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sameOrigin } from "@/lib/security";
import { ALL_PERMISSIONS, getRolePermissions, ROLE_DEFINITIONS, type Permission, type Role } from "@/lib/user-roles";

export const ROLE_SETTINGS_KEY = "admin-role-menu-permissions";

export type AdminActor = {
  id: string | null;
  name: string;
  role: Role;
  permissions: Permission[];
};

// A request passes when the role holds at least one listed permission. adminWrite limits changes to admins.
const ROUTE_RULES: { prefix: string; any: Permission[]; adminWrite?: boolean }[] = [
  { prefix: "/api/admin/orders", any: ["orders", "cashier"] },
  { prefix: "/api/admin/receipts", any: ["cashier"] },
  { prefix: "/api/admin/finance", any: ["cashier"] },
  { prefix: "/api/admin/ingredients", any: ["inventory"] },
  { prefix: "/api/admin/recipes", any: ["recipes"] },
  { prefix: "/api/admin/suppliers", any: ["suppliers", "products", "menu", "purchases"] },
  { prefix: "/api/admin/purchases", any: ["purchases"] },
  { prefix: "/api/admin/menu", any: ["menu", "products"] },
  { prefix: "/api/admin/tables", any: ["tables", "cashier"] },
  { prefix: "/api/admin/reservations", any: ["tables"] },
  { prefix: "/api/reservations", any: ["tables"] },
  { prefix: "/api/admin/events", any: ["tables"] },
  { prefix: "/api/admin/staff", any: ["personal"], adminWrite: true },
  { prefix: "/api/admin/role-permissions", any: ["personal"], adminWrite: true },
  { prefix: "/api/settings", any: ["frontend-tools"] },
];

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function forbidden() {
  return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
}

async function effectivePermissions(role: Role): Promise<Permission[]> {
  if (role === "admin") return ALL_PERMISSIONS;
  const setting = await prisma.siteSetting.findUnique({ where: { key: ROLE_SETTINGS_KEY } });
  if (setting) {
    try {
      const saved = JSON.parse(setting.value) as Partial<Record<Role, Permission[]>>;
      if (Array.isArray(saved[role])) return saved[role];
    } catch {
      // Fall back to the built-in role definition.
    }
  }
  return getRolePermissions(role);
}

async function resolveActor(session: NonNullable<ReturnType<typeof readAdminSession>>): Promise<AdminActor | null> {
  if (!session.staffId) {
    return { id: null, name: "Admin (Passwort)", role: "admin", permissions: ALL_PERMISSIONS };
  }
  // Role and active flag come from the database so changes apply to existing sessions.
  const staff = await prisma.staffMember.findUnique({
    where: { id: session.staffId },
    select: { id: true, name: true, role: true, active: true },
  });
  const role = staff?.role.toLowerCase() as Role | undefined;
  if (!staff?.active || !role || !(role in ROLE_DEFINITIONS)) return null;
  return { id: staff.id, name: staff.name, role, permissions: await effectivePermissions(role) };
}

export function actorCan(actor: AdminActor, permission: Permission) {
  return actor.role === "admin" || actor.permissions.includes(permission);
}

export async function authorize(req: NextRequest, options: { adminOnly?: boolean } = {}): Promise<AdminActor | NextResponse> {
  const session = readAdminSession(req.cookies.get(adminCookieName())?.value);
  if (!session) return unauthorized();

  const method = req.method.toUpperCase();
  const path = req.nextUrl.pathname;
  const mutating = !SAFE_METHODS.includes(method);
  const ip = clientIp(req);

  let actor: AdminActor | null;
  try {
    actor = await resolveActor(session);
  } catch (error) {
    console.error("admin actor lookup failed", error);
    return NextResponse.json({ error: "Anmeldung konnte nicht geprüft werden" }, { status: 503 });
  }
  if (!actor) return unauthorized();

  const audit = { actorId: actor.id, actorRole: actor.role, actorName: actor.name, method, path, ip };

  if (mutating && !sameOrigin(req)) {
    await writeAudit({ ...audit, action: "CSRF_BLOCKED", success: false });
    return forbidden();
  }

  const rule = ROUTE_RULES.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`));
  const allowed =
    (!options.adminOnly || actor.role === "admin") &&
    (!rule || !(mutating && rule.adminWrite) || actor.role === "admin") &&
    (!rule || rule.any.some((permission) => actorCan(actor, permission)));
  if (!allowed) {
    await writeAudit({ ...audit, action: "ACCESS_DENIED", success: false });
    return forbidden();
  }

  if (mutating) await writeAudit({ ...audit, action: "API_WRITE" });
  return actor;
}

export async function guard(req: NextRequest, options?: { adminOnly?: boolean }) {
  const result = await authorize(req, options);
  return result instanceof NextResponse ? result : null;
}
export function decimal(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Ungültige Zahl");
  return n;
}
