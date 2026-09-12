"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_FRONTPAGE_VERSION, isFrontpageVersionId } from "@/lib/frontpage-versions";

const EXCLUDED_PATHS = ["/", "/frontpage-asteros", "/frontpage-premium", "/frontpage-premium-invers"];
const THEME_CLASSES = [
  "aster-theme-classic",
  "aster-theme-creamy",
  "aster-theme-sustainable",
  "aster-theme-logo",
  "aster-theme-wholesale",
];

export default function BodyThemeClass() {
  const pathname = usePathname();
  const isFrontpage = EXCLUDED_PATHS.includes(pathname) || pathname.startsWith("/frontpage/");

  useEffect(() => {
    let active = true;

    async function applyTheme() {
      let theme = DEFAULT_FRONTPAGE_VERSION;
      try {
        const response = await fetch("/api/settings/frontpage-version", { cache: "no-store" });
        if (!response.ok) throw new Error(`Theme request failed with ${response.status}`);
        const data = (await response.json()) as { version?: string };
        if (data.version && isFrontpageVersionId(data.version)) theme = data.version;
      } catch (error) {
        console.error("Aster theme could not be loaded.", error);
      }

      if (!active) return;
      document.body.classList.remove(...THEME_CLASSES, "zema-page-theme", "zema-page-theme-premium");
      document.body.classList.add(`aster-theme-${theme}`);
    }

    void applyTheme();
    return () => {
      active = false;
      document.body.classList.remove(...THEME_CLASSES);
    };
  }, [pathname]);

  if (isFrontpage) return null;

  return <div className="page-brand-mark-corner" aria-hidden="true" />;
}
