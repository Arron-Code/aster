import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";
import HomeClientPremium from "../home-client-premium";

// Alternative Startseite im Premium-Logo-Design zum direkten Vergleich mit den anderen Frontpage-Varianten.
export const revalidate = 30;

export default async function FrontpagePremium() {
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
      initialDrinkItems={items.filter((item) => item.category === "DRINK" || item.category === "COFFEE").map(mapItem)}
      initialFoodItems={items.filter((item) => item.category === "FOOD").map(mapItem)}
      initialIsAdminUser={isAdminUser}
    />
  );
}
