import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";
import HomeClientPremium from "../home-client-premium";

// Vorschau-Route für die invertierte Premium-Variante (Rand-/Flächenfarben getauscht).
export const revalidate = 30;

export default async function FrontpagePremiumInvers() {
  const [items, cookieStore] = await Promise.all([
    prisma.menuItem.findMany({
      where: { available: true, category: { in: ["DRINK", "COFFEE", "FOOD"] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    cookies(),
  ]);

  const isAdminUser = validAdminToken(cookieStore.get(adminCookieName())?.value);

  const mapItem = (item: (typeof items)[number]) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    priceCents: item.priceCents,
    category: item.category as "FOOD" | "DRINK" | "COFFEE",
  });

  return (
    <HomeClientPremium
      theme="creamy"
      initialDrinkItems={items.filter((item) => item.category === "DRINK" || item.category === "COFFEE").map(mapItem)}
      initialFoodItems={items.filter((item) => item.category === "FOOD").map(mapItem)}
      initialIsAdminUser={isAdminUser}
    />
  );
}
