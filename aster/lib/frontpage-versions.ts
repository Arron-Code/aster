// Zentrale Liste der verfügbaren Frontpage-Design-Versionen. Neue Versionen
// hier eintragen, damit sie automatisch im Admin-Dropdown und beim Rendern
// der Startseite berücksichtigt werden.
export type FrontpageVersionId = "standard" | "asteros" | "premium" | "premium-invers";

export const DEFAULT_FRONTPAGE_VERSION: FrontpageVersionId = "premium";

export type FrontpageVersion = {
  id: FrontpageVersionId;
  version: string;
  label: string;
  description: string;
};

export const FRONTPAGE_VERSIONS: FrontpageVersion[] = [
  {
    id: "standard",
    version: "v1.0",
    label: "Standard-Design",
    description:
      "Übernommenes Basisdesign mit abgerundeten Buttons, Menü-Tabs mit Scrollspy und Kaffee-Tab.",
  },
  {
    id: "asteros",
    version: "v2.0",
    label: "Asteros-Coffee-Design",
    description:
      "Alternative Aster-Variante mit warmen Naturtönen, serifenbetonten Überschriften und Hintergrund-Slideshow.",
  },
  {
    id: "premium",
    version: "v3.0",
    label: "Aster Premium",
    description:
      "Freigegebenes Aster-Design mit Cremeflächen, dunklem Ink-Ton, frischem Grün und eleganter Serifentypografie.",
  },
  {
    id: "premium-invers",
    version: "v4.0",
    label: "Aster Premium invers",
    description:
      "Invertierte Premium-Variante mit goldenen Flächen, dunkler Typografie und runden Header-Icons.",
  },
];

export function isFrontpageVersionId(value: string): value is FrontpageVersionId {
  return FRONTPAGE_VERSIONS.some((entry) => entry.id === value);
}

export function getFrontpageVersion(id: string): FrontpageVersion {
  return FRONTPAGE_VERSIONS.find((entry) => entry.id === id) ?? FRONTPAGE_VERSIONS[0];
}
