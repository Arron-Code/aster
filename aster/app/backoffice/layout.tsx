"use client";

import { MouseEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardPage from "./page";
import FinancePage from "../admin/finance/page";
import MenuPage from "./menu/page";
import OrdersPage from "./orders/page";
import CashierPage from "../admin/cashier/page";
import InventoryPage from "./inventory/page";
import RecipesPage from "./recipes/page";
import SuppliersPage from "./suppliers/page";
import PurchasesPage from "./purchases/page";
import ProductsPage from "./products/page";
import TableManagement from "./tables/page";
import ReservationsPage from "./reservations/page";
import FrontEndToolsPage from "./frontend-tools/page";
import PersonalPage from "./personal/page";
import EventsAdminPage from "./events/page";
import { DEFAULT_STAFF_USERS, ROLE_DEFINITIONS, type Permission, type Role, type StaffUser } from "@/lib/user-roles";

const adminMenu = [
  { key: "dashboard", href: "/backoffice", adminHref: "/admin", label: "Dashboard", description: "Übersicht", permission: "dashboard", group: "Übersicht" },
  { key: "finance", href: "/backoffice/finance", adminHref: "/admin/finance", label: "Finanzen", description: "Buchhaltung", permission: "dashboard", group: "Übersicht" },
  { key: "orders", href: "/backoffice/orders", adminHref: "/admin/orders", label: "Bestellmonitor", description: "Aufträge", permission: "orders", group: "Übersicht" },
  { key: "tables", href: "/backoffice/tables", adminHref: "/admin/tables", label: "Tischmonitor", description: "Tische", permission: "tables", group: "Übersicht" },
  { key: "cashier", href: "/backoffice/cashier", adminHref: "/admin/cashier", label: "Kasse", description: "Zahlungen", permission: "cashier", group: "Service" },
  { key: "reservations", href: "/backoffice/reservations", adminHref: "/admin/reservations", label: "Reservierungen", description: "Tischanfragen", permission: "tables", group: "Service" },
  { key: "events", href: "/backoffice/events", adminHref: "/admin/events", label: "Events", description: "Veranstaltungen", permission: "tables", group: "Service" },
  { key: "menu", href: "/backoffice/menu", adminHref: "/admin/menu", label: "Speisekarte", description: "Menüs & Preise", permission: "menu", group: "Sortiment" },
  { key: "products", href: "/backoffice/products", adminHref: "/admin/products", label: "Produkte", description: "Katalog", permission: "products", group: "Sortiment" },
  { key: "inventory", href: "/backoffice/inventory", adminHref: "/admin/inventory", label: "Lager", description: "Bestand", permission: "inventory", group: "Warenwirtschaft" },
  { key: "recipes", href: "/backoffice/recipes", adminHref: "/admin/recipes", label: "Rezepturen", description: "Zutaten", permission: "recipes", group: "Warenwirtschaft" },
  { key: "suppliers", href: "/backoffice/suppliers", adminHref: "/admin/suppliers", label: "Lieferanten", description: "Partner", permission: "suppliers", group: "Warenwirtschaft" },
  { key: "purchases", href: "/backoffice/purchases", adminHref: "/admin/purchases", label: "Einkauf", description: "Bestellungen", permission: "purchases", group: "Warenwirtschaft" },
  { key: "personal", href: "/backoffice/personal", adminHref: "/admin/personal", label: "Personal", description: "Mitarbeiter & Profil", permission: "personal", group: "Verwaltung" },
  { key: "frontend-tools", href: "/backoffice/frontend-tools", adminHref: "/admin/frontend-tools", label: "System", description: "UI & Sprachen", permission: "frontend-tools", group: "Verwaltung" },
] as const;

type AdminKey = (typeof adminMenu)[number]["key"];

function adminKeyForPath(pathname: string) {
  return adminMenu.find(
    (item) => pathname === item.href || (item.href !== "/backoffice" && pathname.startsWith(`${item.href}/`)),
  )?.key ?? "dashboard";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<AdminKey>(() => adminKeyForPath(pathname));
  const [modalKey, setModalKey] = useState<AdminKey | null>(null);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(DEFAULT_STAFF_USERS[0]);
  const [currentRole, setCurrentRole] = useState<Role>("admin");
  const [rolePermissions, setRolePermissions] = useState<Record<Role, Permission[]>>(
    Object.fromEntries(Object.entries(ROLE_DEFINITIONS).map(([role, definition]) => [role, definition.permissions])) as Record<Role, Permission[]>,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawUsers = window.localStorage.getItem("aster-staff-users");
      const rawActive = window.localStorage.getItem("aster-active-user-id");
      const users = rawUsers ? (JSON.parse(rawUsers) as StaffUser[]) : DEFAULT_STAFF_USERS;
      const active = users.find((user) => user.id === rawActive) ?? users[0] ?? DEFAULT_STAFF_USERS[0];
      setCurrentUser(active);
    } catch {
      setCurrentUser(DEFAULT_STAFF_USERS[0]);
    }
  }, []);

  useEffect(() => {
    async function loadAccess() {
      const [sessionResponse, permissionsResponse] = await Promise.all([
        fetch("/api/user/session", { cache: "no-store" }),
        fetch("/api/admin/role-permissions", { cache: "no-store" }),
      ]);
      if (sessionResponse.ok) {
        const session = await sessionResponse.json() as { role?: string };
        if (session.role && session.role in ROLE_DEFINITIONS) setCurrentRole(session.role as Role);
      }
      if (permissionsResponse.ok) {
        const savedPermissions = await permissionsResponse.json() as Record<Role, Permission[]> | null;
        if (savedPermissions) setRolePermissions(savedPermissions);
      }
    }
    void loadAccess();
  }, []);

  useEffect(() => {
    const hashValue = window.location.hash.replace("#", "") as AdminKey;
    if (hashValue && adminMenu.some((item) => item.key === hashValue)) {
      setActiveKey(hashValue);
      return;
    }

    setActiveKey(adminKeyForPath(pathname));
  }, [pathname]);

  const visibleMenu = useMemo(
    () =>
      adminMenu.filter(
        (item) => currentRole === "admin" || rolePermissions[currentRole].includes(item.permission as Permission),
      ),
    [currentRole, rolePermissions],
  );

  const groupedMenu = useMemo(
    () =>
      Array.from(new Set(visibleMenu.map((item) => item.group))).map((groupName) => ({
        name: groupName,
        items: visibleMenu.filter((item) => item.group === groupName),
      })),
    [visibleMenu],
  );

  useEffect(() => {
    if (!modalKey) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalKey(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalKey]);

  function renderPanelFor(key: AdminKey) {
    switch (key) {
      case "dashboard":
        return <DashboardPage />;
      case "finance":
        return <FinancePage />;
      case "menu":
        return <MenuPage />;
      case "orders":
        return <OrdersPage />;
      case "cashier":
        return <CashierPage />;
      case "inventory":
        return <InventoryPage />;
      case "recipes":
        return <RecipesPage />;
      case "suppliers":
        return <SuppliersPage />;
      case "purchases":
        return <PurchasesPage />;
      case "products":
        return <ProductsPage />;
      case "tables":
        return <TableManagement />;
      case "events":
        return <EventsAdminPage />;
      case "reservations":
        return <ReservationsPage />;
      case "frontend-tools":
        return <FrontEndToolsPage />;
      case "personal":
        return <PersonalPage />;
      default:
        return children;
    }
  }

  const renderActivePanel = useMemo(() => renderPanelFor(activeKey), [activeKey, children]);

  const modalItem = modalKey ? adminMenu.find((item) => item.key === modalKey) : null;

  const renderModalPanel = useMemo(() => {
    if (!modalKey) return null;
    return renderPanelFor(modalKey);
  }, [modalKey, children]);

  const handleSelect = (key: AdminKey) => {
    setActiveKey(key);
    const item = adminMenu.find((entry) => entry.key === key);
    if (item) {
      window.history.replaceState(null, "", `${item.href}#${key}`);
    }
  };

  const openPopup = (event: MouseEvent<HTMLAnchorElement>, key: AdminKey) => {
    event.preventDefault();
    handleSelect(key);
    setModalKey(key);
  };

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/backoffice");
    setActiveKey("dashboard");
  }

  return (
    <div className="home-page backoffice-shell">
      <header className="site-header backoffice-header">
        <div className="wrap site-header-inner">
          <div className="brand-mark-float">
            <div className="brand-mark-btn backoffice-brand-mark" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 3H9v10.55A4 4 0 1 0 11 17V7h7v6.55A4 4 0 1 0 20 17V3z" />
              </svg>
            </div>
            <div className="backoffice-brand-copy">
              <span className="gold">ADMIN CONSOLE</span>
              <strong>ASTER Backoffice</strong>
            </div>
          </div>

          <div className="header-user-area">
            {currentUser && (
              <div className="admin-user-chip">
                <span className="admin-user-dot" />
                <span>{currentUser.name}</span>
              </div>
            )}
            <button className="admin-logout" onClick={logout}>
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <nav className="wrap backoffice-tabs" aria-label="Administrationsmenü">
        {groupedMenu.map((group) => (
          <div
            key={group.name}
            className={`backoffice-tab-group${group.items.some((item) => item.key === activeKey) ? " active" : ""}`}
          >
            <div className="backoffice-tab-group-heading">
              <span className="backoffice-tab-group-title">{group.name}</span>
              <span className="backoffice-tab-group-caption">{group.items.length} Unterobjekte</span>
            </div>
            <div className="backoffice-tab-row">
              {group.items.map((item) => {
                const buttonActive = activeKey === item.key;
                return (
                  <a
                    key={item.href}
                    href={`${item.adminHref}#${item.key}`}
                    onClick={(event) => openPopup(event, item.key)}
                    className={`backoffice-tab${buttonActive ? " active" : ""}`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <main className="wrap backoffice-panel">{renderActivePanel}</main>
      {modalItem && (
        <div className="backoffice-modal-backdrop" role="presentation" onClick={() => setModalKey(null)}>
          <section
            aria-labelledby="backoffice-modal-title"
            className="backoffice-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="backoffice-modal-header">
              <div>
                <p className="eyebrow">{modalItem.group}</p>
                <h2 id="backoffice-modal-title">{modalItem.label}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalKey(null)}>
                Schließen
              </button>
            </div>
            <div className="backoffice-modal-body">{renderModalPanel}</div>
          </section>
        </div>
      )}
    </div>
  );
}
