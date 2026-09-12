// Zentrale Liste der verfügbaren Frontpage-Design-Versionen. Neue Versionen
// hier eintragen, damit sie automatisch im Admin-Dropdown und beim Rendern
// der Startseite berücksichtigt werden.
export type FrontpageVersionId = "classic" | "creamy" | "sustainable" | "logo" | "wholesale";

export const DEFAULT_FRONTPAGE_VERSION: FrontpageVersionId = "logo";

export type FrontpageVersion = {
  id: FrontpageVersionId;
  version: string;
  label: string;
  description: string;
};

export const FRONTPAGE_VERSIONS: FrontpageVersion[] = [
  {
    id: "classic",
    version: "v1.0",
    label: "Aster Classic",
    description: "Warme Creme-, Gold-, Terrakotta- und Waldtöne aus dem klassischen Aster-Caffe-Design.",
  },
  {
    id: "creamy",
    version: "v2.0",
    label: "Aster Creamy",
    description: "Weiche Milch-, Aprikosen- und Espressofarben mit organischen Formen.",
  },
  {
    id: "sustainable",
    version: "v3.0",
    label: "Aster Sustainable",
    description: "Natürliches Grün, Salbei und Papierfarben mit nachhaltiger Anmutung.",
  },
  {
    id: "logo",
    version: "v4.0",
    label: "Aster Logo",
    description: "Originales Astero-Logo mit Ink-Schwarz, leuchtendem Grün und eleganter Premium-Typografie.",
  },
  {
    id: "wholesale",
    version: "v5.0",
    label: "Aster Wholesale",
    description: "Heller, zweistufiger Marken-Header mit grüner Akzentlinie und Icon-Navigation.",
  },
];

export function isFrontpageVersionId(value: string): value is FrontpageVersionId {
  return FRONTPAGE_VERSIONS.some((entry) => entry.id === value);
}

export function getFrontpageVersion(id: string): FrontpageVersion {
  return FRONTPAGE_VERSIONS.find((entry) => entry.id === id) ?? FRONTPAGE_VERSIONS[0];
}
