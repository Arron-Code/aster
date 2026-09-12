import crypto from "crypto";
const COOKIE = "habesha_admin";
const TTL_SECONDS = 60 * 60 * 12;
export type AdminSession = {
  exp: number;
  staffId?: string;
  role?: string;
};
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET muss mindestens 32 Zeichen lang sein.");
  return value;
}
function signature(payload: string) { return crypto.createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function adminCookieName() { return COOKIE; }
export function makeAdminToken(session: Omit<AdminSession, "exp"> = {}) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString("base64url");
  return payload + "." + signature(payload);
}
export function validAdminToken(token?: string) {
  return readAdminSession(token) !== null;
}
export function readAdminSession(token?: string): AdminSession | null {
  if (!token) return null;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000) ? data as AdminSession : null;
  } catch { return null; }
}
