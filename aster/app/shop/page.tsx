import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";
import { DEFAULT_FRONTPAGE_VERSION, isFrontpageVersionId } from "@/lib/frontpage-versions";
import HomeClientPremium from "../home-client-premium";

export const revalidate = 30;

async function getActiveFrontpageVersion() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "frontpage_active_version" } });
  return row?.value && isFrontpageVersionId(row.value) ? row.value : DEFAULT_FRONTPAGE_VERSION;
}

export default async function ShopPage() {
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

  return (
    <HomeClientPremium
      theme={activeVersion}
      headerFrames={[
        { label: "Home", url: "https://asterscoffee.com/" },
        { label: "Über uns", url: "https://asterscoffee.com/ueber-uns/" },
      ]}
      externalNavigationLinks={[
        { label: "Kaffeesorten", url: "https://asterscoffee.com/kaffeesorten/" },
      ]}
      initialDrinkItems={items.filter((item) => item.category === "DRINK" || item.category === "COFFEE").map(mapItem)}
      initialFoodItems={items.filter((item) => item.category === "FOOD").map(mapItem)}
      initialIsAdminUser={isAdminUser}
    />
  );
}
