"use client";

import { formatPrice } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import type { Permission } from "@/lib/user-roles";
import type { FrontpageVersionId } from "@/lib/frontpage-versions";
import { fetchFrontendSettings } from "@/lib/frontend-tools";

type DbMenuItem = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  priceCents: number;
  category: "FOOD" | "DRINK" | "COFFEE";
};

const translations = {
  de: {
    eyebrow: "ÄTHIOPISCHE KÜCHE",
    heading: "Aster Caffe",
    subtitle: "Traditionelle Gerichte, Injera und Getränke – frisch serviert.",
    cta: "Demo: am Tisch bestellen",
    welcome: "Willkommen",
    intro: "QR-Code am Tisch scannen, Speisen und Getränke auswählen und Bestellung direkt an das Restaurant senden.",
    language: "Sprache",
    order: "Tischbestellung",
    menu: "Bestellen",
    menuOrderNow: "Jetzt Bestellen",
    menuPickup: "Abholen",
    menuDelivery: "Liefern",
    menuReserve: "Tisch Reservieren",
    navEvents: "Events",
    navReserve: "Reservieren",
    admin: "Admin",
    account: "Konto",
    login: "Anmelden",
    register: "Registrieren",
    name: "Name",
    email: "E-Mail",
    password: "Passwort",
    guest: "Gästebereich",
  },
  en: {
    eyebrow: "ETHIOPIAN CUISINE",
    heading: "Aster Caffe",
    subtitle: "Traditional dishes, injera and drinks – freshly served.",
    cta: "Demo: order at the table",
    welcome: "Welcome",
    intro: "Scan the QR code at the table, choose dishes and drinks, and send the order directly to the restaurant.",
    language: "Language",
    order: "Table ordering",
    admin: "Admin",
    menu: "Order",
    menuOrderNow: "Order now",
    menuPickup: "Pickup",
    menuDelivery: "Delivery",
    menuReserve: "Reserve a table",
    navEvents: "Events",
    navReserve: "Reserve",
    account: "Account",
    login: "Log in",
    register: "Register",
    name: "Name",
    email: "Email",
    password: "Password",
    guest: "Guest area",
  },
  zh: {
    eyebrow: "埃塞俄比亚美食",
    heading: "Aster Caffe",
    subtitle: "传统菜肴、因杰拉和饮品——新鲜上桌。",
    cta: "演示：在桌边下单",
    welcome: "欢迎",
    intro: "扫描桌上的二维码，选择菜品和饮料，并直接发送订单到餐厅。",
    language: "语言",
    order: "桌位点餐",
    admin: "管理",
    menu: "下单",
    menuOrderNow: "立即下单",
    menuPickup: "自取",
    menuDelivery: "外送",
    menuReserve: "预订餐位",
    navEvents: "活动",
    navReserve: "预订",
    account: "账户",
    login: "登录",
    register: "注册",
    name: "姓名",
    email: "电子邮件",
    password: "密码",
    guest: "访客区",
  },
  tr: {
    eyebrow: "ETİYOPYA MUTFAĞI",
    heading: "Aster Caffe",
    subtitle: "Geleneksel yemekler, injera ve içecekler – taze servis.",
    cta: "Demo: masada sipariş ver",
    welcome: "Hoş geldiniz",
    intro: "Masadaki QR kodunu tarayın, yemek ve içecek seçin ve siparişi doğrudan restorana gönderin.",
    language: "Dil",
    order: "Masa siparişi",
    admin: "Yönetici",
    menu: "Sipariş Ver",
    menuOrderNow: "Şimdi Sipariş Ver",
    menuPickup: "Gel al",
    menuDelivery: "Teslimat",
    menuReserve: "Masa Ayırt",
    navEvents: "Etkinlikler",
    navReserve: "Rezervasyon",
    account: "Hesap",
    login: "Giriş yap",
    register: "Kayıt ol",
    name: "Ad",
    email: "E-posta",
    password: "Şifre",
    guest: "Misafir alanı",
  },
  pl: {
    eyebrow: "KUCHNIA ETIOPIJSKA",
    heading: "Aster Caffe",
    subtitle: "Tradycyjne dania, injera i napoje – serwowane świeżo.",
    cta: "Demo: zamów przy stoliku",
    welcome: "Witamy",
    intro: "Zeskanuj kod QR przy stoliku, wybierz dania i napoje i wyślij zamówienie bezpośrednio do restauracji.",
    language: "Język",
    order: "Zamawianie przy stoliku",
    admin: "Admin",
    menu: "Zamów",
    menuOrderNow: "Zamów teraz",
    menuPickup: "Odbiór",
    menuDelivery: "Dostawa",
    menuReserve: "Zarezerwuj stolik",
    navEvents: "Wydarzenia",
    navReserve: "Rezerwacja",
    account: "Konto",
    login: "Zaloguj się",
    register: "Zarejestruj się",
    name: "Imię",
    email: "E-mail",
    password: "Hasło",
    guest: "Obszar gościa",
  },
  ti: {
    eyebrow: "ምግብ ኢትዮጵያ",
    heading: "Aster Caffe",
    subtitle: "ባህላዊ ምግቦች፣ ኢንጀራ እና መጠጦች – አዲስ በቀላሉ።",
    cta: "ማሳየት: በጠረጴዛ ላይ ትዕዛዝ",
    welcome: "እንኳን ደህና መጣህ",
    intro: "በጠረጴዛ ላይ ያለውን QR ኮድ ስካን ያድርጉ፣ ምግቦችን እና መጠጦችን ይምረጡ እና ትዕዛዙን ቀጥታ ወደ ሬስቶራንት ይላኩ።",
    language: "ቋንቋ",
    order: "በጠረጴዛ ላይ ትዕዛዝ",
    admin: "አስተዳደር",
    menu: "አዘዝ",
    menuOrderNow: "ሕጂ አዘዝ",
    menuPickup: "ውሰድ",
    menuDelivery: "ማድረስ",
    menuReserve: "ጠረጴዛ ሓዝ",
    navEvents: "ፍጻመታት",
    navReserve: "ምሕዛእ",
    account: "መለያ",
    login: "ግባ",
    register: "መመዝገብ",
    name: "ስም",
    email: "ኢሜይል",
    password: "የይለፍ ቃል",
    guest: "የእንግዶች ቦታ",
  },
  am: {
    eyebrow: "የኢትዮጵያ ምግብ",
    heading: "Aster Caffe",
    subtitle: "ባህላዊ ምግቦች፣ እንጀራ እና መጠጦች – በአዲስነት ይቀርባሉ።",
    cta: "ማሳያ፦ በጠረጴዛ ላይ ማዘዝ",
    welcome: "እንኳን በደህና መጡ",
    intro: "በጠረጴዛ ላይ ያለውን የQR ኮድ ይቃኙ፣ ምግብና መጠጥ ይምረጡ እና ትዕዛዙን በቀጥታ ወደ ምግብ ቤቱ ይላኩ።",
    language: "ቋንቋ",
    order: "የጠረጴዛ ትዕዛዝ",
    admin: "አስተዳዳሪ",
    menu: "እዘዝ",
    menuOrderNow: "አሁን እዘዝ",
    menuPickup: "ውሰድ",
    menuDelivery: "አድርስ",
    menuReserve: "ጠረጴዛ ያስይዙ",
    navEvents: "ዝግጅቶች",
    navReserve: "ማስያዝ",
    account: "መለያ",
    login: "ግባ",
    register: "ተመዝገብ",
    name: "ስም",
    email: "ኢሜይል",
    password: "የይለፍ ቃል",
    guest: "የእንግዶች ክፍል",
  },
} as const;

