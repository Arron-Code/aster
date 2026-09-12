export const FRONTEND_SETTINGS_KEY = "aster-frontend-settings";
export const FRONTEND_LANGUAGE_KEY = "aster-frontend-language";
export const GOOGLE_REVIEW_ENABLED_KEY = "aster-google-review-enabled";
export const GOOGLE_REVIEW_URL_KEY = "aster-google-review-url";
export const GOOGLE_RESERVATION_URL_KEY = "aster-google-reservation-url";
export const DEFAULT_GOOGLE_REVIEW_URL = "https://www.google.de/maps/place/Zema/@50.9592474,6.9417788,17z/data=!4m8!3m7!1s0x47bf25fa97822a91:0x966a72726844da2a!8m2!3d50.959244!4d6.9443484!9m1!1b1!16s%2Fg%2F11mkvct_hy?entry=ttu&g_ep=EgoyMDI2MDgyNi4wIKXMDSoASAFQAw%3D%3D";
export const DEFAULT_GOOGLE_RESERVATION_URL = "https://www.google.com/search?q=Zema+Restaurant+Reservierung";

export type GoogleReviewSettings = {
  enabled: boolean;
  reviewUrl: string;
  reservationUrl: string;
};

const DEFAULT_GOOGLE_REVIEW_SETTINGS: GoogleReviewSettings = {
  enabled: false,
  reviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
  reservationUrl: DEFAULT_GOOGLE_RESERVATION_URL,
};

export function readBooleanSetting(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

export function writeBooleanSetting(key: string, value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage errors.
  }
}

export function readStringSetting(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;

  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStringSetting(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Reads the locally cached Google review settings (used as an immediate
 * fallback before the server response arrives, or if the request fails).
 */
export function getCachedGoogleReviewSettings(): GoogleReviewSettings {
  return {
    enabled: readBooleanSetting(GOOGLE_REVIEW_ENABLED_KEY, DEFAULT_GOOGLE_REVIEW_SETTINGS.enabled),
    reviewUrl: readStringSetting(GOOGLE_REVIEW_URL_KEY, DEFAULT_GOOGLE_REVIEW_URL) || DEFAULT_GOOGLE_REVIEW_URL,
    reservationUrl:
      readStringSetting(GOOGLE_RESERVATION_URL_KEY, DEFAULT_GOOGLE_RESERVATION_URL) ||
      DEFAULT_GOOGLE_RESERVATION_URL,
  };
}

function cacheGoogleReviewSettings(settings: GoogleReviewSettings) {
  writeBooleanSetting(GOOGLE_REVIEW_ENABLED_KEY, settings.enabled);
  writeStringSetting(GOOGLE_REVIEW_URL_KEY, settings.reviewUrl);
  writeStringSetting(GOOGLE_RESERVATION_URL_KEY, settings.reservationUrl);
}

/**
 * Fetches the Google review settings from the server (shared across all
 * devices/guests). Falls back to the locally cached copy if the request
 * fails, and updates the cache on success.
 */
export async function fetchGoogleReviewSettings(): Promise<GoogleReviewSettings> {
  try {
    const response = await fetch("/api/settings/google-review", { cache: "no-store" });
    if (!response.ok) throw new Error("request failed");
    const data = (await response.json()) as Partial<GoogleReviewSettings>;
    const settings: GoogleReviewSettings = {
      enabled: Boolean(data.enabled),
      reviewUrl: data.reviewUrl?.trim() || DEFAULT_GOOGLE_REVIEW_URL,
      reservationUrl: data.reservationUrl?.trim() || DEFAULT_GOOGLE_RESERVATION_URL,
    };
    cacheGoogleReviewSettings(settings);
    return settings;
  } catch {
    return getCachedGoogleReviewSettings();
  }
}

/**
 * Persists the Google review settings to the server (requires an
 * authenticated admin session) and updates the local cache.
 */
export async function saveGoogleReviewSettings(
  settings: GoogleReviewSettings,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/settings/google-review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || "Speichern fehlgeschlagen" };
    }
    cacheGoogleReviewSettings(settings);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

/**
 * Fetches the currently active frontpage design version from the server.
 */
export async function fetchActiveFrontpageVersion(): Promise<string> {
  try {
    const response = await fetch("/api/settings/frontpage-version", { cache: "no-store" });
    if (!response.ok) throw new Error("request failed");
    const data = (await response.json()) as { version?: string };
    return data.version || "logo";
  } catch {
    return "logo";
  }
}

/**
 * Persists the active frontpage design version (requires an authenticated
 * admin session).
 */
export async function saveActiveFrontpageVersion(
  version: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/settings/frontpage-version", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || "Speichern fehlgeschlagen" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

export function openGoogleReview(settings: GoogleReviewSettings) {
  if (typeof window === "undefined" || !settings.enabled) return false;

  const reviewUrl = settings.reviewUrl || DEFAULT_GOOGLE_REVIEW_URL;
  const popup = window.open(reviewUrl, "_blank", "noopener,noreferrer");
  if (!popup) window.location.href = reviewUrl;
  return true;
}