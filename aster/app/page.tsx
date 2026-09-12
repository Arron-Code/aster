import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";
import { DEFAULT_FRONTPAGE_VERSION, isFrontpageVersionId } from "@/lib/frontpage-versions";
import HomeClient from "./home-client";
import HomeClientAsteros from "./home-client-asteros";
import HomeClientPremium from "./home-client-premium";

// Rendered on the server so the menu and login state are already present
// in the very first HTML response instead of waiting for client-side fetches.
export const revalidate = 30;

async function getActiveFrontpageVersion() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "frontpage_active_version" } });
  return row?.value && isFrontpageVersionId(row.value) ? row.value : DEFAULT_FRONTPAGE_VERSION;
}

export default async function Home() {
  const [items, cookieStore, activeVersion] = await Promise.all([
    prisma.menuItem.findMany({
      where: { available: true, category: { in: ["DRINK", "COFFEE", "FOOD"] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    cookies(),
    getActiveFrontpageVersion(),
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

  const initialDrinkItems = items.filter((item) => item.category === "DRINK" || item.category === "COFFEE").map(mapItem);
  const initialFoodItems = items.filter((item) => item.category === "FOOD").map(mapItem);

  if (activeVersion === "asteros") {
    return (
      <HomeClientAsteros
        initialDrinkItems={initialDrinkItems}
        initialFoodItems={initialFoodItems}
        initialIsAdminUser={isAdminUser}
      />
    );
  }

  if (activeVersion === "premium") {
    return (
      <HomeClientPremium
        initialDrinkItems={initialDrinkItems}
        initialFoodItems={initialFoodItems}
        initialIsAdminUser={isAdminUser}
      />
    );
  }

  if (activeVersion === "premium-invers") {
    return (
      <HomeClientPremium
        invert
        initialDrinkItems={initialDrinkItems}
        initialFoodItems={initialFoodItems}
        initialIsAdminUser={isAdminUser}
      />
    );
  }

  return (
    <HomeClient
      initialDrinkItems={initialDrinkItems}
      initialFoodItems={initialFoodItems}
      initialIsAdminUser={isAdminUser}
    />
  );
}
