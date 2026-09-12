"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

type Ingredient = { id: string; name: string; unit: string; stock: number };
type Product = {
  id: string;
  name: string;
  category: "FOOD" | "DRINK" | "COFFEE";
  priceCents: number;
  quantity: number;
  unit: string;
  deliveryTimeDays: number | null;
  supplier: Supplier | null;
};
type Supplier = { id: string; name: string; email: string | null; phone?: string | null; address?: string | null };
type PurchaseItem = {
  id: string;
  ingredientId: string | null;
  ingredient: Ingredient | null;
  menuItemId: string | null;
  menuItem: Product | null;
  quantity: number;
  unitCostCents: number;
  deliveryTimeDays: number | null;
  taxRatePercent: number;
  status: "ORDERED" | "RECEIVED" | "CANCELLED";
  receivedQuantity: number | null;
  receivedUnitCostCents: number | null;
  receivedAt: string | null;
};
type Purchase = {
  id: string;
  supplier: Supplier;
  note: string | null;
  supplierConfirmation: string | null;
  status: string;
  createdAt: string;
  items: PurchaseItem[];
};
type DraftItem = {
  menuItemId: string;
  quantity: number;
  taxRatePercent: number;
};
type PrintableOrderItem = {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
  deliveryTimeDays: number | null;
  taxRatePercent: number;
};
type PrintableOrder = {
  supplier: Supplier | null;
  supplierName: string;
  date: Date;
  note: string;
  supplierConfirmation: string;
  items: PrintableOrderItem[];
};

const emptyItem: DraftItem = {
  menuItemId: "",
  quantity: 1,
  taxRatePercent: 19,
};

function euro(cents: number) {
  return formatPrice(Math.round(cents));
}

function purchaseItemName(item: PurchaseItem) {
  return item.menuItem?.name ?? item.ingredient?.name ?? "Unbekanntes Produkt";
}

function purchaseItemUnit(item: PurchaseItem) {
  return item.menuItem?.unit ?? item.ingredient?.unit ?? "";
}

