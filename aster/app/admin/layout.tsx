"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardPage from "./page";
import FinancePage from "./finance/page";
import MenuPage from "./menu/page";
import OrdersPage from "./orders/page";
import CashierPage from "./cashier/page";
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
import PushNotifications from "./push-notifications";
import { DEFAULT_STAFF_USERS, ROLE_DEFINITIONS, type Permission, type Role, type StaffUser } from "@/lib/user-roles";
import {
  ADMIN_LAYOUT_CHANGE_EVENT,
  DEFAULT_ADMIN_LAYOUT_MODE,
  isAdminLayoutMode,
  readAdminLayoutMode,
  writeAdminLayoutMode,
  type AdminLayoutMode,
} from "@/lib/admin-layout";

const adminMenu = [
  { key: "dashboard", href: "/admin", label: "Dashboard", description: "Übersicht", permission: "dashboard", group: "Betrieb" },
  { key: "finance", href: "/admin/finance", label: "Finanzen", description: "Buchhaltung", permission: "dashboard", group: "Verwaltung" },
  { key: "orders", href: "/admin/orders", label: "Bestellungen", description: "Aufträge", permission: "orders", group: "Betrieb" },
  { key: "cashier", href: "/admin/cashier", label: "Kasse", description: "Zahlungen", permission: "cashier", group: "Betrieb" },
  { key: "tables", href: "/admin/tables", label: "Tische", description: "QR-Codes", permission: "tables", group: "Betrieb" },
  { key: "events", href: "/admin/events", label: "Events", description: "Veranstaltungen", permission: "tables", group: "Betrieb" },
  { key: "reservations", href: "/admin/reservations", label: "Reservierungen", description: "Tischanfragen", permission: "tables", group: "Betrieb" },
  { key: "menu", href: "/admin/menu", label: "Speisekarte", description: "Menüs & Preise", permission: "menu", group: "Sortiment" },
  { key: "products", href: "/admin/products", label: "Produkte", description: "Katalog", permission: "products", group: "Sortiment" },
  { key: "inventory", href: "/admin/inventory", label: "Lager", description: "Bestand", permission: "inventory", group: "Bestand" },
  { key: "recipes", href: "/admin/recipes", label: "Rezepturen", description: "Zutaten", permission: "recipes", group: "Bestand" },
  { key: "suppliers", href: "/admin/suppliers", label: "Lieferanten", description: "Partner", permission: "suppliers", group: "Bestand" },
  { key: "purchases", href: "/admin/purchases", label: "Einkauf", description: "Bestellungen", permission: "purchases", group: "Bestand" },
  { key: "frontend-tools", href: "/admin/frontend-tools", label: "FrontEndTools", description: "UI & Sprachen", permission: "frontend-tools", group: "Verwaltung" },
  { key: "personal", href: "/admin/personal", label: "Personal", description: "Mitarbeiter & Profil", permission: "personal", group: "Verwaltung" },
] as const;

type AdminKey = (typeof adminMenu)[number]["key"];

