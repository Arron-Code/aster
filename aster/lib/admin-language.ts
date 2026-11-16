export const ADMIN_LANGUAGE_EVENT = "aster-admin-language-change";

export const ADMIN_LANGUAGES = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "ti", label: "Tigrinya", flag: "🇪🇹" },
] as const;

export type AdminLanguage = (typeof ADMIN_LANGUAGES)[number]["value"];

export function isAdminLanguage(value: unknown): value is AdminLanguage {
  return ADMIN_LANGUAGES.some((language) => language.value === value);
}

export function writeAdminLanguage(storageKey: string, language: AdminLanguage) {
  window.localStorage.setItem(storageKey, language);
  window.dispatchEvent(new CustomEvent<AdminLanguage>(ADMIN_LANGUAGE_EVENT, { detail: language }));
}
