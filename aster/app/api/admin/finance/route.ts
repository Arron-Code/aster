import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, unauthorized } from "@/lib/admin-api";

const costCategories = [
  "PERSONNEL",
  "OPERATING_SUPPLIES",
  "PRODUCTS",
  "CONTRACT",
  "RENT",
  "UTILITIES",
  "MARKETING",
  "INSURANCE",
  "TAX",
  "OTHER",
] as const;

const billingCycles = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"] as const;
const contractStatuses = ["ACTIVE", "PAUSED", "TERMINATED"] as const;

const costSchema = z.object({
  id: z.string().optional(),
  category: z.enum(costCategories),
  title: z.string().trim().min(1, "Bezeichnung ist erforderlich"),
  vendor: z.string().trim().optional().nullable(),
  amountCents: z.number().int().min(0),
  occurredAt: z.string().min(1),
  costMonth: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  contractId: z.string().trim().optional().nullable(),
});

const contractSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Vertragsname ist erforderlich"),
  partnerName: z.string().trim().min(1, "Vertragspartner ist erforderlich"),
  contractNumber: z.string().trim().optional().nullable(),
  category: z.enum(costCategories).default("CONTRACT"),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  billingCycle: z.enum(billingCycles).default("MONTHLY"),
  monthlyAmountCents: z.number().int().min(0),
  totalAmountCents: z.number().int().min(0),
  cancellationPeriodDays: z.number().int().min(0).optional().nullable(),
  status: z.enum(contractStatuses).default("ACTIVE"),
  note: z.string().trim().optional().nullable(),
});

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ungültiges Datum.");
  }
  return date;
}