const languageOptions = {
  de: { label: "Deutsch", flag: "🇩🇪" },
  en: { label: "English", flag: "🇬🇧" },
  zh: { label: "中文", flag: "🇨🇳" },
  tr: { label: "Türkçe", flag: "🇹🇷" },
  pl: { label: "Polski", flag: "🇵🇱" },
  ti: { label: "Tigrinya", flag: "🇪🇹" },
  am: { label: "አማርኛ", flag: "🇪🇹" },
} as const;

type Language = keyof typeof translations;

const menuTabs = {
  food: {
    label: "Essen",
    items: [
      { name: "Doro Wot", description: "Würziger Hähncheneintopf mit Berbere, Ei und Injera.", price: "€16,90" },
      { name: "Misir Wot", description: "Traditionelle rote Linsen mit würzigem Geschmack und Injera.", price: "€13,50" },
      { name: "Shiro", description: "Cremige Kichererbsen-Speise mit aromatischem Gewürz.", price: "€12,90" },
      { name: "Kitfo", description: "Fein gehacktes Rindfleisch mit mitmita, Gewürzen und Injera.", price: "€18,50" },
      { name: "Tibs", description: "Gebratenes Rindfleisch mit Zwiebeln, Peper und Gewürzen.", price: "€17,40" },
      { name: "Gomen", description: "Ethiopisches Gemüse-Gericht mit Spinat und aromatischen Gewürzen.", price: "€11,80" },
    ],
  },
  drinks: {
    label: "Getränke",
    items: [
      { name: "Ethiopian Coffee", description: "Frisch gebrühter Kaffee aus Äthiopien mit sanfter Röstaromatik.", price: "€4,50" },
      { name: "Tej", description: "Traditioneller Honigwein mit leichtem fruchtigem Profil.", price: "€7,20" },
      { name: "Fresh Avocado Juice", description: "Kühlt und schmeckt cremig mit natürlicher Frische.", price: "€5,30" },
      { name: "Mango Spritz", description: "Fruchtig, leicht süß und perfekt für den Nachmittag.", price: "€5,10" },
      { name: "Lemon Mint", description: "Erfrischender Minz-Limonen-Drink mit leichter Säure.", price: "€4,80" },
      { name: "Birell / Beer", description: "Klassische Auswahl zum Essen und für entspannte Stunden.", price: "€4,90" },
    ],
  },
} as const;

