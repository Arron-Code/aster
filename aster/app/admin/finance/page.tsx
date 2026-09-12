"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

type CostCategory =
  | "PERSONNEL"
  | "OPERATING_SUPPLIES"
  | "PRODUCTS"
  | "CONTRACT"
  | "RENT"
  | "UTILITIES"
  | "MARKETING"
  | "INSURANCE"
  | "TAX"
  | "OTHER";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
type ContractStatus = "ACTIVE" | "PAUSED" | "TERMINATED";
type FinanceTab = "revenue" | "costs" | "overall" | "contribution" | "contracts";

type FinanceData = {
  accounts: Array<{ id: string; number: string; name: string; type: string; active: boolean }>;
  taxRates: Array<{ id: string; name: string; code: string; rate: number; active: boolean }>;
  registers: Array<{ id: string; name: string; location: string | null; active: boolean; _count: { sessions: number } }>;
  sessions: { open: number; closed: number };
  transactionTotals: Array<{ paymentMethod: string; type: string; _sum: { amountCents: number | null }; _count: { id: number } }>;
  todayTransactionTotals: Array<{ paymentMethod: string; type: string; _sum: { amountCents: number | null }; _count: { id: number } }>;
  journal: { lines: number; debitCents: number; creditCents: number; differenceCents: number };
  recentTransactions: Array<{
    id: string;
    paymentMethod: string;
    type: string;
    amountCents: number;
    occurredAt: string;
    note: string | null;
    session: { register: { name: string } };
    order: { table: { number: number } } | null;
  }>;
  recentEntries: Array<{
    id: string;
    entryNumber: string;
    entryDate: string;
    description: string;
    lines: Array<{
      id: string;
      debitCents: number;
      creditCents: number;
      account: { number: string; name: string };
      taxRate: { code: string; rate: number } | null;
    }>;
  }>;
  costs: CostEntry[];
  contracts: ContractEntry[];
  contributionMargins: ContributionRow[];
  calculation: {
    currentMonth: string;
    totalTurnover: number;
    todayTurnover: number;
    currentMonthTurnover: number;
    manualCostTotal: number;
    currentMonthManualCostTotal: number;
    activeContractMonthlyTotal: number;
    activeContractTotal: number;
    purchaseProductCosts: number;
    monthlyCostTotal: number;
    totalCostProjection: number;
    monthlyResultCents: number;
    totalResultCents: number;
    categoryTotals: Array<{ category: CostCategory; totalCents: number }>;
  };
};

type CostEntry = {
  id: string;
  category: CostCategory;
  title: string;
  vendor: string | null;
  amountCents: number;
  occurredAt: string;
  costMonth: string | null;
  note: string | null;
  contractId: string | null;
  contract?: { title: string; partnerName: string } | null;
};

type ContractEntry = {
  id: string;
  title: string;
  partnerName: string;
  contractNumber: string | null;
  category: CostCategory;
  startDate: string;
  endDate: string | null;
  billingCycle: BillingCycle;
  monthlyAmountCents: number;
  totalAmountCents: number;
  cancellationPeriodDays: number | null;
  status: ContractStatus;
  note: string | null;
};

type ContributionRow = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  recipeCostCents: number;
  directPurchaseCostCents: number;
  variableCostCents: number;
  contributionCents: number;
  contributionRate: number;
  soldQuantity: number;
  totalContributionCents: number;
};

const paymentLabels: Record<string, string> = {
  CASH: "Bar",
  CARD: "Karte",
  PAYPAL: "PayPal",
  OTHER: "Sonstige",
};

const typeLabels: Record<string, string> = {
  SALE: "Verkauf",
  REFUND: "Rückgabe",
  CASH_IN: "Einlage",
  CASH_OUT: "Entnahme",
  TIP: "Trinkgeld",
  DIFFERENCE: "Differenz",
};

const categoryLabels: Record<CostCategory, string> = {
  PERSONNEL: "Personal",
  OPERATING_SUPPLIES: "Betriebsmittel",
  PRODUCTS: "Produkte / Wareneinsatz",
  CONTRACT: "Vertrag",
  RENT: "Miete",
  UTILITIES: "Energie / Nebenkosten",
  MARKETING: "Marketing",
  INSURANCE: "Versicherung",
  TAX: "Steuern / Abgaben",
  OTHER: "Sonstige Kosten",
};

const billingLabels: Record<BillingCycle, string> = {
  MONTHLY: "Monatlich",
  QUARTERLY: "Quartalsweise",
  YEARLY: "Jährlich",
  ONE_TIME: "Einmalig",
};

