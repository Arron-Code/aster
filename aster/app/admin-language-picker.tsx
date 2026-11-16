"use client";

import { useEffect, useState } from "react";
import { FRONTEND_LANGUAGE_KEY } from "@/lib/frontend-tools";
import {
  ADMIN_LANGUAGES,
  ADMIN_LANGUAGE_EVENT,
  isAdminLanguage,
  writeAdminLanguage,
  type AdminLanguage,
} from "@/lib/admin-language";

export default function AdminLanguagePicker() {
  const [language, setLanguage] = useState<AdminLanguage>("de");

  useEffect(() => {
    const stored = window.localStorage.getItem(FRONTEND_LANGUAGE_KEY);
    if (isAdminLanguage(stored)) setLanguage(stored);

    const onChange = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (isAdminLanguage(next)) setLanguage(next);
    };
    window.addEventListener(ADMIN_LANGUAGE_EVENT, onChange);
    return () => window.removeEventListener(ADMIN_LANGUAGE_EVENT, onChange);
  }, []);

  return (
    <div className="admin-language-picker" role="group" aria-label="Sprache">
      {ADMIN_LANGUAGES.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={`admin-language-option${language === choice.value ? " active" : ""}`}
          aria-pressed={language === choice.value}
          aria-label={choice.label}
          title={choice.label}
          onClick={() => writeAdminLanguage(FRONTEND_LANGUAGE_KEY, choice.value)}
        >
          {choice.flag}
        </button>
      ))}
    </div>
  );
}