function adminKeyForPath(pathname: string) {
  return adminMenu.find(
    (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)),
  )?.key ?? "dashboard";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<AdminKey>(() => adminKeyForPath(pathname));
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

  const renderActivePanel = useMemo(() => {
    switch (activeKey) {
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
  }, [activeKey, children]);

  const handleSelect = (key: AdminKey) => {
    setActiveKey(key);
    const item = adminMenu.find((entry) => entry.key === key);
    if (item) {
      window.history.replaceState(null, "", `${item.href}#${key}`);
    }
  };

  const [layoutMode, setLayoutMode] = useState<AdminLayoutMode>(DEFAULT_ADMIN_LAYOUT_MODE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLayoutMode(readAdminLayoutMode());
    const handleLayoutChange = (event: Event) => {
      const mode = (event as CustomEvent).detail;
      if (isAdminLayoutMode(mode)) setLayoutMode(mode);
    };
    window.addEventListener(ADMIN_LAYOUT_CHANGE_EVENT, handleLayoutChange);
    return () => window.removeEventListener(ADMIN_LAYOUT_CHANGE_EVENT, handleLayoutChange);
  }, []);

  const toggleLayoutMode = () => {
    writeAdminLayoutMode(layoutMode === "sidebar" ? "horizontal" : "sidebar");
  };

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    setActiveKey("dashboard");
  }

  return (
    <main className={`wrap admin-shell${layoutMode === "horizontal" ? " admin-shell-horizontal" : ""}`}>
      <button
        type="button"
        className="admin-layout-toggle"
        onClick={toggleLayoutMode}
        aria-label={layoutMode === "sidebar" ? "Zur horizontalen Ansicht wechseln" : "Zur Seitenleisten-Ansicht wechseln"}
        title={layoutMode === "sidebar" ? "Horizontale Ansicht" : "Seitenleisten-Ansicht"}
      >
        {layoutMode === "sidebar" ? "⬍ Horizontal" : "⬌ Seitenleiste"}
      </button>

      {layoutMode === "horizontal" ? (
        <>
          <header className="admin-header-bar" aria-label="Administrationsmenü">
            <div className="admin-brand admin-header-brand">
              <div className="admin-brand-mark">A</div>
              <div>
                <span className="admin-brand-label">ASTER</span>
                <small>Restaurant Operations</small>
              </div>
            </div>

            <nav className="admin-header-nav" aria-label="Administrationsbereiche">
              {groupedMenu.map((group) => (
                <div
                  key={group.name}
                  className={`admin-header-group${group.items.some((item) => item.key === activeKey) ? " active" : ""}`}
                >
                  <button type="button" className="admin-header-group-title" aria-haspopup="true">
                    {group.name}
                  </button>
                  <div className="admin-header-group-menu">
                    {group.items.map((item) => {
                      const buttonActive = activeKey === item.key;
                      return (
                        <a
                          key={item.href}
                          href={`${item.href}#${item.key}`}
                          onClick={() => handleSelect(item.key)}
                          className={`admin-nav-link admin-header-link${buttonActive ? " active" : ""}`}
                        >
                          <span className="admin-nav-link-icon">{item.label.slice(0, 1)}</span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="admin-header-actions">
              <div className="admin-header-user">
                <button type="button" className="admin-header-user-trigger" aria-label="Benutzermenü öffnen" aria-haspopup="true">
                  <span className="admin-user-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 12.25a3.75 3.75 0 1 0-3.75-3.75A3.75 3.75 0 0 0 12 12.25Zm0 1.75c-3.54 0-6.75 2.01-8.22 4.82A1 1 0 0 0 4.7 20h14.6a1 1 0 0 0 .92-1.18C18.75 16.01 15.54 14 12 14Z" />
                    </svg>
                  </span>
                </button>
                <div className="admin-header-user-menu">
                  <span className="admin-header-user-name">{currentUser ? currentUser.name : "Admin"}</span>
                  <button className="admin-logout admin-header-logout" onClick={logout}>
                    Abmelden
                  </button>
                </div>
              </div>
            </div>
          </header>

          <PushNotifications />
          <section className="admin-panel">{renderActivePanel}</section>
        </>
      ) : (
        <>
          <aside className="admin-sidebar">
            <nav className="admin-nav" aria-label="Administrationsmenü">
              <div className="admin-brand">
                <div className="admin-brand-mark">A</div>
                <div>
                  <span className="admin-brand-label">ASTER</span>
                  <small>Restaurant Operations</small>
                </div>
              </div>

              {currentUser && (
                <div className="admin-user-chip">
                  <span className="admin-user-dot" />
                  <span>{currentUser.name}</span>
                </div>
              )}

              <div className="admin-nav-list">
                {groupedMenu.map((group) => (
                  <div
                    key={group.name}
                    className={`admin-nav-group${group.items.some((item) => item.key === activeKey) ? " active" : ""}`}
                  >
                      <div className="admin-nav-group-heading">
                        <span className="admin-nav-group-title">{group.name}</span>
                      </div>
                      <div className="admin-nav-group-menu">
                      {group.items.map((item) => {
                      const buttonActive = activeKey === item.key;

                      return (
                        <a
                          key={item.href}
                          href={`${item.href}#${item.key}`}
                          onClick={() => handleSelect(item.key)}
                          className={`admin-nav-link${buttonActive ? " active" : ""}`}
                        >
                          <span className="admin-nav-link-icon">{item.label.slice(0, 1)}</span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </a>
                      );
                    })}
                      </div>
                  </div>
                ))}
              </div>

              <button className="admin-logout" onClick={logout}>
                Abmelden
              </button>
              <PushNotifications />
            </nav>
          </aside>

          <section className="admin-panel">{renderActivePanel}</section>
        </>
      )}
    </main>
  );
}
