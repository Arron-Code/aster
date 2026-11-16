import { prisma } from "@/lib/prisma";

export type AuditEntry = {
  action: string;
  success?: boolean;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  method?: string;
  path?: string;
  ip?: string;
  detail?: string;
};

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

// Audit logging must never break the request it describes.
export async function writeAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({ data: { ...entry, detail: entry.detail?.slice(0, 500) } });
  } catch (error) {
    console.error("audit log write failed", error);
  }
}