export default function PurchasesPage() {
  const [tab, setTab] = useState<"orders" | "receiving" | "invoices">("orders");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [productSearches, setProductSearches] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [supplierConfirmation, setSupplierConfirmation] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; quantity: number; price: number } | null>(null);
  const [savedPurchase, setSavedPurchase] = useState<Purchase | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/purchases", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }
    const data = await response.json() as {
      purchases: Purchase[];
      suppliers: Supplier[];
      products: Product[];
    };
    setPurchases(data.purchases);
    setSuppliers(data.suppliers);
    setProducts(data.products);
  }

  useEffect(() => {
    void load();
  }, []);

  const openItems = useMemo(
    () =>
      purchases
        .flatMap((purchase) =>
          purchase.items
            .filter((item) => item.status === "ORDERED")
            .map((item) => ({ ...item, purchase })),
        )
        .filter(({ purchase, ...item }) =>
          `${purchase.supplier.name} ${purchaseItemName(item)}`.toLowerCase().includes(search.toLowerCase()),
        ),
    [purchases, search],
  );

  const receivedItems = useMemo(
    () =>
      purchases.flatMap((purchase) =>
        purchase.items
          .filter((item) => item.status === "RECEIVED")
          .map((item) => ({ ...item, purchase })),
      ),
    [purchases],
  );

  const totalGrossCents = receivedItems.reduce(
    (sum, item) => sum + (item.receivedQuantity ?? 0) * (item.receivedUnitCostCents ?? 0),
    0,
  );

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: selectedSupplierId || undefined, note, supplierConfirmation, items }),
    });
    if (!response.ok) {
      setMessage((await response.json()).error ?? "Bestellung konnte nicht gespeichert werden");
      return;
    }
    const createdPurchase = await response.json() as Purchase;
    setSavedPurchase(createdPurchase);
    setNote("");
    setSelectedSupplierId("");
    setSupplierSearch("");
    setProductSearches({});
    setSupplierConfirmation("");
    setItems([{ ...emptyItem }]);
    setMessage("Bestellung wurde angelegt. Die Druckansicht ist bereit.");
    await load();
    window.setTimeout(() => {
      document.querySelector(".purchase-print-document-visible")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function updateItem(item: PurchaseItem, purchaseId: string, action: "cancel" | "update" | "store") {
    const payload = action === "update" && editing
      ? { action, quantity: editing.quantity, unitCostCents: editing.price }
      : { action };
    const response = await fetch(`/api/admin/purchases/${purchaseId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setMessage((await response.json()).error ?? "Position konnte nicht aktualisiert werden");
      return;
    }
    setEditing(null);
    setMessage(action === "store" ? "Wareneingang wurde eingelagert." : "Position wurde aktualisiert.");
    await load();
  }

  function addItem() {
    setItems((current) => [...current, { ...emptyItem }]);
  }

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function selectProduct(index: number, menuItemId: string) {
    updateDraft(index, { menuItemId });
  }

  function productForDraft(item: DraftItem) {
    return products.find((product) => product.id === item.menuItemId) ?? null;
  }

  function supplierSearchText(supplier: Supplier) {
    return [supplier.name, supplier.email, supplier.phone, supplier.address].filter(Boolean).join(" ").toLowerCase();
  }

  function productSearchText(product: Product) {
    return [
      product.name,
      product.category,
      product.unit,
      product.quantity,
      product.priceCents,
      euro(product.priceCents),
      product.deliveryTimeDays === null ? "" : `${product.deliveryTimeDays} Tage`,
      product.supplier?.name,
      product.supplier?.email,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function selectSupplier(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setItems((current) =>
      current.map((item) => {
        const product = products.find((entry) => entry.id === item.menuItemId);
        if (!supplierId || !product || product.supplier?.id === supplierId) return item;
        return { ...item, menuItemId: "" };
      }),
    );
  }

  function productsForDraft(index: number) {
    const productSearch = (productSearches[index] ?? "").trim().toLowerCase();
    return products.filter((product) => {
      const matchesSupplier = !selectedSupplierId || product.supplier?.id === selectedSupplierId;
      const matchesSearch = !productSearch || productSearchText(product).includes(productSearch);
      return matchesSupplier && matchesSearch;
    });
  }

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchValue = supplierSearch.trim().toLowerCase();
    return !searchValue || supplierSearchText(supplier).includes(searchValue);
  });
  const selectedProducts = items.map(productForDraft).filter((product): product is Product => Boolean(product));
  const selectedSupplierNames = Array.from(
    new Set(selectedProducts.map((product) => product.supplier?.name).filter((name): name is string => Boolean(name))),
  );
  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;
  const selectedSupplierName = selectedSupplier?.name ?? (selectedSupplierNames.length === 1 ? selectedSupplierNames[0] : "");
  const hasMixedSuppliers = selectedSupplierNames.length > 1;
  const hasMissingSupplier = selectedProducts.some((product) => !product.supplier);

  function purchaseToPrintableOrder(purchase: Purchase): PrintableOrder {
    return {
      supplier: purchase.supplier,
      supplierName: purchase.supplier.name,
      date: new Date(purchase.createdAt),
      note: purchase.note ?? "",
      supplierConfirmation: purchase.supplierConfirmation ?? "",
      items: purchase.items.map((item, index) => ({
        key: item.id,
        name: purchaseItemName(item),
        quantity: item.quantity,
        unit: purchaseItemUnit(item),
        unitCostCents: item.unitCostCents,
        deliveryTimeDays: item.deliveryTimeDays,
        taxRatePercent: item.taxRatePercent,
      })),
    };
  }

  function draftToPrintableOrder(): PrintableOrder {
    const draftSupplier = selectedSupplier ?? selectedProducts.find((product) => product.supplier)?.supplier ?? null;
    return {
      supplier: draftSupplier,
      supplierName: draftSupplier?.name ?? selectedSupplierName,
      date: new Date(),
      note,
      supplierConfirmation,
      items: items.flatMap((item, index) => {
        const product = productForDraft(item);
        if (!product) return [];
        return [{
          key: `${item.menuItemId}-${index}`,
          name: product.name,
          quantity: item.quantity,
          unit: product.unit,
          unitCostCents: product.priceCents,
          deliveryTimeDays: product.deliveryTimeDays,
          taxRatePercent: item.taxRatePercent,
        }];
      }),
    };
  }

  const printableOrder = savedPurchase ? purchaseToPrintableOrder(savedPurchase) : draftToPrintableOrder();
  const printableTotalCents = printableOrder.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCostCents,
    0,
  );
  const canPrintOrder = printableOrder.items.length > 0 && (savedPurchase !== null || (!hasMissingSupplier && !hasMixedSuppliers));

  function buildOrderText(order: PrintableOrder) {
    const lines = [
      "BESTELLANFRAGE",
      `Datum: ${order.date.toLocaleDateString("de-DE")}`,
      `Lieferant: ${order.supplierName || "aus Produktdaten"}`,
      order.supplier?.email ? `E-Mail: ${order.supplier.email}` : "",
      order.supplier?.phone ? `Telefon: ${order.supplier.phone}` : "",
      order.supplier?.address ? `Adresse: ${order.supplier.address}` : "",
      order.note ? `Notiz: ${order.note}` : "",
      order.supplierConfirmation ? `Lieferantenbestätigung: ${order.supplierConfirmation}` : "",
      "",
      "Positionen:",
      ...order.items.map((item, index) => {
        const grossCents = item.quantity * item.unitCostCents;
        return `${index + 1}. ${item.name} - ${item.quantity} ${item.unit} x ${euro(item.unitCostCents)} = ${euro(grossCents)}; Lieferzeit: ${item.deliveryTimeDays ?? "-"} Tage; USt.: ${item.taxRatePercent.toFixed(2)} %`;
      }),
      "",
      `Gesamt brutto: ${euro(order.items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0))}`,
    ];
    return lines.filter((line) => line !== "").join("\n");
  }

  function printOrderForm() {
    if (!canPrintOrder) {
      setMessage("Bitte zuerst mindestens ein Produkt desselben Lieferanten auswählen.");
      return;
    }
    window.print();
  }

  async function createOrderPdf(order: PrintableOrder) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("ZEMA Einkauf", 48, y);
    doc.setFontSize(11);
    doc.text("Bestellanfrage", pageWidth - 48, y, { align: "right" });
    y += 28;
    doc.setDrawColor(17, 24, 39);
    doc.line(48, y, pageWidth - 48, y);
    y += 28;
    doc.setFont("helvetica", "normal");
    doc.text(`Datum: ${order.date.toLocaleDateString("de-DE")}`, 48, y);
    doc.text(`Lieferant: ${order.supplierName || "aus Produktdaten"}`, 48, y + 18);
    if (order.supplier?.email) doc.text(`E-Mail: ${order.supplier.email}`, 48, y + 36);
    if (order.supplier?.phone) doc.text(`Telefon: ${order.supplier.phone}`, 48, y + 54);
    y += 82;
    if (order.note) {
      doc.text(`Notiz: ${order.note}`, 48, y);
      y += 18;
    }
    if (order.supplierConfirmation) {
      doc.text(`Lieferantenbestätigung: ${order.supplierConfirmation}`, 48, y);
      y += 18;
    }
    y += 10;
    doc.setFont("helvetica", "bold");
    ["Pos.", "Produkt", "Menge", "Einheit", "Preis", "Lieferzeit", "USt.", "Gesamt"].forEach((heading, index) => {
      doc.text(heading, [48, 82, 210, 265, 330, 385, 455, 500][index], y);
    });
    y += 8;
    doc.line(48, y, pageWidth - 48, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    order.items.forEach((item, index) => {
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      const grossCents = item.quantity * item.unitCostCents;
      doc.text(String(index + 1), 48, y);
      doc.text(item.name.slice(0, 24), 82, y);
      doc.text(String(item.quantity), 210, y);
      doc.text(item.unit, 265, y);
      doc.text(euro(item.unitCostCents), 330, y);
      doc.text(`${item.deliveryTimeDays ?? "-"} Tage`, 385, y);
      doc.text(`${item.taxRatePercent.toFixed(2)} %`, 455, y);
      doc.text(euro(grossCents), 500, y);
      y += 18;
    });
    y += 8;
    doc.line(48, y, pageWidth - 48, y);
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.text(`Gesamt brutto: ${euro(order.items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0))}`, pageWidth - 48, y, { align: "right" });
    const blob = doc.output("blob");
    return new File([blob], `zema-bestellung-${order.date.toISOString().slice(0, 10)}.pdf`, { type: "application/pdf" });
  }

  async function emailOrderForm() {
    if (!canPrintOrder) {
      setMessage("Bitte zuerst mindestens ein Produkt desselben Lieferanten auswählen.");
      return;
    }
    const pdf = await createOrderPdf(printableOrder);
    if (navigator.canShare?.({ files: [pdf] })) {
      await navigator.share({
        files: [pdf],
        title: `Bestellung ${printableOrder.date.toLocaleDateString("de-DE")}`,
        text: buildOrderText(printableOrder),
      });
      return;
    }
    const downloadUrl = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = pdf.name;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setMessage("Das PDF wurde heruntergeladen. Bitte hänge es der vorbereiteten E-Mail an, falls dein Browser keine PDF-Übergabe an das Mailprogramm unterstützt.");
    window.location.href = `mailto:${printableOrder.supplier?.email ?? ""}?subject=${encodeURIComponent(`Bestellung ${printableOrder.date.toLocaleDateString("de-DE")}`)}&body=${encodeURIComponent(buildOrderText(printableOrder))}`;
  }

  return (
    <section className="purchases-page">
      <header className="admin-page-header no-print">
        <div>
          <p className="eyebrow">Beschaffung</p>
          <h1>Einkauf</h1>
          <p className="muted">Bestellung, Wareneingang und Rechnungsprüfung</p>
        </div>
        <div className="admin-actions">
          <button className="btn secondary" type="button" onClick={printOrderForm}>Drucken</button>
          <button className="btn secondary" type="button" onClick={emailOrderForm}>Per E-Mail</button>
        </div>
      </header>

      <nav className="purchase-tabs no-print" aria-label="Einkaufsbereiche">
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Bestellung</button>
        <button className={tab === "receiving" ? "active" : ""} onClick={() => setTab("receiving")}>Wareneingang</button>
        <button className={tab === "invoices" ? "active" : ""} onClick={() => setTab("invoices")}>Rechnungsprüfung</button>
      </nav>

      {message && <p className="notice no-print">{message}</p>}

      {tab === "orders" && (
        <div className="purchase-section">
          <section className={`purchase-print-document${savedPurchase ? " purchase-print-document-visible" : ""}`}>
            {savedPurchase && (
              <div className="purchase-print-actions no-print">
                <div>
                  <strong>Druckansicht der gespeicherten Bestellung</strong>
                  <small>Diese Ansicht kann gedruckt oder als PDF per Mail versendet werden.</small>
                </div>
                <button className="btn" type="button" onClick={printOrderForm}>Drucken</button>
                <button className="btn secondary" type="button" onClick={() => void emailOrderForm()}>Per E-Mail versenden</button>
                <button className="btn secondary" type="button" onClick={() => setSavedPurchase(null)}>Schließen</button>
              </div>
            )}
            <header className="purchase-print-header">
              <div>
                <p>Bestellanfrage</p>
                <h1>ZEMA Einkauf</h1>
              </div>
              <div>
                <span>Datum</span>
                <strong>{printableOrder.date.toLocaleDateString("de-DE")}</strong>
              </div>
            </header>
            <div className="purchase-print-meta">
              <div>
                <span>Lieferant</span>
                <strong>{printableOrder.supplierName || "Aus Produktdaten"}</strong>
                {printableOrder.supplier?.email && <small>{printableOrder.supplier.email}</small>}
                {printableOrder.supplier?.phone && <small>{printableOrder.supplier.phone}</small>}
                {printableOrder.supplier?.address && <small>{printableOrder.supplier.address}</small>}
              </div>
              <div>
                <span>Bestätigung vom Lieferanten</span>
                <strong>{printableOrder.supplierConfirmation || "-"}</strong>
              </div>
            </div>
            {printableOrder.note && <p className="purchase-print-note"><strong>Notiz:</strong> {printableOrder.note}</p>}
            <table className="purchase-print-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Produkt</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Preis je Einheit</th>
                  <th>Lieferzeit</th>
                  <th>USt.</th>
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {printableOrder.items.map((item, index) => {
                  const grossCents = item.quantity * item.unitCostCents;
                  return (
                    <tr key={item.key}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>{euro(item.unitCostCents)}</td>
                      <td>{item.deliveryTimeDays ?? "-"} Tage</td>
                      <td>{item.taxRatePercent.toFixed(2)} %</td>
                      <td>{euro(grossCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>Gesamt brutto</td>
                  <td>{euro(printableTotalCents)}</td>
                </tr>
              </tfoot>
            </table>
            <footer className="purchase-print-footer">
              <span>Erstellt aus dem Bestellformular</span>
              <span>Bitte Liefertermin und Verfügbarkeit bestätigen.</span>
            </footer>
          </section>

          <form className="card admin-form no-print" onSubmit={createOrder}>
            <h2>Neue Bestellung</h2>
            <div className="admin-cols">
              <label>Lieferant suchen
                <input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Name, E-Mail, Telefon, Adresse" />
              </label>
              <label>Lieferant
                <select value={selectedSupplierId} onChange={(event) => selectSupplier(event.target.value)}>
                  <option value="">Alle Lieferanten / aus Produkt übernehmen</option>
                  {filteredSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}{supplier.email ? ` · ${supplier.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>Notiz
                <input value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
            <label>Bestätigung vom Lieferanten
              <textarea value={supplierConfirmation} onChange={(event) => setSupplierConfirmation(event.target.value)} placeholder="z. B. Bestätigungsnummer oder Lieferhinweis" />
            </label>
            <div className="purchase-items-form">
              {items.map((item, index) => (
                <div className="purchase-item-form" key={index}>
                  <label>Produkt suchen
                    <input
                      value={productSearches[index] ?? ""}
                      onChange={(event) => setProductSearches((current) => ({ ...current, [index]: event.target.value }))}
                      placeholder="Name, Einheit, Preis, Lieferant, Lieferzeit"
                    />
                  </label>
                  <label>Produkt
                    <select required value={item.menuItemId} onChange={(event) => selectProduct(index, event.target.value)}>
                      <option value="">Bitte wählen</option>
                      {productsForDraft(index).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · Bestand {product.quantity} {product.unit}{product.supplier ? ` · ${product.supplier.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const product = productForDraft(item);
                    return (
                      <>
                        <label>Menge<input required type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateDraft(index, { quantity: Number(event.target.value) })} /></label>
                        <label>Mengeneinheit<input value={product?.unit ?? ""} readOnly /></label>
                        <label>Preis je Einheit<input value={product ? euro(product.priceCents) : ""} readOnly /></label>
                        <label>Lieferzeit<input value={product?.deliveryTimeDays === null || product?.deliveryTimeDays === undefined ? "" : `${product.deliveryTimeDays} Tage`} readOnly /></label>
                        <label>USt. (%)<input type="number" min="0" max="100" step="0.01" value={item.taxRatePercent} onChange={(event) => updateDraft(index, { taxRatePercent: Number(event.target.value) })} /></label>
                      </>
                    );
                  })()}
                  {items.length > 1 && <button className="btn danger" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Position entfernen</button>}
                </div>
              ))}
            </div>
            {hasMissingSupplier && <p className="muted">Bitte im Sortiment für jedes gewählte Produkt einen Lieferanten hinterlegen.</p>}
            {hasMixedSuppliers && <p className="muted">Bitte pro Bestellung nur Produkte desselben Lieferanten auswählen.</p>}
            <div className="admin-actions">
              <button className="btn secondary" type="button" onClick={addItem}>Position hinzufügen</button>
              <button className="btn" type="submit" disabled={hasMissingSupplier || hasMixedSuppliers}>Bestellung speichern</button>
            </div>
          </form>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Datum</th><th>Lieferant</th><th>Positionen</th><th>Bestätigung</th><th>Status</th></tr></thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{new Date(purchase.createdAt).toLocaleDateString("de-DE")}</td>
                    <td>{purchase.supplier.name}</td>
                    <td>{purchase.items.map((item) => `${item.quantity} ${purchaseItemUnit(item)} ${purchaseItemName(item)}`).join(", ")}</td>
                    <td>{purchase.supplierConfirmation || "—"}</td>
                    <td>{purchase.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "receiving" && (
        <div className="purchase-section">
          <div className="card receiving-search no-print">
            <label>Bestellung suchen<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Lieferant oder Produkt" /></label>
          </div>
          <div className="admin-list">
            {openItems.map(({ purchase, ...item }) => (
              <article className="card receiving-item" key={item.id}>
                <div>
                  <strong>{purchaseItemName(item)}</strong>
                  <p className="muted">{purchase.supplier.name} · Bestellung vom {new Date(purchase.createdAt).toLocaleDateString("de-DE")}</p>
                  <p>Bestellt: {item.quantity} {purchaseItemUnit(item)} · {euro(item.unitCostCents)} je Einheit · Lieferzeit: {item.deliveryTimeDays ?? "—"} Tage</p>
                </div>
                {editing?.id === item.id ? (
                  <div className="receiving-edit no-print">
                    <label>Menge<input type="number" min="0.001" step="0.001" value={editing.quantity} onChange={(event) => setEditing({ ...editing, quantity: Number(event.target.value) })} /></label>
                    <label>Preis (Cent)<input type="number" min="0" value={editing.price} onChange={(event) => setEditing({ ...editing, price: Number(event.target.value) })} /></label>
                    <button className="btn" onClick={() => updateItem(item, purchase.id, "update")}>Speichern</button>
                    <button className="btn secondary" onClick={() => setEditing(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="admin-actions no-print">
                    <button className="btn danger" onClick={() => updateItem(item, purchase.id, "cancel")}>Stornieren</button>
                    <button className="btn secondary" onClick={() => setEditing({ id: item.id, quantity: item.quantity, price: item.unitCostCents })}>Ändern</button>
                    <button className="btn" onClick={() => updateItem(item, purchase.id, "store")}>Einlagern</button>
                  </div>
                )}
              </article>
            ))}
            {openItems.length === 0 && <p className="muted">Keine offenen Bestellpositionen gefunden.</p>}
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div className="purchase-section">
          <div className="metric-grid">
            <div className="card metric"><span>Bruttoumsatz</span><strong>{euro(totalGrossCents)}</strong></div>
            <div className="card metric"><span>Positionen</span><strong>{receivedItems.length}</strong></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lieferant</th><th>Produkt</th><th>Menge</th><th>Preis</th><th>USt.</th><th>Umsatz brutto</th><th>Umsatz netto</th></tr></thead>
              <tbody>
                {receivedItems.map(({ purchase, ...item }) => {
                  const grossCents = (item.receivedQuantity ?? 0) * (item.receivedUnitCostCents ?? 0);
                  const taxCents = grossCents * item.taxRatePercent / (100 + item.taxRatePercent);
                  return <tr key={item.id}>
                    <td>{purchase.supplier.name}</td>
                    <td>{purchaseItemName(item)}</td>
                    <td>{item.receivedQuantity} {purchaseItemUnit(item)}</td>
                    <td>{euro(item.receivedUnitCostCents ?? 0)}</td>
                    <td>{item.taxRatePercent.toFixed(2)} %<br /><small>{euro(taxCents)}</small></td>
                    <td>{euro(grossCents)}</td>
                    <td>{euro(grossCents - taxCents)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