const defaultFrontendSettings = {
  brand: "Aster Caffe",
  heroTitle: "Ein Tisch voller Geschichten.",
  heroSubtitle: "Äthiopische Küche, kuratierter Kaffee und herzliche Gastfreundschaft.",
  ctaLabel: "Tisch bestellen",
  headerBackgroundImage: "/PHOTO-2026-08-31-16-03-18.jpg",
  bodyBackground: "#f4f7fb",
  bodyTextColor: "#111827",
  accentColor: "#14532d",
  productTitle: "Doro Wot",
  productDescription:
    "Ein reichhaltiges Hähnchen-Gericht mit Berbere, Ei und Injera. Voller Geschmack und traditionelle Küche in einem Bowl-Format.",
  imageUrl:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  videoUrl: "",
};

const STORAGE_KEY = "aster-frontend-settings";
const LANGUAGE_KEY = "aster-frontend-language";
const AUTH_KEY = "aster-auth-user";

type HomeClientProps = {
  initialDrinkItems: DbMenuItem[];
  initialFoodItems: DbMenuItem[];
  initialIsAdminUser: boolean;
  theme?: FrontpageVersionId;
  headerFrames?: { label: string; url: string }[];
  externalNavigationLinks?: { label: string; url: string }[];
};

const adminNavigation: { permission: Permission; href: string; label: string }[] = [
  { permission: "dashboard", href: "/admin", label: "Dashboard" },
  { permission: "orders", href: "/admin/orders", label: "Bestellungen" },
  { permission: "tables", href: "/admin/tables", label: "Tische" },
  { permission: "tables", href: "/admin/reservations", label: "Reservierungen" },
  { permission: "tables", href: "/admin/events", label: "Events" },
  { permission: "menu", href: "/admin/menu", label: "Speisekarte" },
  { permission: "products", href: "/admin/products", label: "Produkte" },
  { permission: "inventory", href: "/admin/inventory", label: "Lager" },
  { permission: "recipes", href: "/admin/recipes", label: "Rezepturen" },
  { permission: "suppliers", href: "/admin/suppliers", label: "Lieferanten" },
  { permission: "purchases", href: "/admin/purchases", label: "Einkauf" },
  { permission: "frontend-tools", href: "/admin/frontend-tools", label: "FrontEndTools" },
  { permission: "personal", href: "/admin/personal", label: "Personal" },
];

