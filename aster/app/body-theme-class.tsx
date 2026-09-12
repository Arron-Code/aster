"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Applies the shared page theme (brand-mark-bg background + Asteros-style
// cards/buttons, or the Premium logo-driven theme) to every page except the
// frontpage variants themselves, which already ship their own bespoke
// header/background treatment.
const EXCLUDED_PATHS = ["/", "/frontpage-asteros", "/frontpage-premium", "/frontpage-premium-invers"];
const EXCLUDED_PREFIXES = ["/backoffice"];
const PREMIUM_PATHS = ["/order-premium", "/reserve-premium", "/events-premium", "/menu-choice-premium", "/pay-premium"];

export default function BodyThemeClass() {
  const pathname = usePathname();
  const isExcluded = EXCLUDED_PATHS.includes(pathname) || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    const isPremium = PREMIUM_PATHS.includes(pathname);
    document.body.classList.toggle("zema-page-theme", !isExcluded && !isPremium);
    document.body.classList.toggle("zema-page-theme-premium", !isExcluded && isPremium);
    return () => {
      document.body.classList.remove("zema-page-theme");
      document.body.classList.remove("zema-page-theme-premium");
    };
  }, [pathname, isExcluded]);

  if (isExcluded) return null;

  // Shows the brand mark texture top-left on every non-frontpage page.
  return <div className="page-brand-mark-corner" aria-hidden="true" />;
}