const statusLabels: Record<ContractStatus, string> = {
  ACTIVE: "Aktiv",
  PAUSED: "Pausiert",
  TERMINATED: "Beendet",
};

const emptyCostForm = {
  id: "",
  category: "PRODUCTS" as CostCategory,
  title: "",
  vendor: "",
  amount: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  costMonth: new Date().toISOString().slice(0, 7),
  contractId: "",
  note: "",
};

const emptyContractForm = {
  id: "",
  title: "",
  partnerName: "",
  contractNumber: "",
  category: "CONTRACT" as CostCategory,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  billingCycle: "MONTHLY" as BillingCycle,
  monthlyAmount: "",
  totalAmount: "",
  cancellationPeriodDays: "",
  status: "ACTIVE" as ContractStatus,
  note: "",
};

function cents(value: number) {
  return formatPrice(value);
}

function parseEuroToCents(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function dateOnly(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<FinanceTab>("overall");
  const [costForm, setCostForm] = useState({ ...emptyCostForm });
  const [contractForm, setContractForm] = useState({ ...emptyContractForm });
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/finance", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }
    if (!response.ok) {
      setMessage("Finanzdaten konnten nicht geladen werden.");
      return;
    }
    setData(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  const totalTurnover = data?.calculation.totalTurnover ?? 0;
  const todayTurnover = data?.calculation.todayTurnover ?? 0;
  const currentMonthTurnover = data?.calculation.currentMonthTurnover ?? 0;

  const sortedMargins = useMemo(
    () =>
      [...(data?.contributionMargins ?? [])].sort(
        (a, b) => b.totalContributionCents - a.totalContributionCents,
      ),
    [data?.contributionMargins],
  );

  function resetCostForm() {
    setCostForm({ ...emptyCostForm });
  }

  function resetContractForm() {
    setContractForm({ ...emptyContractForm });
  }

  function editCost(cost: CostEntry) {
    setActiveTab("costs");
    setCostForm({
      id: cost.id,
      category: cost.category,
      title: cost.title,
      vendor: cost.vendor ?? "",
      amount: (cost.amountCents / 100).toFixed(2),
      occurredAt: dateOnly(cost.occurredAt),
      costMonth: cost.costMonth ?? dateOnly(cost.occurredAt).slice(0, 7),
      contractId: cost.contractId ?? "",
      note: cost.note ?? "",
    });
  }

  function editContract(contract: ContractEntry) {
    setActiveTab("contracts");
    setContractForm({
      id: contract.id,
      title: contract.title,
      partnerName: contract.partnerName,
      contractNumber: contract.contractNumber ?? "",
      category: contract.category,
      startDate: dateOnly(contract.startDate),
      endDate: dateOnly(contract.endDate),
      billingCycle: contract.billingCycle,
      monthlyAmount: (contract.monthlyAmountCents / 100).toFixed(2),
      totalAmount: (contract.totalAmountCents / 100).toFixed(2),
      cancellationPeriodDays:
        contract.cancellationPeriodDays === null ? "" : String(contract.cancellationPeriodDays),
      status: contract.status,
      note: contract.note ?? "",
    });
  }

  async function saveCost(e: FormEvent) {
    e.preventDefault();
    const amountCents = parseEuroToCents(costForm.amount);
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      setMessage("Bitte einen gültigen Kostenbetrag eingeben.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/finance", {
        method: costForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "cost",
          id: costForm.id || undefined,
          category: costForm.category,
          title: costForm.title,
          vendor: costForm.vendor || null,
          amountCents,
          occurredAt: costForm.occurredAt,
          costMonth: costForm.costMonth || null,
          contractId: costForm.contractId || null,
          note: costForm.note || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Kostenposition konnte nicht gespeichert werden.");
        return;
      }
      setMessage(costForm.id ? "Kostenposition aktualisiert." : "Kostenposition angelegt.");
      resetCostForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveContract(e: FormEvent) {
    e.preventDefault();
    const monthlyAmountCents = parseEuroToCents(contractForm.monthlyAmount);
    const totalAmountCents = parseEuroToCents(contractForm.totalAmount || contractForm.monthlyAmount);
    if (!Number.isFinite(monthlyAmountCents) || monthlyAmountCents < 0 || !Number.isFinite(totalAmountCents)) {
      setMessage("Bitte gültige Vertragsbeträge eingeben.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/finance", {
        method: contractForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "contract",
          id: contractForm.id || undefined,
          title: contractForm.title,
          partnerName: contractForm.partnerName,
          contractNumber: contractForm.contractNumber || null,
          category: contractForm.category,
          startDate: contractForm.startDate,
          endDate: contractForm.endDate || null,
          billingCycle: contractForm.billingCycle,
          monthlyAmountCents,
          totalAmountCents,
          cancellationPeriodDays: contractForm.cancellationPeriodDays
            ? Number(contractForm.cancellationPeriodDays)
            : null,
          status: contractForm.status,
          note: contractForm.note || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Vertrag konnte nicht gespeichert werden.");
        return;
      }
      setMessage(contractForm.id ? "Vertrag aktualisiert." : "Vertrag angelegt.");
      resetContractForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind: "cost" | "contract", id: string) {
    if (!confirm(kind === "cost" ? "Kostenposition löschen?" : "Vertrag löschen?")) return;
    const response = await fetch(`/api/admin/finance?kind=${kind}&id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ?? "Löschen fehlgeschlagen.");
      return;
    }
    setMessage(kind === "cost" ? "Kostenposition gelöscht." : "Vertrag gelöscht.");
    await load();
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Verwaltung</p>
          <h1>Finanzen</h1>
          <p className="muted">
            Erlöse, Kosten, Verträge und Deckungsbeiträge für die Sortimentskalkulation.
          </p>
        </div>
      </header>

      {message && <p className="cashier-message">{message}</p>}
      {!data ? (
        <p className="muted">Finanzdaten werden geladen...</p>
      ) : (
        <div className="finance-page">
          <div className="purchase-tabs">
            <TabButton active={activeTab === "overall"} onClick={() => setActiveTab("overall")}>Gesamtkalkulation</TabButton>
            <TabButton active={activeTab === "revenue"} onClick={() => setActiveTab("revenue")}>Erlöskalkulation</TabButton>
            <TabButton active={activeTab === "costs"} onClick={() => setActiveTab("costs")}>Kostenkalkulation</TabButton>
            <TabButton active={activeTab === "contribution"} onClick={() => setActiveTab("contribution")}>Deckungsbeiträge</TabButton>
            <TabButton active={activeTab === "contracts"} onClick={() => setActiveTab("contracts")}>Verträge</TabButton>
          </div>

          {activeTab === "overall" && (
            <>
              <div className="metric-grid">
                <Metric label="Erlöse laufender Monat" value={cents(currentMonthTurnover)} />
                <Metric label="Kosten laufender Monat" value={cents(data.calculation.monthlyCostTotal)} />
                <Metric label="Monatsergebnis" value={cents(data.calculation.monthlyResultCents)} />
                <Metric label="Aktive Vertragskosten / Monat" value={cents(data.calculation.activeContractMonthlyTotal)} />
              </div>

              <section className="card finance-card">
                <h2>Gesamtkalkulation</h2>
                <div className="finance-grid">
                  <MiniMetric label="Gesamterlöse" value={cents(totalTurnover)} />
                  <MiniMetric label="Manuelle Kosten gesamt" value={cents(data.calculation.manualCostTotal)} />
                  <MiniMetric label="Produkt-/Wareneinsatz" value={cents(data.calculation.purchaseProductCosts)} />
                  <MiniMetric label="Gesamtergebnis" value={cents(data.calculation.totalResultCents)} />
                </div>
              </section>

              <section className="card finance-card">
                <h2>Kosten nach Kostenart</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Kostenart</th><th>Betrag</th></tr>
                    </thead>
                    <tbody>
                      {data.calculation.categoryTotals.map((row) => (
                        <tr key={row.category}>
                          <td>{categoryLabels[row.category]}</td>
                          <td>{cents(row.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === "revenue" && (
            <>
              <div className="metric-grid">
                <Metric label="Umsatz heute aus Kasse" value={cents(todayTurnover)} />
                <Metric label="Umsatz gesamt aus Kasse" value={cents(totalTurnover)} />
                <Metric label="Offene Kassen" value={data.sessions.open} />
                <Metric label="Journal-Differenz" value={cents(data.journal.differenceCents)} />
              </div>

              <section className="card finance-card">
                <h2>Umsatz nach Zahlungsart</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Zahlungsart</th><th>Typ</th><th>Anzahl</th><th>Betrag</th></tr>
                    </thead>
                    <tbody>
                      {data.transactionTotals.map((row) => (
                        <tr key={`${row.paymentMethod}-${row.type}`}>
                          <td>{paymentLabels[row.paymentMethod] ?? row.paymentMethod}</td>
                          <td>{typeLabels[row.type] ?? row.type}</td>
                          <td>{row._count.id}</td>
                          <td>{cents(row._sum.amountCents ?? 0)}</td>
                        </tr>
                      ))}
                      {data.transactionTotals.length === 0 && (
                        <tr><td colSpan={4}>Noch keine Kassenbuchungen vorhanden.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card finance-card">
                <h2>Kassen & Abschlüsse</h2>
                <div className="finance-grid">
                  {data.registers.map((register) => (
                    <article className="finance-mini-card" key={register.id}>
                      <strong>{register.name}</strong>
                      <span>{register.location ?? "Ohne Standort"}</span>
                      <small>{register._count.sessions} Abschlüsse · {register.active ? "Aktiv" : "Inaktiv"}</small>
                    </article>
                  ))}
                  {data.registers.length === 0 && <p className="muted">Noch keine Kassen angelegt.</p>}
                </div>
              </section>

              <section className="card finance-card">
                <h2>Letzte Erlösbuchungen</h2>
                <div className="finance-grid">
                  {data.recentTransactions.map((transaction) => (
                    <article className="finance-mini-card" key={transaction.id}>
                      <strong>{cents(transaction.amountCents)}</strong>
                      <span>{paymentLabels[transaction.paymentMethod] ?? transaction.paymentMethod} · {typeLabels[transaction.type] ?? transaction.type}</span>
                      <small>
                        {transaction.order ? `Tisch ${transaction.order.table.number}` : transaction.session.register.name}
                        {" · "}
                        {new Date(transaction.occurredAt).toLocaleString("de-DE")}
                      </small>
                    </article>
                  ))}
                  {data.recentTransactions.length === 0 && <p className="muted">Noch keine Transaktionen vorhanden.</p>}
                </div>
              </section>
            </>
          )}

          {activeTab === "costs" && (
            <section className="card finance-card">
              <h2>{costForm.id ? "Kostenposition ändern" : "Kostenposition anlegen"}</h2>
              <form className="purchase-items-form" onSubmit={saveCost}>
                <div className="purchase-item-form">
                  <label>Bezeichnung<input required value={costForm.title} onChange={(e) => setCostForm({ ...costForm, title: e.target.value })} /></label>
                  <label>Kostenart<select value={costForm.category} onChange={(e) => setCostForm({ ...costForm, category: e.target.value as CostCategory })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label>Betrag €<input required value={costForm.amount} onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })} placeholder="0,00" /></label>
                  <label>Datum<input type="date" required value={costForm.occurredAt} onChange={(e) => setCostForm({ ...costForm, occurredAt: e.target.value })} /></label>
                  <label>Monat<input type="month" value={costForm.costMonth} onChange={(e) => setCostForm({ ...costForm, costMonth: e.target.value })} /></label>
                  <button className="btn" disabled={saving}>{saving ? "Speichern..." : costForm.id ? "Ändern" : "Anlegen"}</button>
                </div>
                <div className="purchase-item-form">
                  <label>Lieferant / Zahlungsempfänger<input value={costForm.vendor} onChange={(e) => setCostForm({ ...costForm, vendor: e.target.value })} /></label>
                  <label>Vertrag<select value={costForm.contractId} onChange={(e) => setCostForm({ ...costForm, contractId: e.target.value })}><option value="">Ohne Vertrag</option>{data.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title}</option>)}</select></label>
                  <label>Notiz<input value={costForm.note} onChange={(e) => setCostForm({ ...costForm, note: e.target.value })} /></label>
                  <button type="button" className="btn secondary" onClick={resetCostForm}>Zurücksetzen</button>
                </div>
              </form>

              <h3>Kostenpositionen</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Datum</th><th>Kostenart</th><th>Bezeichnung</th><th>Empfänger</th><th>Vertrag</th><th>Betrag</th><th>Aktionen</th></tr>
                  </thead>
                  <tbody>
                    {data.costs.map((cost) => (
                      <tr key={cost.id}>
                        <td>{new Date(cost.occurredAt).toLocaleDateString("de-DE")}</td>
                        <td>{categoryLabels[cost.category]}</td>
                        <td>{cost.title}</td>
                        <td>{cost.vendor ?? "-"}</td>
                        <td>{cost.contract?.title ?? "-"}</td>
                        <td>{cents(cost.amountCents)}</td>
                        <td><button className="btn secondary" onClick={() => editCost(cost)}>Ändern</button> <button className="btn danger" onClick={() => remove("cost", cost.id)}>Löschen</button></td>
                      </tr>
                    ))}
                    {data.costs.length === 0 && <tr><td colSpan={7}>Noch keine Kostenpositionen erfasst.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "contribution" && (
            <section className="card finance-card">
              <h2>Deckungsbeitrag je Sortimentselement</h2>
              <p className="muted">
                Verkaufspreis minus variable Produktkosten aus Rezepturen oder direkten Einkaufspositionen.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sortiment</th><th>Kategorie</th><th>Preis</th><th>Rezeptkosten</th><th>Einkaufskosten</th><th>Variable Kosten</th><th>DB/Stück</th><th>DB %</th><th>Verkauft</th><th>DB gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMargins.map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.category}</td>
                        <td>{cents(row.priceCents)}</td>
                        <td>{cents(row.recipeCostCents)}</td>
                        <td>{cents(row.directPurchaseCostCents)}</td>
                        <td>{cents(row.variableCostCents)}</td>
                        <td style={{ color: row.contributionCents >= 0 ? "#166534" : "#b91c1c", fontWeight: 800 }}>{cents(row.contributionCents)}</td>
                        <td>{row.contributionRate.toFixed(1)} %</td>
                        <td>{row.soldQuantity}</td>
                        <td>{cents(row.totalContributionCents)}</td>
                      </tr>
                    ))}
                    {sortedMargins.length === 0 && <tr><td colSpan={10}>Keine Sortimentsdaten vorhanden.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "contracts" && (
            <section className="card finance-card">
              <h2>{contractForm.id ? "Vertrag ändern" : "Vertrag anlegen"}</h2>
              <form className="purchase-items-form" onSubmit={saveContract}>
                <div className="purchase-item-form">
                  <label>Vertragsname<input required value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} /></label>
                  <label>Vertragspartner<input required value={contractForm.partnerName} onChange={(e) => setContractForm({ ...contractForm, partnerName: e.target.value })} /></label>
                  <label>Vertragsnummer<input value={contractForm.contractNumber} onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })} /></label>
                  <label>Kostenart<select value={contractForm.category} onChange={(e) => setContractForm({ ...contractForm, category: e.target.value as CostCategory })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label>Status<select value={contractForm.status} onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as ContractStatus })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <button className="btn" disabled={saving}>{saving ? "Speichern..." : contractForm.id ? "Ändern" : "Anlegen"}</button>
                </div>
                <div className="purchase-item-form">
                  <label>Beginn<input type="date" required value={contractForm.startDate} onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })} /></label>
                  <label>Ende<input type="date" value={contractForm.endDate} onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })} /></label>
                  <label>Abrechnung<select value={contractForm.billingCycle} onChange={(e) => setContractForm({ ...contractForm, billingCycle: e.target.value as BillingCycle })}>{Object.entries(billingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label>Monatskosten €<input required value={contractForm.monthlyAmount} onChange={(e) => setContractForm({ ...contractForm, monthlyAmount: e.target.value })} placeholder="0,00" /></label>
                  <label>Gesamtkosten €<input required value={contractForm.totalAmount} onChange={(e) => setContractForm({ ...contractForm, totalAmount: e.target.value })} placeholder="0,00" /></label>
                  <label>Kündigungsfrist Tage<input type="number" value={contractForm.cancellationPeriodDays} onChange={(e) => setContractForm({ ...contractForm, cancellationPeriodDays: e.target.value })} /></label>
                </div>
                <div className="purchase-item-form">
                  <label>Notiz<input value={contractForm.note} onChange={(e) => setContractForm({ ...contractForm, note: e.target.value })} /></label>
                  <button type="button" className="btn secondary" onClick={resetContractForm}>Zurücksetzen</button>
                </div>
              </form>

              <h3>Verträge anzeigen</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Partner</th><th>Kostenart</th><th>Status</th><th>Monatlich</th><th>Gesamt</th><th>Laufzeit</th><th>Aktionen</th></tr>
                  </thead>
                  <tbody>
                    {data.contracts.map((contract) => (
                      <tr key={contract.id}>
                        <td><strong>{contract.title}</strong><br /><small>{contract.contractNumber ?? "Ohne Nummer"}</small></td>
                        <td>{contract.partnerName}</td>
                        <td>{categoryLabels[contract.category]}</td>
                        <td><span className="status-badge">{statusLabels[contract.status]}</span></td>
                        <td>{cents(contract.monthlyAmountCents)}</td>
                        <td>{cents(contract.totalAmountCents)}</td>
                        <td>{new Date(contract.startDate).toLocaleDateString("de-DE")} - {contract.endDate ? new Date(contract.endDate).toLocaleDateString("de-DE") : "offen"}</td>
                        <td><button className="btn secondary" onClick={() => editContract(contract)}>Ändern</button> <button className="btn danger" onClick={() => remove("contract", contract.id)}>Löschen</button></td>
                      </tr>
                    ))}
                    {data.contracts.length === 0 && <tr><td colSpan={8}>Noch keine Verträge angelegt.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="card metric">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="finance-mini-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