export default function HomeClientPremium({
  initialDrinkItems,
  initialFoodItems,
  initialIsAdminUser,
  theme = "logo",
  headerFrames = [],
  externalNavigationLinks = [],
}: HomeClientProps) {
  const [language, setLanguage] = useState<Language>("de");
  const [drinkItems, setDrinkItems] = useState<DbMenuItem[]>(initialDrinkItems);
  const [foodItems, setFoodItems] = useState<DbMenuItem[]>(initialFoodItems);
  const [settings, setSettings] = useState(defaultFrontendSettings);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [authUser, setAuthUser] = useState<{ name: string; email: string } | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(initialIsAdminUser);
  const [staffPermissions, setStaffPermissions] = useState<Permission[]>([]);
  const [heroPopupOpen, setHeroPopupOpen] = useState(false);
  const [activeHeaderFrameUrl, setActiveHeaderFrameUrl] = useState(headerFrames[0]?.url ?? "");
  const [headerFrameControlsActive, setHeaderFrameControlsActive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("food");
  const brandMarkRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const headerFrameControlsTimerRef = useRef<number | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const categoryKeys = Object.keys(menuTabs);
    const sections = categoryKeys
      .map((key) => document.getElementById(`menu-${key}`))
      .filter(Boolean) as HTMLElement[];

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("menu-", "");
            setActiveTab(id);
          }
        });
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: 0.1,
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function loadStaffSession() {
      const response = await fetch("/api/user/session", { cache: "no-store" });
      if (!response.ok) return;

      const session = await response.json() as {
        isAdmin: boolean;
        name?: string;
        email?: string;
        permissions?: Permission[];
      };

      setIsAdminUser(session.isAdmin);
      setStaffPermissions(session.permissions ?? []);
      if (session.isAdmin && session.name && session.email) {
        setAuthUser({ name: session.name, email: session.email });
      }
    }

    void loadStaffSession();
  }, []);

  const tabIcons: Record<string, string> = {
    food: "🍲",
    drinks: "🥤",
    home: "🎵",
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = header.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width - 0.5;
      const relY = (event.clientY - rect.top) / rect.height - 0.5;
      setParallax({ x: relX, y: relY });
    };
    const handleMouseLeave = () => setParallax({ x: 0, y: 0 });

    header.addEventListener("mousemove", handleMouseMove);
    header.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      header.removeEventListener("mousemove", handleMouseMove);
      header.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);
  const themeVars = {
    ["--page-bg" as any]: settings.bodyBackground || defaultFrontendSettings.bodyBackground,
    ["--page-text" as any]: settings.bodyTextColor || defaultFrontendSettings.bodyTextColor,
    ["--page-accent" as any]: settings.accentColor || defaultFrontendSettings.accentColor,
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedSettings = window.localStorage.getItem(STORAGE_KEY);
      const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
      const storedAuthUser = window.localStorage.getItem(AUTH_KEY);

      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as Partial<typeof defaultFrontendSettings>;
        setSettings({ ...defaultFrontendSettings, ...parsed });
      }

      if (storedLanguage && storedLanguage in translations) {
        setLanguage(storedLanguage as Language);
      }

      if (storedAuthUser) {
        const parsedUser = JSON.parse(storedAuthUser) as { name?: string; email?: string };
        if (parsedUser.email) {
          setAuthUser({ name: parsedUser.name || parsedUser.email.split("@")[0], email: parsedUser.email });
        }
      }
    } catch {
      // Ignore invalid front-end config.
    }

    void fetchFrontendSettings().then((result) => {
      if (result.ok) {
        setSettings((current) => ({ ...current, ...result.settings }));
      } else {
        console.error(result.error);
      }
    });
  }, []);

  const headerFrameSignature = headerFrames.map((frame) => frame.url).join("|");

  const revealHeaderFrameControls = () => {
    setHeaderFrameControlsActive(true);
    if (headerFrameControlsTimerRef.current !== null) {
      window.clearTimeout(headerFrameControlsTimerRef.current);
    }
    headerFrameControlsTimerRef.current = window.setTimeout(() => {
      setHeaderFrameControlsActive(false);
      headerFrameControlsTimerRef.current = null;
    }, 10_000);
  };

  useEffect(() => {
    return () => {
      if (headerFrameControlsTimerRef.current !== null) {
        window.clearTimeout(headerFrameControlsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (headerFrames.length <= 1 || !activeHeaderFrameUrl) return;

    const timer = window.setTimeout(() => {
      const currentIndex = headerFrames.findIndex((frame) => frame.url === activeHeaderFrameUrl);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % headerFrames.length;
      setActiveHeaderFrameUrl(headerFrames[nextIndex]?.url ?? "");
    }, 15_000);

    return () => window.clearTimeout(timer);
  }, [activeHeaderFrameUrl, headerFrameSignature]);

  useEffect(() => {
    if (!heroPopupOpen || typeof window === "undefined") return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !(target instanceof Element)) return;
      if (!target.closest(".hero-popup") && !target.closest(".brand-mark-float")) {
        setHeroPopupOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [heroPopupOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_KEY, language);
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

  useEffect(() => {
    if (!authOpen || typeof window === "undefined") return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !(target instanceof Element)) return;
      if (!target.closest(".header-user-area")) {
        setAuthOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [authOpen]);

  useEffect(() => {
    if (!menuDropdownOpen || typeof window === "undefined") return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !(target instanceof Element)) return;
      if (!target.closest(".menu-nav-dropdown-wrap")) {
        setMenuDropdownOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuDropdownOpen]);

  const t = translations[language];

  const handleAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authMode === "register" && !authForm.name.trim()) {
      setAuthMessage("Bitte geben Sie Ihren Namen ein.");
      return;
    }

    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthMessage("Bitte füllen Sie E-Mail und Passwort aus.");
      return;
    }

    const loggedInUser = {
      name: authMode === "register" ? authForm.name.trim() : authUser?.name || authForm.email.trim().split("@")[0],
      email: authForm.email.trim(),
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(loggedInUser));
    }

    setAuthUser(loggedInUser);
    setAuthMessage(authMode === "register" ? `Registrierung erfolgreich. Willkommen, ${loggedInUser.name}!` : `Willkommen zurück, ${loggedInUser.name}!`);
    setAuthForm({ name: "", email: "", password: "" });
  };

  const handleAuthLogout = async () => {
    await fetch("/api/user/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_KEY);
    }
    setAuthUser(null);
    setIsAdminUser(false);
    setStaffPermissions([]);
    setAuthMode("login");
    setAuthMessage("");
    setAuthOpen(false);
  };

  const mainNavigation = (
    <nav className="site-nav site-nav-center" aria-label="Main navigation">
      <div className="menu-nav-dropdown-wrap">
        <button
          type="button"
          className="menu-nav-trigger"
          aria-haspopup="menu"
          aria-expanded={menuDropdownOpen}
          onClick={() => setMenuDropdownOpen((open) => !open)}
        >
          {t.menu}
          <span className="menu-nav-caret" aria-hidden="true">▾</span>
        </button>

        {menuDropdownOpen && (
          <div className="menu-nav-dropdown" role="menu" aria-label={t.menu}>
            <a role="menuitem" href="/order-premium" onClick={() => setMenuDropdownOpen(false)}>
              <span aria-hidden="true">🍽️</span> {t.menuOrderNow}
            </a>
            <a role="menuitem" href="/menu-choice-premium?mode=pickup" onClick={() => setMenuDropdownOpen(false)}>
              <span aria-hidden="true">🏠</span> {t.menuPickup}
            </a>
            <a role="menuitem" href="/menu-choice-premium?mode=delivery" onClick={() => setMenuDropdownOpen(false)}>
              <span aria-hidden="true">🚚</span> {t.menuDelivery}
            </a>
            <a role="menuitem" href="/reserve-premium" onClick={() => setMenuDropdownOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--brand-mark-icon)" }}>
                <path d="M20 3H9v10.55A4 4 0 1 0 11 17V7h7v6.55A4 4 0 1 0 20 17V3z" />
              </svg> {t.menuReserve}
            </a>
          </div>
        )}
      </div>
      <a href="/reserve-premium">{t.navReserve}</a>
      <a href="/events-premium">{t.navEvents}</a>
      {externalNavigationLinks.map((link) => (
        <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
          {link.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className={`home-page home-page-premium aster-theme-${theme}`} style={{ ...themeVars }}>
      <header className={`site-header${headerFrames.length > 0 ? " has-content-frame" : ""}`} ref={headerRef as any}>
        {theme === "wholesale" && (
          <div className="wholesale-service-bar">
            <div className="wrap wholesale-service-bar-inner">
              <span>Aster Caffe · Äthiopische Küche & Kaffee</span>
              <nav aria-label="Service-Navigation">
                <a href="https://asterscoffee.com/" target="_blank" rel="noreferrer">Asters Home</a>
                <a href="https://asterscoffee.com/ueber-aster/" target="_blank" rel="noreferrer">Über Aster</a>
                <a href="https://asterscoffee.com/hilfsprojekte/" target="_blank" rel="noreferrer">Hilfsprojekte</a>
              </nav>
            </div>
          </div>
        )}

        <div
          className={`site-header-bg-slideshow site-header-bg-parallax${activeHeaderFrameUrl ? " header-content-frame-host" : ""}`}
          aria-hidden={activeHeaderFrameUrl ? undefined : true}
          style={{
            ["--parallax-x" as any]: parallax.x,
            ["--parallax-y" as any]: parallax.y,
          }}
        >
          {activeHeaderFrameUrl ? (
            <>
              {headerFrames.length > 1 && (
                <div
                  className={`header-frame-switcher${headerFrameControlsActive ? " is-interacting" : ""}`}
                  aria-label="Eingebettete Seite auswählen"
                  onPointerEnter={revealHeaderFrameControls}
                  onPointerDown={revealHeaderFrameControls}
                  onFocus={revealHeaderFrameControls}
                >
                  {headerFrames.map((frame) => (
                    <button
                      key={frame.url}
                      type="button"
                      aria-pressed={frame.url === activeHeaderFrameUrl}
                      onClick={() => setActiveHeaderFrameUrl(frame.url)}
                    >
                      {frame.label}
                    </button>
                  ))}
                </div>
              )}
              <iframe
                key={activeHeaderFrameUrl}
                className="header-content-frame"
                src={activeHeaderFrameUrl}
                title={headerFrames.find((frame) => frame.url === activeHeaderFrameUrl)?.label ?? "Asters Coffee"}
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              />
            </>
          ) : (
            <>
              <div
                className="header-bg-slide header-bg-slide-back active"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(15,23,42,.28), rgba(15,23,42,.08) 45%, rgba(255,255,255,.85) 92%), url(${settings.headerBackgroundImage || defaultFrontendSettings.headerBackgroundImage})`,
                }}
              />
              <div className="header-bg-depth-frame" />
            </>
          )}
        </div>

        <div
          className={`brand-mark-float header-brand-top-center${headerFrames.length > 0 ? " header-frame-logo-pulse" : ""}`}
          ref={brandMarkRef}
        >
          <button
            type="button"
            className="brand-mark-logo-btn"
            aria-haspopup="dialog"
            aria-expanded={heroPopupOpen}
            aria-label={t.heading}
            title={t.heading}
            onClick={() => setHeroPopupOpen((open) => !open)}
          >
            <img
              src={theme === "wholesale" || headerFrames.length > 0 ? "/logo-whitebg_retina.png" : "/aster-logo.png"}
              alt="Aster Caffe"
              className="brand-mark-logo-img"
            />
          </button>

          {heroPopupOpen && (
            <div className="hero-popup" role="dialog" aria-label={settings.heroTitle || t.heading}>
              <button
                type="button"
                className="hero-popup-close"
                aria-label="Schließen"
                title="Schließen"
                onClick={() => setHeroPopupOpen(false)}
              >
                ✕
              </button>
              <div className="gold">{t.eyebrow}</div>
              <h1>{settings.heroTitle || t.heading}</h1>
              <p>{settings.heroSubtitle || t.subtitle}</p>
              <a
                className="hero-popup-map-link"
                href="https://www.google.de/maps/place/Zema/@50.9591447,6.9444764,3a,75y,90t/data=!3m8!1e2!3m6!1sCIABIhCL4pCzSlSwTxe1UwV6f_oQ!2e10!3e12!6shttps:%2F%2Flh3.googleusercontent.com%2Fgps-cs-s%2FAHRPTWnoNRoFZjyBxIW7AjjoVkb13crgK_01UmzUCH2x014ye6t2nDHRLo41Xu0IFuF7NYqQ0KzcsJqnqomMd_ONTAXdGVwxyW20GptN5xWQ4jwk8HqwvigQL9sIeaT3vzMS3QoMfd9Jur0sQbw%3Dw86-h114-k-no!7i3024!8i4032!4m7!3m6!1s0x47bf25fa97822a91:0x966a72726844da2a!8m2!3d50.959244!4d6.9443484!10e5!16s%2Fg%2F11mkvct_hy?entry=ttu"
                target="_blank"
                rel="noreferrer"
              >
                📍 Standort auf Google Maps
              </a>
            </div>
          )}
        </div>

        <div className="header-user-area header-user-area-bottom-right">
          <div className="language-picker-wrapper" aria-label={t.language}>
            <button
              type="button"
              className="language-picker language-picker-button"
              aria-label={t.language}
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              <span className="language-icon language-icon-small" aria-hidden="true">
                {languageOptions[language].flag}
              </span>
            </button>

            {languageMenuOpen && (
              <div className="language-menu" role="menu" aria-label={t.language}>
                {(Object.entries(languageOptions) as [Language, (typeof languageOptions)[Language]][]).map(
                  ([code, option]) => (
                    <button
                      key={code}
                      type="button"
                      className={`language-option${language === code ? " active" : ""}`}
                      onClick={() => {
                        setLanguage(code);
                        setLanguageMenuOpen(false);
                      }}
                      aria-pressed={language === code}
                    >
                      <span aria-hidden="true">{option.flag}</span>
                      <span>{option.label}</span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>


          <div className="user-button-wrap">
            <button
              type="button"
              className="user-profile-button user-profile-button-icon-only"
              aria-label={t.account}
              onClick={() => setAuthOpen((open) => !open)}
            >
              {authUser ? (
                <span className="user-profile-initial" aria-hidden="true">
                  {authUser.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 12.25a3.75 3.75 0 1 0-3.75-3.75A3.75 3.75 0 0 0 12 12.25Zm0 1.75c-3.54 0-6.75 2.01-8.22 4.82A1 1 0 0 0 4.7 20h14.6a1 1 0 0 0 .92-1.18C18.75 16.01 15.54 14 12 14Z" />
                </svg>
              )}
            </button>

            {authOpen && (
              <div className="header-auth-panel" role="dialog" aria-label={t.account}>
                <div className="auth-panel-header">
                  <div className="auth-avatar">{authUser ? authUser.name.charAt(0).toUpperCase() : "U"}</div>
                  <div>
                    <strong>{authUser ? authUser.name : t.guest}</strong>
                    <small>{authUser ? authUser.email : "Konto verwalten"}</small>
                  </div>
                </div>

                {!authUser && (
                  <label className="auth-role-select">
                    Kontotyp
                    <select
                      value="kunde"
                      onChange={(event) => {
                        if (event.target.value === "admin") {
                          window.location.href = "/admin";
                        }
                      }}
                    >
                      <option value="kunde">Kunde</option>
                      <option value="admin">Mitarbeiter</option>
                    </select>
                  </label>
                )}

                {!authUser ? (
                  <form className="auth-form" onSubmit={handleAuthSubmit}>
                    <div className="auth-toggle">
                      <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
                        {t.login}
                      </button>
                      <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>
                        {t.register}
                      </button>
                    </div>

                    {authMode === "register" && (
                      <label>
                        {t.name}
                        <input
                          type="text"
                          value={authForm.name}
                          onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                          placeholder="Max Mustermann"
                        />
                      </label>
                    )}

                    <label>
                      {t.email}
                      <input
                        type="email"
                        value={authForm.email}
                        onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                        placeholder="name@email.de"
                      />
                    </label>

                    <label>
                      {t.password}
                      <input
                        type="password"
                        value={authForm.password}
                        onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                        placeholder="••••••••"
                      />
                    </label>

                    {authMessage && <p className="auth-message">{authMessage}</p>}

                    <button type="submit" className="btn auth-submit-btn">
                      {authMode === "login" ? t.login : t.register}
                    </button>
                  </form>
                ) : (
                  <div className="auth-loggedin-box">
                    <p>Sie sind angemeldet.</p>
                    {authMessage && <small>{authMessage}</small>}
                    {isAdminUser && (
                      <a href="/admin" className="btn secondary auth-admin-link" onClick={() => setAuthOpen(false)}>
                        {t.admin}
                      </a>
                    )}
                    {isAdminUser && staffPermissions.length > 0 && (
                      <nav className="auth-loggedin-links" aria-label="Freigegebene Bereiche">
                        {adminNavigation
                          .filter((item) => staffPermissions.includes(item.permission))
                          .map((item) => (
                            <a key={item.href} href={item.href} onClick={() => setAuthOpen(false)}>
                              {item.label}
                            </a>
                          ))}
                      </nav>
                    )}
                    <button type="button" className="btn secondary auth-logout-btn" onClick={handleAuthLogout}>
                      Abmelden
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {theme === "wholesale" && (
          <div className="wrap wholesale-main-navigation">
            {mainNavigation}
          </div>
        )}
      </header>

      <main className="wrap" id="menu">
        {theme !== "wholesale" && <div className="wrap site-header-inner">{mainNavigation}</div>}

        <div className="card product-catalog-panel">
          <section className="menu-category-section" id="menu-food">
            <h2>{menuTabs.food.label}</h2>
            {foodItems.length === 0 ? (
              <p className="muted">Keine Speisen verfügbar.</p>
            ) : (
              <div className="grid menu-tab-grid">
                {foodItems.map((item) => (
                  <article key={item.id} className="card product-card product-card-premium">
                    <div className="product-card-media">
                      <img src={item.imageUrl || settings.imageUrl} alt={item.name} loading="lazy" decoding="async" />
                    </div>
                    <div className="product-card-copy">
                      <h3>{item.name}</h3>
                      <p className="muted">{item.description}</p>
                      <span className="product-price">{formatPrice(item.priceCents)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="menu-category-section" id="menu-drinks">
            <h2>{menuTabs.drinks.label}</h2>
            {drinkItems.length === 0 ? (
              <p className="muted">Keine Getränke verfügbar.</p>
            ) : (
              <div className="grid menu-tab-grid">
                {drinkItems.map((item) => (
                  <article key={item.id} className="card product-card product-card-premium">
                    <div className="product-card-media">
                      <img src={item.imageUrl || settings.imageUrl} alt={item.name} loading="lazy" decoding="async" />
                    </div>
                    <div className="product-card-copy">
                      <h3>{item.name}</h3>
                      <p className="muted">{item.description}</p>
                      <span className="product-price">{formatPrice(item.priceCents)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

        </div>

        <div className="info-block" id="order">
          <h2>{t.order}</h2>
          <p>{t.intro}</p>
        </div>

        <div className="product-feature-layout card">
          <div className="product-feature-media">
            <img src={settings.imageUrl} alt={settings.productTitle} loading="lazy" decoding="async" />
          </div>
          <div className="product-feature-content">
            <span className="eyebrow">{t.welcome}</span>
            <h3>{settings.productTitle || "Doro Wot"}</h3>
            <p>{settings.productDescription || "Traditionelles Gericht mit Berbere, Ei und Injera."}</p>
            {settings.videoUrl && (
              <video src={settings.videoUrl} controls playsInline preload="none" className="product-feature-video" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