function signedCashAmount(type: string, amountCents: number) {
  return type === "REFUND" || type === "CASH_OUT" || type === "DIFFERENCE" ? -amountCents : amountCents;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = toMonthKey(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [
    accounts,
    taxRates,
    registers,
    openSessions,
    closedSessions,
    transactionTotals,
    todayTransactionTotals,
    currentMonthTransactionTotals,
    journalTotals,
    recentTransactions,
    recentEntries,
    costs,
    contracts,
    purchaseItems,
    menuItems,
  ] = await Promise.all([
    prisma.accountingAccount.findMany({
      orderBy: [{ number: "asc" }],
      take: 100,
    }),
    prisma.taxRate.findMany({
      orderBy: [{ active: "desc" }, { validFrom: "desc" }],
      take: 50,
    }),
    prisma.cashRegister.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { sessions: true } },
      },
    }),
    prisma.cashSession.count({ where: { status: "OPEN" } }),
    prisma.cashSession.count({ where: { status: "CLOSED" } }),
    prisma.cashTransaction.groupBy({
      by: ["paymentMethod", "type"],
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    prisma.cashTransaction.groupBy({
      by: ["paymentMethod", "type"],
      where: { occurredAt: { gte: today } },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    prisma.cashTransaction.groupBy({
      by: ["paymentMethod", "type"],
      where: { occurredAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    prisma.journalLine.aggregate({
      _sum: { debitCents: true, creditCents: true },
      _count: { id: true },
    }),
    prisma.cashTransaction.findMany({
      orderBy: [{ occurredAt: "desc" }],
      take: 10,
      include: {
        session: { include: { register: true } },
        order: { include: { table: true } },
      },
    }),
    prisma.journalEntry.findMany({
      orderBy: [{ entryDate: "desc" }],
      take: 10,
      include: {
        lines: { include: { account: true, taxRate: true } },
      },
    }),
    prisma.operatingCost.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { contract: true },
    }),
    prisma.contract.findMany({
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 200,
    }),
    prisma.purchaseOrderItem.findMany({
      where: { status: { in: ["ORDERED", "RECEIVED"] } },
      include: { menuItem: true, ingredient: true },
      take: 500,
    }),
    prisma.menuItem.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        recipeItems: { include: { ingredient: true } },
        orderItems: {
          include: { order: true },
        },
      },
      take: 500,
    }),
  ]);

  const totalTurnover = transactionTotals.reduce(
    (sum, row) => sum + signedCashAmount(row.type, row._sum.amountCents ?? 0),
    0,
  );
  const todayTurnover = todayTransactionTotals.reduce(
    (sum, row) => sum + signedCashAmount(row.type, row._sum.amountCents ?? 0),
    0,
  );
  const currentMonthTurnover = currentMonthTransactionTotals.reduce(
    (sum, row) => sum + signedCashAmount(row.type, row._sum.amountCents ?? 0),
    0,
  );

  const manualCostTotal = costs.reduce((sum, cost) => sum + cost.amountCents, 0);
  const currentMonthManualCostTotal = costs
    .filter((cost) => cost.costMonth === currentMonth || toMonthKey(cost.occurredAt) === currentMonth)
    .reduce((sum, cost) => sum + cost.amountCents, 0);
  const activeContractMonthlyTotal = contracts
    .filter((contract) => contract.status === "ACTIVE")
    .reduce((sum, contract) => sum + contract.monthlyAmountCents, 0);
  const activeContractTotal = contracts
    .filter((contract) => contract.status === "ACTIVE")
    .reduce((sum, contract) => sum + contract.totalAmountCents, 0);

  const purchaseProductCosts = purchaseItems.reduce((sum, item) => {
    const unitCost = item.receivedUnitCostCents ?? item.unitCostCents;
    const quantity = Number(item.receivedQuantity ?? item.quantity);
    return sum + Math.round(unitCost * quantity);
  }, 0);

  const categoryTotals = costCategories.map((category) => ({
    category,
    totalCents:
      costs.filter((cost) => cost.category === category).reduce((sum, cost) => sum + cost.amountCents, 0) +
      contracts
        .filter((contract) => contract.status === "ACTIVE" && contract.category === category)
        .reduce((sum, contract) => sum + contract.monthlyAmountCents, 0),
  }));

  const contributionMargins = menuItems.map((item) => {
    const recipeCostCents = item.recipeItems.reduce(
      (sum, recipeItem) => sum + Math.round(Number(recipeItem.quantity) * recipeItem.ingredient.costPerUnitCents),
      0,
    );
    const directPurchaseItems = purchaseItems.filter((purchaseItem) => purchaseItem.menuItemId === item.id);
    const directPurchaseCostCents = directPurchaseItems.length
      ? Math.round(
          directPurchaseItems.reduce((sum, purchaseItem) => sum + (purchaseItem.receivedUnitCostCents ?? purchaseItem.unitCostCents), 0) /
            directPurchaseItems.length,
        )
      : 0;
    const variableCostCents = recipeCostCents > 0 ? recipeCostCents : directPurchaseCostCents;
    const contributionCents = item.priceCents - variableCostCents;
    const contributionRate = item.priceCents > 0 ? (contributionCents / item.priceCents) * 100 : 0;
    const soldQuantity = item.orderItems
      .filter((orderItem) => orderItem.active && orderItem.order.status !== "CANCELLED")
      .reduce((sum, orderItem) => sum + orderItem.quantity, 0);

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      priceCents: item.priceCents,
      recipeCostCents,
      directPurchaseCostCents,
      variableCostCents,
      contributionCents,
      contributionRate,
      soldQuantity,
      totalContributionCents: contributionCents * soldQuantity,
    };
  });

  return NextResponse.json({
    accounts,
    taxRates: taxRates.map((taxRate) => ({
      ...taxRate,
      rate: Number(taxRate.rate),
    })),
    registers,
    sessions: {
      open: openSessions,
      closed: closedSessions,
    },
    transactionTotals,
    todayTransactionTotals,
    journal: {
      lines: journalTotals._count.id,
      debitCents: journalTotals._sum.debitCents ?? 0,
      creditCents: journalTotals._sum.creditCents ?? 0,
      differenceCents: (journalTotals._sum.debitCents ?? 0) - (journalTotals._sum.creditCents ?? 0),
    },
    recentTransactions,
    recentEntries: recentEntries.map((entry) => ({
      ...entry,
      lines: entry.lines.map((line) => ({
        ...line,
        taxRate: line.taxRate ? { ...line.taxRate, rate: Number(line.taxRate.rate) } : null,
      })),
    })),
    costs,
    contracts,
    contributionMargins,
    calculation: {
      currentMonth,
      totalTurnover,
      todayTurnover,
      currentMonthTurnover,
      manualCostTotal,
      currentMonthManualCostTotal,
      activeContractMonthlyTotal,
      activeContractTotal,
      purchaseProductCosts,
      monthlyCostTotal: currentMonthManualCostTotal + activeContractMonthlyTotal,
      totalCostProjection: manualCostTotal + activeContractTotal + purchaseProductCosts,
      monthlyResultCents: currentMonthTurnover - currentMonthManualCostTotal - activeContractMonthlyTotal,
      totalResultCents: totalTurnover - manualCostTotal - activeContractTotal - purchaseProductCosts,
      categoryTotals,
    },
    costCategories,
    billingCycles,
    contractStatuses,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const raw = await req.json();
  if (raw.kind === "cost") {
    const parsed = costSchema.parse(raw);
    const cost = await prisma.operatingCost.create({
      data: {
        category: parsed.category,
        title: parsed.title,
        vendor: parsed.vendor || null,
        amountCents: parsed.amountCents,
        occurredAt: normalizeDate(parsed.occurredAt),
        costMonth: parsed.costMonth || toMonthKey(normalizeDate(parsed.occurredAt)),
        note: parsed.note || null,
        contractId: parsed.contractId || null,
      },
    });
    return NextResponse.json(cost, { status: 201 });
  }

  if (raw.kind === "contract") {
    const parsed = contractSchema.parse(raw);
    const contract = await prisma.contract.create({
      data: {
        title: parsed.title,
        partnerName: parsed.partnerName,
        contractNumber: parsed.contractNumber || null,
        category: parsed.category,
        startDate: normalizeDate(parsed.startDate),
        endDate: parsed.endDate ? normalizeDate(parsed.endDate) : null,
        billingCycle: parsed.billingCycle,
        monthlyAmountCents: parsed.monthlyAmountCents,
        totalAmountCents: parsed.totalAmountCents,
        cancellationPeriodDays: parsed.cancellationPeriodDays ?? null,
        status: parsed.status,
        note: parsed.note || null,
      },
    });
    return NextResponse.json(contract, { status: 201 });
  }

  return NextResponse.json({ error: "Unbekannte Finanz-Aktion." }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const raw = await req.json();
  if (raw.kind === "cost") {
    const parsed = costSchema.extend({ id: z.string().min(1) }).parse(raw);
    const cost = await prisma.operatingCost.update({
      where: { id: parsed.id },
      data: {
        category: parsed.category,
        title: parsed.title,
        vendor: parsed.vendor || null,
        amountCents: parsed.amountCents,
        occurredAt: normalizeDate(parsed.occurredAt),
        costMonth: parsed.costMonth || toMonthKey(normalizeDate(parsed.occurredAt)),
        note: parsed.note || null,
        contractId: parsed.contractId || null,
      },
    });
    return NextResponse.json(cost);
  }

  if (raw.kind === "contract") {
    const parsed = contractSchema.extend({ id: z.string().min(1) }).parse(raw);
    const contract = await prisma.contract.update({
      where: { id: parsed.id },
      data: {
        title: parsed.title,
        partnerName: parsed.partnerName,
        contractNumber: parsed.contractNumber || null,
        category: parsed.category,
        startDate: normalizeDate(parsed.startDate),
        endDate: parsed.endDate ? normalizeDate(parsed.endDate) : null,
        billingCycle: parsed.billingCycle,
        monthlyAmountCents: parsed.monthlyAmountCents,
        totalAmountCents: parsed.totalAmountCents,
        cancellationPeriodDays: parsed.cancellationPeriodDays ?? null,
        status: parsed.status,
        note: parsed.note || null,
      },
    });
    return NextResponse.json(contract);
  }

  return NextResponse.json({ error: "Unbekannte Finanz-Aktion." }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  }

  if (kind === "cost") {
    await prisma.operatingCost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  if (kind === "contract") {
    await prisma.contract.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unbekannte Finanz-Aktion." }, { status: 400 });
}
