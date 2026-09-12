"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_GOOGLE_RESERVATION_URL,
  DEFAULT_GOOGLE_REVIEW_URL,
  DEFAULT_FRONTEND_SETTINGS,
  FRONTEND_LANGUAGE_KEY,
  FRONTEND_SETTINGS_KEY,
  fetchActiveFrontpageVersion,
  fetchFrontendSettings,
  fetchGoogleReviewSettings,
  saveActiveFrontpageVersion,
  saveFrontendSettings,
  saveGoogleReviewSettings,
  type GoogleReviewSettings,
} from "@/lib/frontend-tools";
import { DEFAULT_FRONTPAGE_VERSION, FRONTPAGE_VERSIONS, isFrontpageVersionId, type FrontpageVersionId } from "@/lib/frontpage-versions";

const translations = {
  de: {
    title: "FrontEndTools",
    subtitle: "Frontend-Design und Mehrsprachigkeit für die Oberfläche verwalten.",
    language: "Sprache",
    uiSettings: "Frontend-Design",
    siteBrand: "Branding",
    heroTitle: "Hero-Titel",
    heroSubtitle: "Hero-Untertitel",
    ctaLabel: "CTA-Text",
    headerBackgroundImage: "Header-Hintergrundbild",
    bodyBackground: "Body-Hintergrund",
    bodyTextColor: "Body-Textfarbe",
    accentColor: "Akzentfarbe",
    useMultiLanguage: "Elemente in mehreren Sprachen anzeigen",
    supported: "Deutsch, Englisch, Chinesisch, Türkisch, Polnisch, Tigrinya und mehr",
    preview: "Vorschau",
    availableLanguages: "Sprachen",
    adminArea: "Admin-Bereich",
  },
  en: {
    title: "FrontEndTools",
    subtitle: "Manage the front-end design and multilingual interface settings.",
    language: "Language",
    uiSettings: "Frontend design",
    siteBrand: "Branding",
    heroTitle: "Hero title",
    heroSubtitle: "Hero subtitle",
    ctaLabel: "CTA text",
    headerBackgroundImage: "Header background image",
    bodyBackground: "Body background",
    bodyTextColor: "Body text color",
    accentColor: "Accent color",
    useMultiLanguage: "Display elements in multiple languages",
    supported: "German, English, Chinese, Turkish, Polish, Tigrinya and more",
    preview: "Preview",
    availableLanguages: "Languages",
    adminArea: "Admin area",
  },
  zh: {
    title: "FrontEndTools",
    subtitle: "???????????????",
    language: "??",
    uiSettings: "????",
    siteBrand: "??",
    heroTitle: "????",
    heroSubtitle: "?????",
    ctaLabel: "????",
    headerBackgroundImage: "?????",
    bodyBackground: "?????",
    bodyTextColor: "??????",
    accentColor: "???",
    useMultiLanguage: "?????????",
    supported: "?????????????????????????",
    preview: "??",
    availableLanguages: "??",
    adminArea: "???",
  },
  tr: {
    title: "FrontEndTools",
    subtitle: "Ön yüz tasarimini ve çok dilli arayüz ayarlarini yönetin.",
    language: "Dil",
    uiSettings: "Ön yüz tasarimi",
    siteBrand: "Marka",
    heroTitle: "Hero basligi",
    heroSubtitle: "Hero alt basligi",
    ctaLabel: "CTA metni",
    headerBackgroundImage: "Üst alan arka plan görseli",
    bodyBackground: "Sayfa arka plani",
    bodyTextColor: "Gövde metin rengi",
    accentColor: "Vurgu rengi",
    useMultiLanguage: "Ögeleri birden çok dilde göster",
    supported: "Almanca, Ingilizce, Çince, Türkçe, Lehçe, Tigrinya ve daha fazlasi",
    preview: "Önizleme",
    availableLanguages: "Diller",
    adminArea: "Yönetici alani",
  },
  pl: {
    title: "FrontEndTools",
    subtitle: "Zarzadzaj projektem front-end i ustawieniami wielojezycznego interfejsu.",
    language: "Jezyk",
    uiSettings: "Projekt interfejsu",
    siteBrand: "Marka",
    heroTitle: "Tytul hero",
    heroSubtitle: "Podtytul hero",
    ctaLabel: "Tekst CTA",
    headerBackgroundImage: "Zdjecie tla naglówka",
    bodyBackground: "Tlo strony",
    bodyTextColor: "Kolor tekstu tresci",
    accentColor: "Kolor akcentu",
    useMultiLanguage: "Wyswietlaj elementy w wielu jezykach",
    supported: "Niemiecki, angielski, chinski, turecki, polski, tigrinia i wiecej",
    preview: "Podglad",
    availableLanguages: "Jezyki",
    adminArea: "Obszar administracji",
  },
  ti: {
    title: "FrontEndTools",
    subtitle: "??? ?? ??? ?? ???? ??? ????? ?????? ???????",
    language: "???",
    uiSettings: "??? ?? ???",
    siteBrand: "????",
    heroTitle: "??? ???",
    heroSubtitle: "??? ??? ???",
    ctaLabel: "CTA ???",
    headerBackgroundImage: "?????? ??? ???",
    bodyBackground: "??? ??? ???",
    bodyTextColor: "????? ??? ???",
    accentColor: "????? ???",
    useMultiLanguage: "???? ????? ????? ???",
    supported: "????? ??????? ????? ????? ???? ???? ?? ???",
    preview: "???-???",
    availableLanguages: "?????",
    adminArea: "??????? ??",
  },
} as const;

