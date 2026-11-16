import { prisma } from "@/lib/prisma";

// Browsers always send Origin on cross-origin writes and Sec-Fetch-Site on modern engines.
export function sameOrigin(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMITS = { perIp: 10, perAccount: 5, global: 100 };

// Counts failed logins stored in the audit log, so the limit holds across serverless instances.
export async function loginRateLimited(ip: string, account: string | null) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failed = { action: "LOGIN_FAILED", createdAt: { gte: since } };
  try {
    const [byIp, byAccount, total] = await Promise.all([
      prisma.auditLog.count({ where: { ...failed, ip } }),
      account ? prisma.auditLog.count({ where: { ...failed, actorName: account } }) : 0,
      prisma.auditLog.count({ where: failed }),
    ]);
    return byIp >= LOGIN_LIMITS.perIp || byAccount >= LOGIN_LIMITS.perAccount || total >= LOGIN_LIMITS.global;
  } catch {
    return false;
  }
}

export const LOGIN_RETRY_AFTER_SECONDS = LOGIN_WINDOW_MS / 1000;

const hits = new Map<string, number[]>();

// Best-effort, per-instance limiter for public forms that must not need the database.
export function hitLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [mapKey, times] of hits) if (times.every((time) => now - time >= windowMs)) hits.delete(mapKey);
  }
  return false;
}
