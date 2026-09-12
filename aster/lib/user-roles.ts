export type Role = "admin" | "manager" | "service" | "kitchen" | "backoffice";

export type Permission =
  | "dashboard"
  | "menu"
  | "orders"
  | "cashier"
  | "inventory"
  | "recipes"
  | "suppliers"
  | "purchases"
  | "products"
  | "tables"
  | "frontend-tools"
  | "personal";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  personnelNumber: string;
  phone: string;
  role: Role;
  department: string;
  active: boolean;
  createdAt: string;
};

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard",
  "menu",
  "orders",
  "cashier",
  "inventory",
  "recipes",
  "suppliers",
  "purchases",
  "products",
  "tables",
  "frontend-tools",
  "personal",
];

export const ROLE_DEFINITIONS: Record<
  Role,
  { label: string; description: string; permissions: Permission[] }
> = {
  admin: {
    label: "Admin",
    description: "Volle Berechtigung aller Bereiche",
    permissions: ALL_PERMISSIONS,
  },
  manager: {
    label: "Manager",
    description: "Management, Bestellungen und Personal",
    permissions: [
      "dashboard",
      "orders",
      "cashier",
      "inventory",
      "recipes",
      "suppliers",
      "purchases",
      "products",
      "tables",
      "personal",
    ],
  },
  service: {
    label: "Service",
    description: "Service, Bestellungen und Tischmanagement",
    permissions: ["dashboard", "orders", "cashier", "tables", "personal"],
  },
  kitchen: {
    label: "Küche",
    description: "Küche, Rezepturen und Lager",
    permissions: ["dashboard", "inventory", "recipes", "orders", "personal"],
  },
  backoffice: {
    label: "Backoffice",
    description: "Einkauf, Lager und Dokumentation",
    permissions: [
      "dashboard",
      "inventory",
      "suppliers",
      "purchases",
      "products",
      "personal",
    ],
  },
};

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_DEFINITIONS[role]?.permissions ?? [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === "admin") return true;
  return getRolePermissions(role).includes(permission);
}

export const DEFAULT_STAFF_USERS: StaffUser[] = [
  {
    id: "admin-01",
    name: "Amanuel Johannes",
    email: "admin@habesha.local",
    personnelNumber: "1001",
    phone: "+49123456789",
    role: "admin",
    department: "Administration",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "manager-01",
    name: "Sara Bekele",
    email: "manager@habesha.local",
    personnelNumber: "1002",
    phone: "+49123456790",
    role: "manager",
    department: "Management",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "service-01",
    name: "Tewodros Tadesse",
    email: "service@habesha.local",
    personnelNumber: "1003",
    phone: "+49123456791",
    role: "service",
    department: "Service",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "kitchen-01",
    name: "Mulugeta Hailu",
    email: "kitchen@habesha.local",
    personnelNumber: "1004",
    phone: "+49123456792",
    role: "kitchen",
    department: "Küche",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "backoffice-01",
    name: "Lealem Kebede",
    email: "backoffice@habesha.local",
    personnelNumber: "1005",
    phone: "+49123456793",
    role: "backoffice",
    department: "Backoffice",
    active: true,
    createdAt: new Date().toISOString(),
  },
];