type Language = keyof typeof translations;

const languageChoices: { label: string; value: Language; flag: string }[] = [
  { label: "Deutsch", value: "de", flag: "????" },
  { label: "English", value: "en", flag: "????" },
  { label: "??", value: "zh", flag: "????" },
  { label: "Türkçe", value: "tr", flag: "????" },
  { label: "Polski", value: "pl", flag: "????" },
  { label: "Tigrinya", value: "ti", flag: "????" },
];

const defaultSettings = DEFAULT_FRONTEND_SETTINGS;

type SettingsField = keyof typeof defaultSettings;

// Vorgeschlagene Werte je Feld, die im Dropdown neben dem Eingabefeld auswählbar sind.
const fieldPresets: Record<SettingsField, { label: string; value: string }[]> = {
  brand: [
    { label: "Zem?", value: "Zem?" },
    { label: "Aster Caffe", value: "Aster Caffe" },
    { label: "Aster", value: "Aster" },
  ],
  heroTitle: [
    { label: "Authentische äthiopische Küche", value: "Authentische äthiopische Küche" },
    { label: "Willkommen bei Aster", value: "Willkommen bei Aster" },
    { label: "Genuss trifft Tradition", value: "Genuss trifft Tradition" },
  ],
  heroSubtitle: [
    { label: "Frisch zubereitet, herzlich serviert und überall einladend.", value: "Frisch zubereitet, herzlich serviert und überall einladend." },
    { label: "Ihr Tisch, Ihre Zeit  wir kümmern uns um den Rest.", value: "Ihr Tisch, Ihre Zeit  wir kümmern uns um den Rest." },
    { label: "Erleben Sie äthiopische Gastfreundschaft neu.", value: "Erleben Sie äthiopische Gastfreundschaft neu." },
  ],
  ctaLabel: [
    { label: "Tisch bestellen", value: "Tisch bestellen" },
    { label: "Jetzt reservieren", value: "Jetzt reservieren" },
    { label: "Speisekarte ansehen", value: "Speisekarte ansehen" },
    { label: "Jetzt bestellen", value: "Jetzt bestellen" },
  ],
  headerBackgroundImage: [
    { label: "Aster Markenbild", value: "/aster-logo.png" },
  ],
  bodyBackground: [
    { label: "Hellgrau (Standard)", value: "#f4f7fb" },
    { label: "Weiß", value: "#ffffff" },
    { label: "Warmes Beige", value: "#faf5eb" },
    { label: "Dunkel", value: "#0f172a" },
  ],
  bodyTextColor: [
    { label: "Dunkelgrau (Standard)", value: "#111827" },
    { label: "Schwarz", value: "#000000" },
    { label: "Weiß", value: "#ffffff" },
    { label: "Schiefergrau", value: "#334155" },
  ],
  accentColor: [
    { label: "Waldgrün (Standard)", value: "#14532d" },
    { label: "Gold", value: "#b45309" },
    { label: "Bordeaux", value: "#7f1d1d" },
    { label: "Petrol", value: "#0f766e" },
  ],
};

