export const ADMIN_LAYOUT_MODE_KEY = "aster-admin-layout-mode";
export const ADMIN_LAYOUT_CHANGE_EVENT = "aster-admin-layout-change";

export type AdminLayoutMode = "sidebar" | "horizontal";

export const DEFAULT_ADMIN_LAYOUT_MODE: AdminLayoutMode = "horizontal";

export function isAdminLayoutMode(value: unknown): value is AdminLayoutMode {
  return value === "sidebar" || value === "horizontal";
}

export function readAdminLayoutMode(): AdminLayoutMode {
  if (typeof window === "undefined") return DEFAULT_ADMIN_LAYOUT_MODE;
  const stored = window.localStorage.getItem(ADMIN_LAYOUT_MODE_KEY);
  return isAdminLayoutMode(stored) ? stored : DEFAULT_ADMIN_LAYOUT_MODE;
}

export function writeAdminLayoutMode(mode: AdminLayoutMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_LAYOUT_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(ADMIN_LAYOUT_CHANGE_EVENT, { detail: mode }));
}