export default function FrontEndToolsPage() {
  const [language, setLanguage] = useState<Language>("de");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"design" | "google" | "version">("design");
  const [googleReviewSettings, setGoogleReviewSettings] = useState<GoogleReviewSettings>({
    enabled: false,
    reviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
    reservationUrl: DEFAULT_GOOGLE_RESERVATION_URL,
  });
  const [googleReviewSaving, setGoogleReviewSaving] = useState(false);
  const [googleReviewMessage, setGoogleReviewMessage] = useState("");
  const [frontpageVersion, setFrontpageVersion] = useState<FrontpageVersionId>(DEFAULT_FRONTPAGE_VERSION);
  const [frontpageVersionSaving, setFrontpageVersionSaving] = useState(false);
  const [frontpageVersionMessage, setFrontpageVersionMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedSettings = window.localStorage.getItem(FRONTEND_SETTINGS_KEY);
      const storedLanguage = window.localStorage.getItem(FRONTEND_LANGUAGE_KEY);

      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as Partial<typeof defaultSettings>;
        setSettings({ ...defaultSettings, ...parsed });
      }

      if (storedLanguage && storedLanguage in translations) {
        setLanguage(storedLanguage as Language);
      }
    } catch {
      // Ignore invalid persisted settings.
    }

    fetchGoogleReviewSettings().then(setGoogleReviewSettings);
    void fetchFrontendSettings().then((result) => {
      if (result.ok) {
        setSettings(result.settings);
      } else {
        setSettingsMessage(result.error);
      }
    });
    fetchActiveFrontpageVersion().then((version) => {
      if (isFrontpageVersionId(version)) {
        setFrontpageVersion(version);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FRONTEND_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    setSettingsMessage("");
  }, [settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FRONTEND_LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (!languageMenuOpen || typeof window === "undefined") return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !(target instanceof Element)) return;
      if (!target.closest(".language-picker-wrapper")) {
        setLanguageMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [languageMenuOpen]);

  async function saveGoogleReviewSettingsToServer() {
    setGoogleReviewSaving(true);
    setGoogleReviewMessage("");
    const result = await saveGoogleReviewSettings(googleReviewSettings);
    setGoogleReviewSaving(false);
    setGoogleReviewMessage(result.ok ? "Gespeichert." : result.error || "Speichern fehlgeschlagen.");
  }

  async function saveFrontendSettingsToServer() {
    setSettingsSaving(true);
    setSettingsMessage("");
    const result = await saveFrontendSettings(settings);
    setSettingsSaving(false);
    setSettingsMessage(result.ok ? "Gespeichert." : result.error || "Speichern fehlgeschlagen.");
  }

  async function saveFrontpageVersionToServer(version: FrontpageVersionId) {
    setFrontpageVersionSaving(true);
    setFrontpageVersionMessage("");
    const result = await saveActiveFrontpageVersion(version);
    setFrontpageVersionSaving(false);
    setFrontpageVersionMessage(result.ok ? "Gespeichert." : result.error || "Speichern fehlgeschlagen.");
  }

  const t = translations[language];
  const currentLanguageChoice = languageChoices.find((choice) => choice.value === language) ?? languageChoices[0];

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{t.title}</p>
          <h1>{t.title}</h1>
        </div>
        <div className="language-picker-wrapper" aria-label={t.language}>
          <button
            type="button"
            className="language-picker compact language-picker-button"
            aria-label={t.language}
            aria-expanded={languageMenuOpen}
            onClick={() => setLanguageMenuOpen((open) => !open)}
          >
            <span className="language-icon" aria-hidden="true">{currentLanguageChoice.flag}</span>
          </button>

          {languageMenuOpen && (
            <div className="language-menu" role="menu" aria-label={t.language}>
              {languageChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={`language-option${language === choice.value ? " active" : ""}`}
                  onClick={() => {
                    setLanguage(choice.value);
                    setLanguageMenuOpen(false);
                  }}
                  aria-pressed={language === choice.value}
                >
                  <span aria-hidden="true">{choice.flag}</span>
                  <span>{choice.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <p className="muted">{t.subtitle}</p>

      <div className="frontend-tool-tabs" role="tablist" aria-label="Untermenü Frontend-Tools">
        <button
          type="button"
          className={`frontend-tool-tab${activeTab === "design" ? " active" : ""}`}
          onClick={() => setActiveTab("design")}
        >
          Frontend-Design
        </button>
        <button
          type="button"
          className={`frontend-tool-tab${activeTab === "google" ? " active" : ""}`}
          onClick={() => setActiveTab("google")}
        >
          Google Bewertungen
        </button>
        <button
          type="button"
          className={`frontend-tool-tab${activeTab === "version" ? " active" : ""}`}
          onClick={() => setActiveTab("version")}
        >
          Frontpage-Version
        </button>
      </div>

      {activeTab === "design" ? (
        <div className="frontend-tools-layout">
          <section className="card frontend-form-card">
            <h2>{t.uiSettings}</h2>

            <div className="frontend-tools-category">
              <h3 className="frontend-tools-category-title">Branding</h3>

              <label>
                {t.siteBrand}
                <select
                  value={fieldPresets.brand.some((option) => option.value === settings.brand) ? settings.brand : ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSettings((current) => ({ ...current, brand: event.target.value }));
                  }}
                >
                  <option value="">Eigener Wert (siehe Textfeld)</option>
                  {fieldPresets.brand.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={settings.brand}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, brand: event.target.value }))
                  }
                />
              </label>

              <label>
                {t.ctaLabel}
                <select
                  value={fieldPresets.ctaLabel.some((option) => option.value === settings.ctaLabel) ? settings.ctaLabel : ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSettings((current) => ({ ...current, ctaLabel: event.target.value }));
                  }}
                >
                  <option value="">Eigener Wert (siehe Textfeld)</option>
                  {fieldPresets.ctaLabel.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={settings.ctaLabel}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, ctaLabel: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="frontend-tools-category">
              <h3 className="frontend-tools-category-title">Hero-Bereich (Startseite)</h3>

              <label>
                {t.heroTitle}
                <select
                  value={fieldPresets.heroTitle.some((option) => option.value === settings.heroTitle) ? settings.heroTitle : ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSettings((current) => ({ ...current, heroTitle: event.target.value }));
                  }}
                >
                  <option value="">Eigener Wert (siehe Textfeld)</option>
                  {fieldPresets.heroTitle.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={settings.heroTitle}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, heroTitle: event.target.value }))
                  }
                />
              </label>

              <label>
                {t.heroSubtitle}
                <select
                  value={fieldPresets.heroSubtitle.some((option) => option.value === settings.heroSubtitle) ? settings.heroSubtitle : ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSettings((current) => ({ ...current, heroSubtitle: event.target.value }));
                  }}
                >
                  <option value="">Eigener Wert (siehe Textfeld)</option>
                  {fieldPresets.heroSubtitle.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={settings.heroSubtitle}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, heroSubtitle: event.target.value }))
                  }
                />
              </label>

              <label>
                {t.headerBackgroundImage}
                <select
                  value={fieldPresets.headerBackgroundImage.some((option) => option.value === settings.headerBackgroundImage) ? settings.headerBackgroundImage : ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSettings((current) => ({ ...current, headerBackgroundImage: event.target.value }));
                  }}
                >
                  <option value="">Eigener Wert (siehe Textfeld)</option>
                  {fieldPresets.headerBackgroundImage.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={settings.headerBackgroundImage}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      headerBackgroundImage: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="frontend-tools-category">
              <h3 className="frontend-tools-category-title">Farben</h3>

              <div className="admin-colors-grid">
                <label>
                  {t.bodyBackground}
                  <select
                    value={fieldPresets.bodyBackground.some((option) => option.value === settings.bodyBackground) ? settings.bodyBackground : ""}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setSettings((current) => ({ ...current, bodyBackground: event.target.value }));
                    }}
                  >
                    <option value="">Eigener Wert (siehe Farbwähler)</option>
                    {fieldPresets.bodyBackground.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={settings.bodyBackground}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, bodyBackground: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t.bodyTextColor}
                  <select
                    value={fieldPresets.bodyTextColor.some((option) => option.value === settings.bodyTextColor) ? settings.bodyTextColor : ""}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setSettings((current) => ({ ...current, bodyTextColor: event.target.value }));
                    }}
                  >
                    <option value="">Eigener Wert (siehe Farbwähler)</option>
                    {fieldPresets.bodyTextColor.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={settings.bodyTextColor}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, bodyTextColor: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t.accentColor}
                  <select
                    value={fieldPresets.accentColor.some((option) => option.value === settings.accentColor) ? settings.accentColor : ""}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setSettings((current) => ({ ...current, accentColor: event.target.value }));
                    }}
                  >
                    <option value="">Eigener Wert (siehe Farbwähler)</option>
                    {fieldPresets.accentColor.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, accentColor: event.target.value }))
                    }
                  />
                </label>
              </div>
            </div>

            <div className="frontend-tools-category">
              <h3 className="frontend-tools-category-title">{t.availableLanguages}</h3>
              <div className="language-list">
                <span>{t.availableLanguages}</span>
                <div className="language-pills">
                  {languageChoices.map((choice) => (
                    <span key={choice.value} className="language-pill">
                      {choice.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-actions">
              <button type="button" className="btn" onClick={saveFrontendSettingsToServer} disabled={settingsSaving}>
                {settingsSaving ? "Speichern..." : "Änderungen speichern"}
              </button>
              {settingsMessage && <span className="muted">{settingsMessage}</span>}
            </div>
          </section>

          <section className="card frontend-preview-card">
            <h2>{t.preview}</h2>

            <div
              className="theme-preview-shell"
              style={{
                backgroundColor: settings.bodyBackground,
                color: settings.bodyTextColor,
              }}
            >
              <div
                className="theme-preview-header"
                style={{
                  backgroundImage: `linear-gradient(rgba(15,23,42,.65), rgba(15,23,42,.65)), url(${settings.headerBackgroundImage || "https://habesha.website/wp-content/uploads/2026/01/zema.jpg"})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <strong>{settings.brand}</strong>
                <span>{t.adminArea}</span>
              </div>

              <div className="theme-preview-hero">
                <div className="theme-preview-copy">
                  <span className="eyebrow small-eyebrow">{t.title}</span>
                  <h3>{settings.heroTitle}</h3>
                  <p>{settings.heroSubtitle}</p>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: settings.accentColor }}
                  >
                    {settings.ctaLabel}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === "google" ? (
        <section className="card frontend-form-card">
          <h2>Google Bewertungen</h2>

          <label className="toggle-row">
            <span>Google-Review-Funktion aktivieren</span>
            <input
              type="checkbox"
              checked={googleReviewSettings.enabled}
              onChange={(event) =>
                setGoogleReviewSettings((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
          </label>

          <label>
            Google-Review-Link
            <input
              type="url"
              value={googleReviewSettings.reviewUrl}
              onChange={(event) =>
                setGoogleReviewSettings((current) => ({ ...current, reviewUrl: event.target.value }))
              }
              placeholder={DEFAULT_GOOGLE_REVIEW_URL}
            />
          </label>

          <label>
            Reservierungs-Link
            <input
              type="url"
              value={googleReviewSettings.reservationUrl}
              onChange={(event) =>
                setGoogleReviewSettings((current) => ({ ...current, reservationUrl: event.target.value }))
              }
              placeholder={DEFAULT_GOOGLE_RESERVATION_URL}
            />
          </label>

          <div className="actions">
            <button type="button" className="btn" onClick={saveGoogleReviewSettingsToServer} disabled={googleReviewSaving}>
              {googleReviewSaving ? "Speichern..." : "Speichern"}
            </button>
            {googleReviewMessage && <span className="muted">{googleReviewMessage}</span>}
          </div>

          <p className="muted">
            Wenn eine Bestellung auf <strong>Bezahlt</strong> gesetzt wird, erscheint dem Gast im Zahlungsbereich automatisch eine Bewertungsaufforderung mit 5-Sterne-Bewertung und einem Button für die Reservierung. Diese Einstellung gilt serverseitig für alle Geräte.
          </p>
        </section>
      ) : (
        <section className="card frontend-form-card">
          <h2>Frontpage-Version</h2>
          <p className="muted">
            Wähle, welches Design auf der öffentlichen Startseite (/) angezeigt wird. Die Auswahl gilt serverseitig für alle Besucher.
          </p>

          <label>
            Aktive Version
            <select
              value={frontpageVersion}
              onChange={(event) => {
                const next = event.target.value as FrontpageVersionId;
                setFrontpageVersion(next);
                saveFrontpageVersionToServer(next);
              }}
            >
              {FRONTPAGE_VERSIONS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.version} — {entry.label}: {entry.description}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            {frontpageVersionSaving && <span className="muted">Speichern...</span>}
            {!frontpageVersionSaving && frontpageVersionMessage && (
              <span className="muted">{frontpageVersionMessage}</span>
            )}
          </div>

          <div className="frontpage-version-list">
            {FRONTPAGE_VERSIONS.map((entry) => (
              <div
                key={entry.id}
                className={`frontpage-version-item${entry.id === frontpageVersion ? " active" : ""}`}
              >
                <div className="frontpage-version-item-head">
                  <strong>{entry.version}</strong>
                  <span>{entry.label}</span>
                  {entry.id === frontpageVersion && <span className="frontpage-version-badge">Aktiv</span>}
                </div>
                <p className="muted">{entry.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "design" && (
        <div className="multilang-callout card">
          <h3>{t.useMultiLanguage}</h3>
          <p>{t.supported}</p>
        </div>
      )}
    </>
  );
}
