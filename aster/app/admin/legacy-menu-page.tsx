"use client";

import { ChangeEvent, SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { formatPrice } from "@/lib/format";

type Category = "FOOD" | "DRINK" | "COFFEE";

type Item = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  priceCents: number;
  category: Category;
  available: boolean;
  sortOrder: number;
  quantity: number;
  unit: string;
  deliveryTimeDays: number | null;
  supplierId: string | null;
};

type DisplayItem = Item & {
  isExcelPreview?: boolean;
  excelRowIndex?: number;
  excelErrors?: string[];
  existingImportId?: string;
  excelSaved?: boolean;
};

type PreviewRow = {
  index: number;
  raw: Record<string, any>;
  parsed: {
    id?: string;
    name: string;
    description: string;
    imageUrl?: string | null;
    priceCents: number;
    category: Category;
    available: boolean;
    sortOrder: number;
    quantity: number;
    unit: "Stück" | "Kilogramm" | "Gramm" | "Liter";
    deliveryTimeDays?: number | null;
    supplierId?: string | null;
  };
  errors: string[];
};

const ALLOWED_DB_COLUMNS = [
  "name",
  "description",
  "priceCents",
  "category",
  "available",
  "sortOrder",
  "quantity",
  "unit",
  "deliveryTimeDays",
  "supplierId",
  "imageUrl",
  "id",
];

const empty = {
  name: "",
  description: "",
  imageUrl: "",
  price: "",
  category: "FOOD" as Category,
  available: true,
  sortOrder: 0,
};

const emptyExcelEditForm = {
  name: "",
  description: "",
  imageUrl: "",
  price: "",
  category: "FOOD" as Category,
  available: true,
  sortOrder: 0,
  quantity: 0,
  unit: "Stück" as "Stück" | "Kilogramm" | "Gramm" | "Liter",
  deliveryTimeDays: "",
  supplierId: "",
};

export default function MenuAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Excel Upload / Preview State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelFileName, setExcelFileName] = useState("");
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnValidationErrors, setColumnValidationErrors] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [showExcelTools, setShowExcelTools] = useState(false);
  const [editingExcelRowIndex, setEditingExcelRowIndex] = useState<number | null>(null);
  const [excelEditForm, setExcelEditForm] = useState({ ...emptyExcelEditForm });
  const [savedExcelRowIndexes, setSavedExcelRowIndexes] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk Edit / Massenbearbeitung State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkField, setBulkField] = useState<string>("available");
  const [bulkValue, setBulkValue] = useState<any>("true");
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // Filter & Ansicht State für die Liste
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"ALL" | Category>("ALL");
  const [filterAvailability, setFilterAvailability] = useState<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  async function load() {
    const r = await fetch("/api/admin/menu", { cache: "no-store" });
    if (r.status === 401) {
      if (typeof window !== "undefined") {
        if (window.location.pathname.startsWith("/backoffice")) {
          window.location.href = "/backoffice";
        } else {
          window.location.href = "/admin";
        }
      }
      return;
    }
    if (r.ok) {
      const data = await r.json();
      setItems(data);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function edit(x: Item) {
    setEditing(x.id);
    setForm({
      name: x.name,
      description: x.description || "",
      imageUrl: x.imageUrl || "",
      price: (x.priceCents / 100).toFixed(2),
      category: x.category,
      available: x.available,
      sortOrder: x.sortOrder,
    });
    scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(form.price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setMsg("Bitte einen gültigen Preis eingeben.");
      return;
    }

    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      priceCents,
      category: form.category,
      available: form.available,
      sortOrder: Number(form.sortOrder),
      unit: "Stück",
    };

    const r = await fetch(editing ? `/api/admin/menu/${editing}` : "/api/admin/menu", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      setForm({ ...empty });
      setEditing(null);
      setMsg("Gespeichert.");
      load();
    } else {
      const err = await r.json().catch(() => ({}));
      setMsg(err.error || "Fehler beim Speichern");
    }
  }

  async function del(id: string) {
    if (!confirm("Produkt wirklich löschen?")) return;
    const r = await fetch(`/api/admin/menu/${id}`, { method: "DELETE" });
    if (r.ok) {
      load();
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } else {
      const err = await r.json().catch(() => ({}));
      setMsg(err.error || "Löschen fehlgeschlagen");
    }
  }

  const excelPreviewItems = useMemo<DisplayItem[]>(() => {
    return previewRows.map((row) => ({
      id: `excel-preview-${row.index}`,
      name: row.parsed.name || `Excel-Zeile ${row.index}`,
      description: row.parsed.description || "",
      imageUrl: row.parsed.imageUrl,
      priceCents: row.parsed.priceCents,
      category: row.parsed.category,
      available: row.parsed.available,
      sortOrder: row.parsed.sortOrder,
      quantity: row.parsed.quantity,
      unit: row.parsed.unit,
      deliveryTimeDays: row.parsed.deliveryTimeDays ?? null,
      supplierId: row.parsed.supplierId ?? null,
      isExcelPreview: true,
      excelRowIndex: row.index,
      excelErrors: row.errors,
      existingImportId: row.parsed.id,
      excelSaved: savedExcelRowIndexes.includes(row.index),
    }));
  }, [previewRows, savedExcelRowIndexes]);

  const displayItems = useMemo<DisplayItem[]>(
    () => [...excelPreviewItems, ...items],
    [excelPreviewItems, items]
  );

  // Gefilterte Items für die Anzeige
  const filteredItems = useMemo(() => {
    return displayItems.filter((item) => {
      // 1. Suche
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      // 2. Kategorie
      if (filterCategory !== "ALL" && item.category !== filterCategory) {
        return false;
      }
      // 3. Verfügbarkeit
      if (filterAvailability === "AVAILABLE" && !item.available) {
        return false;
      }
      if (filterAvailability === "UNAVAILABLE" && item.available) {
        return false;
      }
      return true;
    });
  }, [displayItems, searchQuery, filterCategory, filterAvailability]);

  // ==================== EXCEL VERARBEITUNG ====================

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setExcelFileName(file.name);
    setSavedExcelRowIndexes([]);
    parseExcel(file);
  }

  async function parseExcel(file: File) {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setColumnValidationErrors(["Die Excel-Datei enthält keine Tabellenblätter."]);
        setShowPreviewModal(true);
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

      if (!rawJson || rawJson.length === 0) {
        setColumnValidationErrors(["Die Excel-Tabelle enthält keine Zeilen oder Daten."]);
        setShowPreviewModal(true);
        return;
      }

      // 1. Spalten auslesen
      const headers = Object.keys(rawJson[0]).map((h) => h.trim());
      setExcelColumns(headers);

      // 2. Prüfen auf Namensgleichheit mit DB-Spalten
      // Erlaubt: name, description, priceCents, category, available, sortOrder, quantity, unit, deliveryTimeDays, supplierId, imageUrl, id
      // Sowie Hilfs-Aliase: price, preis
      const errors: string[] = [];
      const invalidHeaders = headers.filter(
        (col) =>
          !ALLOWED_DB_COLUMNS.includes(col) &&
          col.toLowerCase() !== "price" &&
          col.toLowerCase() !== "preis"
      );

      if (invalidHeaders.length > 0) {
        errors.push(
          `Ungültige Spaltenüberschriften gefunden: [${invalidHeaders.join(
            ", "
          )}]. Die Spalten müssen exakt den Datenbankfeldern entsprechen: [${ALLOWED_DB_COLUMNS.filter(
            (c) => c !== "id"
          ).join(", ")}] (oder 'price' / 'preis').`
        );
      }

      if (!headers.includes("name")) {
        errors.push("Die Pflichtspalte 'name' fehlt in den Tabellenüberschriften.");
      }

      const hasPrice =
        headers.includes("priceCents") ||
        headers.some((h) => h.toLowerCase() === "price" || h.toLowerCase() === "preis");
      if (!hasPrice) {
        errors.push("Die Preis-Spalte ('priceCents' oder 'price'/'preis') fehlt.");
      }

      setColumnValidationErrors(errors);

      // 3. Zeilen parsen & validieren für die Preview
      const parsedRows: PreviewRow[] = rawJson.map((row, idx) => {
        const rowErrors: string[] = [];
        const name = String(row.name || "").trim();
        if (!name) rowErrors.push("Name fehlt");

        // Preis berechnen
        let priceCents = 0;
        if (row.priceCents !== undefined && row.priceCents !== "") {
          priceCents = Math.round(Number(row.priceCents));
        } else if (row.price !== undefined && row.price !== "") {
          priceCents = Math.round(Number(String(row.price).replace(",", ".")) * 100);
        } else if (row.preis !== undefined && row.preis !== "") {
          priceCents = Math.round(Number(String(row.preis).replace(",", ".")) * 100);
        } else {
          rowErrors.push("Preis fehlt");
        }

        if (isNaN(priceCents) || priceCents < 0) {
          rowErrors.push("Ungültiger Preis");
        }

        // Kategorie prüfen
        let category: Category = "FOOD";
        const rawCat = String(row.category || "").toUpperCase().trim();
        if (rawCat) {
          if (rawCat === "FOOD" || rawCat === "SPEISE" || rawCat === "ESSEN") category = "FOOD";
          else if (rawCat === "DRINK" || rawCat === "GETRÄNK" || rawCat === "GETRAENK")
            category = "DRINK";
          else if (rawCat === "COFFEE" || rawCat === "KAFFEE") category = "COFFEE";
          else {
            rowErrors.push(`Unbekannte Kategorie '${row.category}' (Erlaubt: FOOD, DRINK, COFFEE)`);
          }
        }

        // Verfügbarkeit
        let available = true;
        if (row.available !== undefined && row.available !== "") {
          const rawAvail = String(row.available).toLowerCase().trim();
          if (["false", "0", "nein", "no", "f", "n"].includes(rawAvail)) available = false;
        }

        // Mengeneinheit
        let unit: "Stück" | "Kilogramm" | "Gramm" | "Liter" = "Stück";
        if (row.unit !== undefined && row.unit !== "") {
          const rawUnit = String(row.unit).trim();
          if (["Stück", "Kilogramm", "Gramm", "Liter"].includes(rawUnit)) {
            unit = rawUnit as any;
          } else {
            rowErrors.push(`Ungültige Einheit '${row.unit}'`);
          }
        }

        return {
          index: idx + 1,
          raw: row,
          parsed: {
            id: row.id ? String(row.id).trim() : undefined,
            name,
            description: String(row.description || "").trim(),
            imageUrl: row.imageUrl ? String(row.imageUrl).trim() : null,
            priceCents,
            category,
            available,
            sortOrder: Number(row.sortOrder) || 0,
            quantity: Number(row.quantity) || 0,
            unit,
            deliveryTimeDays:
              row.deliveryTimeDays !== undefined && row.deliveryTimeDays !== ""
                ? Number(row.deliveryTimeDays)
                : null,
            supplierId: row.supplierId ? String(row.supplierId).trim() : null,
          },
          errors: rowErrors,
        };
      });

      setPreviewRows(parsedRows);
      setShowPreviewModal(false);
      setMsg(
        errors.length > 0
          ? `${parsedRows.length} Excel-Datensatz/-sätze gelesen und in der Liste angezeigt. Bitte Warnungen prüfen.`
          : `${parsedRows.length} Excel-Datensatz/-sätze erfolgreich gelesen und oben in der Liste als neue Excel-Vorschau markiert.`
      );
    } catch (err: any) {
      setColumnValidationErrors([`Fehler beim Einlesen der Excel-Datei: ${err?.message || err}`]);
      setShowPreviewModal(true);
    }
  }

  async function handleSaveExcelImport() {
    if (columnValidationErrors.length > 0) {
      const shouldContinue = confirm(
        `Es liegen Warnungen zur Excel-Datei vor:\n\n${columnValidationErrors.join(
          "\n"
        )}\n\nGültige Zeilen werden trotzdem gespeichert. Fortfahren?`
      );
      if (!shouldContinue) return;
    }

    const hasRowErrors = previewRows.some((r) => r.errors.length > 0);
    if (hasRowErrors) {
      if (
        !confirm(
          "Einige Zeilen weisen Fehler auf und werden eventuell nicht korrekt gespeichert. Fortfahren?"
        )
      ) {
        return;
      }
    }

    setIsSavingBulk(true);
    try {
      const itemsToSave = previewRows
        .filter((r) => r.errors.length === 0)
        .map((r) => r.parsed);
      if (itemsToSave.length === 0) {
        alert("Es gibt keine gültigen Excel-Zeilen zum Speichern. Bitte Warnungen und Zeilenfehler prüfen.");
        return;
      }

      const res = await fetch("/api/admin/menu/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: excelColumns.map((c) =>
            c.toLowerCase() === "price" || c.toLowerCase() === "preis" ? "priceCents" : c
          ).filter((c) => ALLOWED_DB_COLUMNS.includes(c as any)),
          items: itemsToSave,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        alert(`Erfolg: ${resData.message}`);
        setShowPreviewModal(false);
        setExcelFile(null);
        setExcelFileName("");
        setExcelColumns([]);
        setPreviewRows([]);
        setColumnValidationErrors([]);
        setSavedExcelRowIndexes([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        load();
      } else {
        alert(`Fehler beim Speichern: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Fehler: ${err?.message || "Konnte nicht gespeichert werden."}`);
    } finally {
      setIsSavingBulk(false);
    }
  }

  function openExcelRowEditor(rowIndex: number) {
    const row = previewRows.find((item) => item.index === rowIndex);
    if (!row) {
      alert("Excel-Zeile nicht gefunden.");
      return;
    }

    setEditingExcelRowIndex(rowIndex);
    setExcelEditForm({
      name: row.parsed.name,
      description: row.parsed.description || "",
      imageUrl: row.parsed.imageUrl || "",
      price: (row.parsed.priceCents / 100).toFixed(2),
      category: row.parsed.category,
      available: row.parsed.available,
      sortOrder: row.parsed.sortOrder,
      quantity: row.parsed.quantity,
      unit: row.parsed.unit,
      deliveryTimeDays:
        row.parsed.deliveryTimeDays === null || row.parsed.deliveryTimeDays === undefined
          ? ""
          : String(row.parsed.deliveryTimeDays),
      supplierId: row.parsed.supplierId || "",
    });
  }

  function parseExcelEditForm() {
    const errors: string[] = [];
    const name = excelEditForm.name.trim();
    const priceCents = Math.round(Number(excelEditForm.price.replace(",", ".")) * 100);
    const sortOrder = Number(excelEditForm.sortOrder);
    const quantity = Number(excelEditForm.quantity);
    const deliveryTimeDays =
      excelEditForm.deliveryTimeDays.trim() === "" ? null : Number(excelEditForm.deliveryTimeDays);

    if (!name) errors.push("Name fehlt");
    if (!Number.isFinite(priceCents) || priceCents < 0) errors.push("Preis ist ungültig");
    if (!Number.isFinite(sortOrder)) errors.push("Sortierung ist ungültig");
    if (!Number.isFinite(quantity)) errors.push("Bestand ist ungültig");
    if (deliveryTimeDays !== null && (!Number.isFinite(deliveryTimeDays) || deliveryTimeDays < 0)) {
      errors.push("Lieferzeit ist ungültig");
    }

    return {
      parsed: {
        name,
        description: excelEditForm.description.trim(),
        imageUrl: excelEditForm.imageUrl.trim() || null,
        priceCents,
        category: excelEditForm.category,
        available: excelEditForm.available,
        sortOrder,
        quantity,
        unit: excelEditForm.unit,
        deliveryTimeDays,
        supplierId: excelEditForm.supplierId.trim() || null,
      },
      errors,
    };
  }

  async function handleSaveEditedExcelRow(e: SubmitEvent) {
    e.preventDefault();
    if (editingExcelRowIndex === null) return;

    const { parsed, errors } = parseExcelEditForm();
    setPreviewRows((currentRows) =>
      currentRows.map((row) =>
        row.index === editingExcelRowIndex
          ? {
              ...row,
              parsed: {
                ...row.parsed,
                ...parsed,
              },
              errors,
            }
          : row
      )
    );

    if (errors.length > 0) {
      alert(`Bitte korrigieren: ${errors.join(", ")}`);
      return;
    }

    setIsSavingBulk(true);
    try {
      const existingRow = previewRows.find((row) => row.index === editingExcelRowIndex);
      const res = await fetch("/api/admin/menu/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: [
            "id",
            "name",
            "description",
            "priceCents",
            "category",
            "available",
            "sortOrder",
            "quantity",
            "unit",
            "deliveryTimeDays",
            "supplierId",
            "imageUrl",
          ],
          items: [
            {
              ...(existingRow?.parsed.id ? { id: existingRow.parsed.id } : {}),
              ...parsed,
            },
          ],
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setSavedExcelRowIndexes((current) =>
          current.includes(editingExcelRowIndex) ? current : [...current, editingExcelRowIndex]
        );
        setEditingExcelRowIndex(null);
        setExcelEditForm({ ...emptyExcelEditForm });
        setMsg(`Excel-Zeile ${editingExcelRowIndex} wurde erfolgreich gespeichert.`);
      } else {
        alert(`Fehler beim Speichern: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Fehler: ${err?.message || "Konnte nicht gespeichert werden."}`);
    } finally {
      setIsSavingBulk(false);
    }
  }

  // ==================== MASSENBEARBEITUNG & LÖSCHEN ====================

  function toggleSelectAll() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleBulkUpdate(e: SubmitEvent) {
    e.preventDefault();
    const applyToAll = selectedIds.length === 0 || selectedIds.length === items.length;

    const confirmMsg = applyToAll
      ? `Möchtest du das Feld '${bulkField}' wirklich für ALLE (${items.length}) Speisekarten-Positionen ändern?`
      : `Möchtest du das Feld '${bulkField}' für die ${selectedIds.length} ausgewählten Positionen ändern?`;

    if (!confirm(confirmMsg)) return;

    let parsedVal: any = bulkValue;
    if (bulkField === "priceCents") {
      parsedVal = Math.round(Number(String(bulkValue).replace(",", ".")) * 100);
      if (isNaN(parsedVal) || parsedVal < 0) {
        alert("Bitte einen gültigen Preis eingeben.");
        return;
      }
    } else if (bulkField === "available") {
      parsedVal = bulkValue === "true" || bulkValue === true;
    } else if (bulkField === "sortOrder" || bulkField === "quantity" || bulkField === "deliveryTimeDays") {
      parsedVal = bulkValue === "" ? null : Number(bulkValue);
    }

    setIsUpdatingBulk(true);
    try {
      const res = await fetch("/api/admin/menu/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: applyToAll ? undefined : selectedIds,
          updates: {
            [bulkField]: parsedVal,
          },
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        alert(`Erfolg: ${resData.message}`);
        setShowBulkEditModal(false);
        load();
      } else {
        alert(`Fehler: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Fehler: ${err?.message || "Aktualisierung fehlgeschlagen."}`);
    } finally {
      setIsUpdatingBulk(false);
    }
  }

  async function handleBulkDelete() {
    const applyToAll = selectedIds.length === 0;
    const confirmMsg = applyToAll
      ? `ACHTUNG: Möchtest du wirklich die GESAMTE Speisekarte (${items.length} Positionen) löschen?`
      : `Möchtest du die ${selectedIds.length} ausgewählten Positionen wirklich löschen?`;

    if (!confirm(confirmMsg)) return;
    if (applyToAll && !confirm("Bist du dir ganz sicher? Diese Aktion kann nicht rückgängig gemacht werden!")) {
      return;
    }

    try {
      const res = await fetch("/api/admin/menu/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: applyToAll ? undefined : selectedIds,
          deleteAll: applyToAll,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        alert(`Erfolg: ${resData.message}`);
        setSelectedIds([]);
        load();
      } else {
        alert(`Fehler beim Löschen: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`Fehler: ${err?.message || "Löschen fehlgeschlagen."}`);
    }
  }

  function downloadTemplateExcel() {
    const sampleData = [
      {
        name: "Beispiel Pizza Margherita",
        description: "Mit frischem Basilikum und Mozzarella",
        priceCents: 950,
        category: "FOOD",
        available: true,
        sortOrder: 1,
        quantity: 50,
        unit: "Stück",
        imageUrl: "",
      },
      {
        name: "Espresso",
        description: "Kräftiger äthiopischer Hochland-Espresso",
        priceCents: 280,
        category: "COFFEE",
        available: true,
        sortOrder: 2,
        quantity: 100,
        unit: "Stück",
        imageUrl: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Speisekarte");
    XLSX.writeFile(wb, "Aster_Speisekarte_Vorlage.xlsx");
  }

  function exportCurrentMenuExcel() {
    const exportData = items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description || "",
      priceCents: i.priceCents,
      category: i.category,
      available: i.available,
      sortOrder: i.sortOrder,
      quantity: i.quantity,
      unit: i.unit,
      deliveryTimeDays: i.deliveryTimeDays,
      supplierId: i.supplierId,
      imageUrl: i.imageUrl || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Speisekarte");
    XLSX.writeFile(wb, `Aster_Speisekarte_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Sortiment</p>
          <h1>Speisekarte Verwaltung</h1>
          <p className="muted">
            Verwalte Speisen, Getränke und Kaffeespezialitäten manuell oder via Excel-Import.
          </p>
        </div>
      </header>

      {/* TOOLBAR FÜR EXCEL UPLOAD, EXPORT & MASSENAKTIONEN */}
      <section className="card" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn secondary"
            onClick={() => setShowExcelTools((open) => !open)}
            aria-expanded={showExcelTools}
            title="Excel-Verarbeitung ein- oder ausblenden"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "999px",
              fontWeight: 800,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>📊</span>
            Excel-Verarbeitung
            <span style={{ fontSize: "0.75rem" }}>{showExcelTools ? "▲" : "▼"}</span>
          </button>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginLeft: "auto" }}>
            <button
              type="button"
              className="btn"
              style={{ background: "#2563eb", borderColor: "#1d4ed8" }}
              onClick={() => setShowBulkEditModal(true)}
            >
              ✏️ Massenbearbeitung {selectedIds.length > 0 ? `(${selectedIds.length})` : "(Alle)"}
            </button>
            <button
              type="button"
              className="danger"
              onClick={handleBulkDelete}
              style={{
                background: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                padding: "13px 20px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              🗑️ {selectedIds.length > 0 ? `Auswahl (${selectedIds.length}) löschen` : "Alle löschen"}
            </button>
          </div>
        </div>

        {showExcelTools && (
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #e2e8f0",
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Excel-Schnittstelle</h2>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
                Datei lesen, Datensätze direkt in der Liste als neue Vorschau markieren und danach speichern.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span>📁</span> Excel-Datei hochladen
              </button>

              <button
                type="button"
                className="btn secondary"
                onClick={downloadTemplateExcel}
                title="Muster-Excel mit allen korrekten Datenbank-Spalten herunterladen"
              >
                📥 Excel-Vorlage laden
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={exportCurrentMenuExcel}
                title="Aktuelle Speisekarte als Excel herunterladen"
              >
                📤 Aktuelle Karte exportieren
              </button>
            </div>

            {excelFileName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: columnValidationErrors.length > 0 ? "#fffbeb" : "#ecfdf5",
                  border: `1px solid ${columnValidationErrors.length > 0 ? "#fde68a" : "#bbf7d0"}`,
                  color: columnValidationErrors.length > 0 ? "#92400e" : "#166534",
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  Ausgewählte Datei: <strong>{excelFileName}</strong>
                  {excelPreviewItems.length > 0 && (
                    <span> - {excelPreviewItems.length} neue Datensätze in der Liste markiert</span>
                  )}
                  {columnValidationErrors.length > 0 && <span> - Warnungen gefunden</span>}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: "7px 12px", fontSize: "0.82rem" }}
                    onClick={() => setShowPreviewModal(true)}
                  >
                    Preview / Warnungen anzeigen
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "7px 12px", fontSize: "0.82rem" }}
                    onClick={handleSaveExcelImport}
                    disabled={isSavingBulk || previewRows.length === 0}
                  >
                    {isSavingBulk ? "Speichern..." : "Excel-Daten speichern"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: "7px 12px", fontSize: "0.82rem" }}
                    onClick={() => {
                      setExcelFile(null);
                      setExcelFileName("");
                      setExcelColumns([]);
                      setPreviewRows([]);
                      setColumnValidationErrors([]);
                      setSavedExcelRowIndexes([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Excel-Vorschau entfernen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* MANUELLES ANLEGEN / BEARBEITEN */}
      <form onSubmit={save} className="card admin-form" style={{ marginBottom: "28px" }}>
        <h2>{editing ? "Produkt bearbeiten" : "Neues Produkt anlegen"}</h2>
        <label>
          Name *
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="z. B. Aster Spezialteller"
          />
        </label>
        <label>
          Beschreibung
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Beschreibung der Zutaten und Zubereitung..."
          />
        </label>
        <label>
          Bild-URL
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://... oder /aster-logo.png"
          />
        </label>
        <div className="admin-cols">
          <label>
            Preis in € *
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
              placeholder="z. B. 14,50"
            />
          </label>
          <label>
            Kategorie
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            >
              <option value="FOOD">Speise</option>
              <option value="DRINK">Getränk</option>
              <option value="COFFEE">Kaffee</option>
            </select>
          </label>
          <label>
            Sortierung
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="check" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm({ ...form, available: e.target.checked })}
          />{" "}
          Im QR-Menü und Onlineshop verfügbar
        </label>
        <div className="actions" style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
          <button className="btn">{editing ? "Änderungen speichern" : "Produkt erstellen"}</button>
          {editing && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setEditing(null);
                setForm({ ...empty });
              }}
            >
              Abbrechen
            </button>
          )}
        </div>
        {msg && <p style={{ marginTop: "10px", fontWeight: "bold" }}>{msg}</p>}
      </form>

      {/* PRODUKTLISTE MIT FILTERN, STATS, ACTIONS & CHECKBOXEN */}
      <section>
        {/* Header & Quick-Stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>🍽️</span> Speisekarte & Sortiment
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                }}
              >
                {filteredItems.length} von {displayItems.length} Positionen
              </span>
            </h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
              Übersicht aller Gerichte, Getränke und Artikel. Schnelle Bearbeitung, Filter und Massenverwaltung.
              {excelPreviewItems.length > 0 && (
                <strong style={{ color: "#166534" }}>
                  {" "}
                  {excelPreviewItems.length} Excel-Datensatz/-sätze sind als neue Vorschau markiert und noch nicht gespeichert.
                </strong>
              )}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Ansicht wechseln: Grid vs Tabelle */}
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: "3px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                style={{
                  padding: "6px 12px",
                  border: 0,
                  borderRadius: "8px",
                  background: viewMode === "grid" ? "#fff" : "transparent",
                  color: viewMode === "grid" ? "#0f172a" : "#64748b",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  boxShadow: viewMode === "grid" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                🔲 Karten
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                style={{
                  padding: "6px 12px",
                  border: 0,
                  borderRadius: "8px",
                  background: viewMode === "table" ? "#fff" : "transparent",
                  color: viewMode === "table" ? "#0f172a" : "#64748b",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                📄 Tabelle
              </button>
            </div>

            <button
              type="button"
              className="btn secondary"
              style={{ padding: "8px 14px", fontSize: "0.85rem", fontWeight: 700 }}
              onClick={toggleSelectAll}
            >
              {selectedIds.length === items.length && items.length > 0 ? "Auswahl aufheben" : `Alle auswählen (${items.length})`}
            </button>
          </div>
        </div>

        {/* Filter- & Suchleiste */}
        <div
          className="card"
          style={{
            padding: "16px",
            marginBottom: "20px",
            background: "#ffffff",
            display: "grid",
            gap: "12px",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Volltextsuche */}
            <div style={{ flex: "1 1 240px", position: "relative" }}>
              <input
                type="text"
                placeholder="🔍 Nach Name oder Beschreibung suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: 0,
                    background: "transparent",
                    color: "#94a3b8",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Kategorie Filter Buttons */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setFilterCategory("ALL")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: filterCategory === "ALL" ? "#14532d" : "#e2e8f0",
                  background: filterCategory === "ALL" ? "#14532d" : "#f8fafc",
                  color: filterCategory === "ALL" ? "#fff" : "#334155",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  transition: "all 0.15s ease",
                }}
              >
                Alle ({displayItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory("FOOD")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: filterCategory === "FOOD" ? "#14532d" : "#e2e8f0",
                  background: filterCategory === "FOOD" ? "#14532d" : "#f8fafc",
                  color: filterCategory === "FOOD" ? "#fff" : "#334155",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  transition: "all 0.15s ease",
                }}
              >
                🥘 Speisen ({displayItems.filter((i) => i.category === "FOOD").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory("DRINK")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: filterCategory === "DRINK" ? "#14532d" : "#e2e8f0",
                  background: filterCategory === "DRINK" ? "#14532d" : "#f8fafc",
                  color: filterCategory === "DRINK" ? "#fff" : "#334155",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  transition: "all 0.15s ease",
                }}
              >
                🍹 Getränke ({displayItems.filter((i) => i.category === "DRINK").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory("COFFEE")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: filterCategory === "COFFEE" ? "#14532d" : "#e2e8f0",
                  background: filterCategory === "COFFEE" ? "#14532d" : "#f8fafc",
                  color: filterCategory === "COFFEE" ? "#fff" : "#334155",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  transition: "all 0.15s ease",
                }}
              >
                ☕ Kaffee ({displayItems.filter((i) => i.category === "COFFEE").length})
              </button>
            </div>

            {/* Status Filter */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#64748b" }}>Status:</label>
              <select
                value={filterAvailability}
                onChange={(e) => setFilterAvailability(e.target.value as any)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  background: "#fff",
                }}
              >
                <option value="ALL">Alle Status</option>
                <option value="AVAILABLE">Nur Verfügbar</option>
                <option value="UNAVAILABLE">Nur Deaktiviert</option>
              </select>
            </div>
          </div>

          {/* Anzeige selektierter Items Info-Leiste */}
          {selectedIds.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                fontSize: "0.88rem",
                color: "#1e40af",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>✅</span>
                <strong>{selectedIds.length} Position(en) ausgewählt</strong>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowBulkEditModal(true)}
                  style={{
                    padding: "4px 10px",
                    background: "#2563eb",
                    color: "#fff",
                    border: 0,
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Auswahl bearbeiten
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  style={{
                    padding: "4px 10px",
                    background: "#dc2626",
                    color: "#fff",
                    border: 0,
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Auswahl löschen
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Auswahl leeren
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LISTE ANZEIGEN (GRID ODER TABELLE) */}
        {filteredItems.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "40px 20px",
              textAlign: "center",
              background: "#fff",
              borderRadius: "18px",
              border: "1px dashed #cbd5e1",
            }}
          >
            <p style={{ fontSize: "2rem", margin: "0 0 10px" }}>🔍</p>
            <h3 style={{ margin: "0 0 6px", color: "#334155" }}>Keine Speisen oder Getränke gefunden</h3>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Passen Sie Ihre Such- oder Filterkriterien an oder erstellen Sie einen neuen Artikel.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* ================= GRID VIEW ================= */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {filteredItems.map((x) => {
              const isSelected = selectedIds.includes(x.id);
              const isEditingThis = editing === x.id;
              const isExcelPreview = x.isExcelPreview === true;
              const isExcelSaved = x.excelSaved === true;
              const hasExcelErrors = !isExcelSaved && (x.excelErrors?.length ?? 0) > 0;

              return (
                <article
                  key={x.id}
                  className="card"
                  style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    borderRadius: "18px",
                    background: isExcelPreview
                      ? isExcelSaved
                        ? "#eff6ff"
                        : hasExcelErrors
                        ? "#fff7ed"
                        : "#ecfdf5"
                      : isSelected
                      ? "#f0fdf4"
                      : isEditingThis
                      ? "#fefce8"
                      : "#ffffff",
                    border: isExcelPreview
                      ? isExcelSaved
                        ? "2px solid #2563eb"
                        : hasExcelErrors
                        ? "2px solid #f97316"
                        : "2px solid #22c55e"
                      : isSelected
                      ? "2px solid #16a34a"
                      : isEditingThis
                      ? "2px solid #ca8a04"
                      : "1px solid rgba(148,163,184,0.22)",
                    boxShadow: isSelected
                      ? "0 10px 25px rgba(22,163,74,0.12)"
                      : "0 8px 24px rgba(15,23,42,0.05)",
                    transition: "all 0.2s ease",
                    position: "relative",
                  }}
                >
                  {/* Top Bar mit Checkbox, Kategorie & Status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isExcelPreview}
                        onChange={() => toggleSelectOne(x.id)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: isExcelPreview ? "not-allowed" : "pointer",
                          accentColor: "#14532d",
                          opacity: isExcelPreview ? 0.35 : 1,
                        }}
                        title={isExcelPreview ? "Excel-Vorschau kann erst nach dem Speichern bearbeitet werden" : "Auswählen"}
                      />
                      {/* Kategorie Badge */}
                      <span
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 800,
                          padding: "3px 10px",
                          borderRadius: "999px",
                          background:
                            x.category === "FOOD"
                              ? "#fef3c7"
                              : x.category === "DRINK"
                              ? "#e0f2fe"
                              : "#fae8ff",
                          color:
                            x.category === "FOOD"
                              ? "#92400e"
                              : x.category === "DRINK"
                              ? "#0369a1"
                              : "#86198f",
                          border: `1px solid ${
                            x.category === "FOOD"
                              ? "#fde68a"
                              : x.category === "DRINK"
                              ? "#bae6fd"
                              : "#f5d0fe"
                          }`,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {x.category === "FOOD" ? "🥘 Speise" : x.category === "DRINK" ? "🍹 Getränk" : "☕ Kaffee"}
                      </span>
                    </div>

                    {/* Verfügbarkeit Badge */}
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: "999px",
                        background: x.available ? "#dcfce7" : "#fee2e2",
                        color: x.available ? "#166534" : "#991b1b",
                        border: `1px solid ${x.available ? "#bbf7d0" : "#fca5a5"}`,
                      }}
                    >
                      {x.available ? "● Aktiv" : "○ Inaktiv"}
                    </span>
                  </div>

                  {isExcelPreview && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "12px",
                        padding: "8px 10px",
                        borderRadius: "12px",
                        background: hasExcelErrors ? "#ffedd5" : isExcelSaved ? "#dbeafe" : "#dcfce7",
                        border: `1px solid ${hasExcelErrors ? "#fdba74" : isExcelSaved ? "#93c5fd" : "#86efac"}`,
                        color: hasExcelErrors ? "#9a3412" : isExcelSaved ? "#1d4ed8" : "#166534",
                        fontSize: "0.8rem",
                        fontWeight: 800,
                      }}
                    >
                      <span>
                        {isExcelSaved
                          ? `✅ Gespeichert - Excel-Zeile ${x.excelRowIndex}`
                          : `✨ Neu aus Excel gelesen - Zeile ${x.excelRowIndex}`}
                      </span>
                      {hasExcelErrors && <span>Warnung prüfen</span>}
                    </div>
                  )}

                  {/* Produkt Bild & Details */}
                  <div style={{ display: "flex", gap: "14px", marginBottom: "14px" }}>
                    <div
                      style={{
                        width: "84px",
                        height: "84px",
                        flexShrink: 0,
                        borderRadius: "12px",
                        overflow: "hidden",
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {x.imageUrl ? (
                        <img
                          src={x.imageUrl}
                          alt={x.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: "1.8rem" }}>
                          {x.category === "FOOD" ? "🍲" : x.category === "DRINK" ? "🍹" : "☕"}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <h3
                        style={{
                          margin: "0 0 4px",
                          fontSize: "1.08rem",
                          fontWeight: 800,
                          color: "#0f172a",
                          lineHeight: 1.25,
                        }}
                      >
                        {x.name}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "#64748b",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                        title={x.description || undefined}
                      >
                        {x.description || "Keine Beschreibung hinterlegt."}
                      </p>
                    </div>
                  </div>

                  {/* Preis & Meta-Details */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", fontWeight: 700 }}>
                        PREIS
                      </span>
                      <strong
                        style={{
                          fontSize: "1.2rem",
                          color: "#14532d",
                          fontFamily: "Arial, sans-serif",
                        }}
                      >
                        {formatPrice(x.priceCents)}
                      </strong>
                    </div>

                    <div style={{ display: "flex", gap: "12px", fontSize: "0.78rem", color: "#475569" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "block", color: "#94a3b8" }}>Bestand:</span>
                        <strong>{x.quantity} {x.unit}</strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "block", color: "#94a3b8" }}>Pos:</span>
                        <strong>#{x.sortOrder}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                    {isExcelPreview ? (
                      <>
                        <button
                          type="button"
                          className="btn"
                          onClick={handleSaveExcelImport}
                          disabled={isSavingBulk || hasExcelErrors || isExcelSaved}
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                          }}
                        >
                          {isExcelSaved ? "Gespeichert" : isSavingBulk ? "Speichern..." : "Excel-Import speichern"}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => openExcelRowEditor(x.excelRowIndex ?? 0)}
                          style={{ padding: "9px 12px", fontSize: "0.85rem", fontWeight: 700 }}
                        >
                          Bearbeiten
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => edit(x)}
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <span>✏️</span> Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => del(x.id)}
                          style={{
                            padding: "9px 12px",
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "1px solid #fca5a5",
                            borderRadius: "12px",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                          title="Löschen"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* ================= TABLE VIEW ================= */
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              borderRadius: "18px",
              border: "1px solid rgba(148,163,184,0.25)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "14px 16px", width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === items.length && items.length > 0}
                        onChange={toggleSelectAll}
                        style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#14532d" }}
                      />
                    </th>
                    <th style={{ padding: "14px 16px", width: "70px" }}>Bild</th>
                    <th style={{ padding: "14px 16px" }}>Produktname & Beschreibung</th>
                    <th style={{ padding: "14px 16px" }}>Kategorie</th>
                    <th style={{ padding: "14px 16px", textAlign: "right" }}>Preis</th>
                    <th style={{ padding: "14px 16px", textAlign: "center" }}>Bestand</th>
                    <th style={{ padding: "14px 16px", textAlign: "center" }}>Sort.</th>
                    <th style={{ padding: "14px 16px", textAlign: "center" }}>Status</th>
                    <th style={{ padding: "14px 16px", textAlign: "right" }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((x) => {
                    const isSelected = selectedIds.includes(x.id);
                    const isEditingThis = editing === x.id;
                    const isExcelPreview = x.isExcelPreview === true;
                    const isExcelSaved = x.excelSaved === true;
                    const hasExcelErrors = !isExcelSaved && (x.excelErrors?.length ?? 0) > 0;

                    return (
                      <tr
                        key={x.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: isExcelPreview
                            ? isExcelSaved
                              ? "#eff6ff"
                              : hasExcelErrors
                              ? "#fff7ed"
                              : "#ecfdf5"
                            : isSelected
                            ? "#f0fdf4"
                            : isEditingThis
                            ? "#fefce8"
                            : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isExcelPreview}
                            onChange={() => toggleSelectOne(x.id)}
                            style={{
                              width: "18px",
                              height: "18px",
                              cursor: isExcelPreview ? "not-allowed" : "pointer",
                              accentColor: "#14532d",
                              opacity: isExcelPreview ? 0.35 : 1,
                            }}
                          />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            {x.imageUrl ? (
                              <img
                                src={x.imageUrl}
                                alt={x.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span>{x.category === "FOOD" ? "🍲" : x.category === "DRINK" ? "🍹" : "☕"}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ display: "block", color: "#0f172a", fontSize: "0.95rem" }}>
                            {x.name}
                          </strong>
                          {isExcelPreview && (
                            <span
                              style={{
                                display: "inline-flex",
                                margin: "3px 0",
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: hasExcelErrors ? "#ffedd5" : isExcelSaved ? "#dbeafe" : "#dcfce7",
                                color: hasExcelErrors ? "#9a3412" : isExcelSaved ? "#1d4ed8" : "#166534",
                                border: `1px solid ${hasExcelErrors ? "#fdba74" : isExcelSaved ? "#93c5fd" : "#86efac"}`,
                                fontSize: "0.7rem",
                                fontWeight: 800,
                              }}
                            >
                              {isExcelSaved
                                ? `✅ Gespeichert - Excel-Zeile ${x.excelRowIndex}`
                                : `✨ Neu aus Excel - Zeile ${x.excelRowIndex}`}
                            </span>
                          )}
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            {x.description || "Keine Beschreibung"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "999px",
                              background:
                                x.category === "FOOD"
                                  ? "#fef3c7"
                                  : x.category === "DRINK"
                                  ? "#e0f2fe"
                                  : "#fae8ff",
                              color:
                                x.category === "FOOD"
                                  ? "#92400e"
                                  : x.category === "DRINK"
                                  ? "#0369a1"
                                  : "#86198f",
                            }}
                          >
                            {x.category === "FOOD" ? "Speise" : x.category === "DRINK" ? "Getränk" : "Kaffee"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <strong style={{ color: "#14532d", fontSize: "0.98rem" }}>
                            {formatPrice(x.priceCents)}
                          </strong>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#475569" }}>
                          {x.quantity} {x.unit}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#64748b" }}>
                          #{x.sortOrder}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 800,
                              padding: "3px 8px",
                              borderRadius: "999px",
                              background: x.available ? "#dcfce7" : "#fee2e2",
                              color: x.available ? "#166534" : "#991b1b",
                            }}
                          >
                            {x.available ? "Aktiv" : "Inaktiv"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            {isExcelPreview ? (
                              <>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={handleSaveExcelImport}
                                  disabled={isSavingBulk || hasExcelErrors || isExcelSaved}
                                  style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                                >
                                  {isExcelSaved ? "Gespeichert" : "Speichern"}
                                </button>
                                <button
                                  type="button"
                                  className="btn secondary"
                                  onClick={() => openExcelRowEditor(x.excelRowIndex ?? 0)}
                                  style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                                >
                                  Bearbeiten
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn secondary"
                                  onClick={() => edit(x)}
                                  style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                                >
                                  Bearbeiten
                                </button>
                                <button
                                  type="button"
                                  onClick={() => del(x.id)}
                                  style={{
                                    padding: "6px 10px",
                                    background: "#fee2e2",
                                    color: "#991b1b",
                                    border: "1px solid #fca5a5",
                                    borderRadius: "8px",
                                    fontSize: "0.78rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Löschen
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ==================== EXCEL ZEILE BEARBEITEN ==================== */}
      {editingExcelRowIndex !== null && (
        <div className="backoffice-modal-backdrop">
          <div className="backoffice-modal" style={{ width: "min(760px, 96%)" }}>
            <div className="backoffice-modal-header">
              <div>
                <h2>Excel-Zeile bearbeiten</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Zeile {editingExcelRowIndex} bearbeiten und anschließend als einzelnen Datensatz speichern.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setEditingExcelRowIndex(null);
                  setExcelEditForm({ ...emptyExcelEditForm });
                }}
              >
                Schließen
              </button>
            </div>

            <div className="backoffice-modal-body">
              <form onSubmit={handleSaveEditedExcelRow} className="admin-form" style={{ display: "grid", gap: "14px" }}>
                <label>
                  Name *
                  <input
                    value={excelEditForm.name}
                    onChange={(e) => setExcelEditForm({ ...excelEditForm, name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Beschreibung
                  <textarea
                    value={excelEditForm.description}
                    onChange={(e) => setExcelEditForm({ ...excelEditForm, description: e.target.value })}
                  />
                </label>
                <label>
                  Bild-URL
                  <input
                    value={excelEditForm.imageUrl}
                    onChange={(e) => setExcelEditForm({ ...excelEditForm, imageUrl: e.target.value })}
                  />
                </label>
                <div className="admin-cols">
                  <label>
                    Preis in Euro *
                    <input
                      value={excelEditForm.price}
                      onChange={(e) => setExcelEditForm({ ...excelEditForm, price: e.target.value })}
                      required
                      placeholder="z. B. 12,90"
                    />
                  </label>
                  <label>
                    Kategorie
                    <select
                      value={excelEditForm.category}
                      onChange={(e) =>
                        setExcelEditForm({ ...excelEditForm, category: e.target.value as Category })
                      }
                    >
                      <option value="FOOD">Speise</option>
                      <option value="DRINK">Getränk</option>
                      <option value="COFFEE">Kaffee</option>
                    </select>
                  </label>
                  <label>
                    Verfügbar
                    <select
                      value={excelEditForm.available ? "true" : "false"}
                      onChange={(e) =>
                        setExcelEditForm({ ...excelEditForm, available: e.target.value === "true" })
                      }
                    >
                      <option value="true">Ja</option>
                      <option value="false">Nein</option>
                    </select>
                  </label>
                </div>
                <div className="admin-cols">
                  <label>
                    Sortierung
                    <input
                      type="number"
                      value={excelEditForm.sortOrder}
                      onChange={(e) => setExcelEditForm({ ...excelEditForm, sortOrder: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Bestand
                    <input
                      type="number"
                      value={excelEditForm.quantity}
                      onChange={(e) => setExcelEditForm({ ...excelEditForm, quantity: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Einheit
                    <select
                      value={excelEditForm.unit}
                      onChange={(e) =>
                        setExcelEditForm({
                          ...excelEditForm,
                          unit: e.target.value as "Stück" | "Kilogramm" | "Gramm" | "Liter",
                        })
                      }
                    >
                      <option value="Stück">Stück</option>
                      <option value="Kilogramm">Kilogramm</option>
                      <option value="Gramm">Gramm</option>
                      <option value="Liter">Liter</option>
                    </select>
                  </label>
                </div>
                <div className="admin-cols">
                  <label>
                    Lieferzeit in Tagen
                    <input
                      type="number"
                      min="0"
                      value={excelEditForm.deliveryTimeDays}
                      onChange={(e) =>
                        setExcelEditForm({ ...excelEditForm, deliveryTimeDays: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Lieferant-ID
                    <input
                      value={excelEditForm.supplierId}
                      onChange={(e) => setExcelEditForm({ ...excelEditForm, supplierId: e.target.value })}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setEditingExcelRowIndex(null);
                      setExcelEditForm({ ...emptyExcelEditForm });
                    }}
                  >
                    Abbrechen
                  </button>
                  <button type="submit" className="btn" disabled={isSavingBulk}>
                    {isSavingBulk ? "Wird gespeichert..." : "Speichern"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EXCEL PREVIEW MODAL ==================== */}
      {showPreviewModal && (
        <div className="backoffice-modal-backdrop">
          <div className="backoffice-modal" style={{ width: "min(1200px, 98%)" }}>
            <div className="backoffice-modal-header">
              <div>
                <h2>📋 Excel-Daten Vorschau & Validierung</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Datei: <strong>{excelFileName}</strong> ({previewRows.length} Zeilen erkannt)
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowPreviewModal(false)}
              >
                ✕ Schließen
              </button>
            </div>

            <div className="backoffice-modal-body">
              {/* SPALTENPRÜFUNG WARNUNGSANZEIGE */}
              {columnValidationErrors.length > 0 ? (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "2px solid #f59e0b",
                    padding: "16px",
                    borderRadius: "14px",
                    color: "#92400e",
                    marginBottom: "20px",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px" }}>⚠️ Excel-Warnung</h3>
                  <p style={{ margin: "0 0 10px" }}>
                    Die Datei wurde gelesen und die Datensätze werden in der Liste angezeigt.
                    Bitte prüfen Sie die Hinweise; gültige Zeilen können trotzdem gespeichert werden:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {columnValidationErrors.map((err, i) => (
                      <li key={i} style={{ fontWeight: "bold" }}>
                        {err}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: "14px", fontSize: "0.88rem", color: "#78350f" }}>
                    <strong>Erlaubte Tabellenspalten (Datenbank):</strong>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginTop: "6px",
                      }}
                    >
                      {ALLOWED_DB_COLUMNS.filter((c) => c !== "id").map((c) => (
                        <code
                          key={c}
                          style={{
                            background: "#fef3c7",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            border: "1px solid #fcd34d",
                          }}
                        >
                          {c}
                        </code>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={isSavingBulk || previewRows.length === 0}
                    onClick={handleSaveExcelImport}
                    style={{ marginTop: "14px", background: "#f59e0b", color: "#1f2937" }}
                  >
                    {isSavingBulk ? "Wird gespeichert..." : `💾 Gültige Zeilen speichern`}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    color: "#166534",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong>✅ Spaltenprüfung erfolgreich:</strong> Alle Spaltennamen stimmen mit
                    der Datenbank überein.
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={isSavingBulk || previewRows.length === 0}
                    onClick={handleSaveExcelImport}
                    style={{ background: "#16a34a" }}
                  >
                    {isSavingBulk ? "Wird gespeichert..." : `💾 ${previewRows.length} Datensätze in DB speichern`}
                  </button>
                </div>
              )}

              {/* TABELLE MIT ZEILEN-PREVIEW */}
              <div className="table-wrap" style={{ maxHeight: "450px", overflow: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Status</th>
                      <th>Name</th>
                      <th>Beschreibung</th>
                      <th>Preis</th>
                      <th>Kategorie</th>
                      <th>Verfügbar</th>
                      <th>Einheit</th>
                      <th>Bestand</th>
                      <th>Fehler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr
                        key={row.index}
                        style={{
                          background: row.errors.length > 0 ? "#fff1f2" : undefined,
                        }}
                      >
                        <td>{row.index}</td>
                        <td>
                          {row.errors.length > 0 ? (
                            <span style={{ color: "#e11d48", fontWeight: "bold" }}>⚠️ Fehler</span>
                          ) : (
                            <span style={{ color: "#16a34a", fontWeight: "bold" }}>✔️ OK</span>
                          )}
                        </td>
                        <td>
                          <strong>{row.parsed.name || "-"}</strong>
                        </td>
                        <td style={{ maxWidth: "250px", fontSize: "0.85rem" }}>
                          {row.parsed.description || <span className="muted">-</span>}
                        </td>
                        <td>{formatPrice(row.parsed.priceCents)}</td>
                        <td>{row.parsed.category}</td>
                        <td>{row.parsed.available ? "Ja" : "Nein"}</td>
                        <td>{row.parsed.unit}</td>
                        <td>{row.parsed.quantity}</td>
                        <td>
                          {row.errors.length > 0 ? (
                            <span style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
                              {row.errors.join(", ")}
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: "0.85rem" }}>
                              Keine
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "20px",
                }}
              >
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowPreviewModal(false)}
                >
                  Schließen
                </button>
                {columnValidationErrors.length === 0 && (
                  <button
                    type="button"
                    className="btn"
                    disabled={isSavingBulk || previewRows.length === 0}
                    onClick={handleSaveExcelImport}
                    style={{ background: "#16a34a" }}
                  >
                    {isSavingBulk
                      ? "Wird in Datenbank gespeichert..."
                      : `💾 Alle ${previewRows.length} Datensätze jetzt speichern`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MASSENBEARBEITUNGS MODAL ==================== */}
      {showBulkEditModal && (
        <div className="backoffice-modal-backdrop">
          <div className="backoffice-modal" style={{ width: "min(650px, 95%)" }}>
            <div className="backoffice-modal-header">
              <div>
                <h2>✏️ Massenbearbeitung</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {selectedIds.length > 0
                    ? `Feld für ${selectedIds.length} ausgewählte Positionen gleichzeitig ändern`
                    : `Feld für ALLE ${items.length} Positionen gleichzeitig ändern`}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowBulkEditModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkUpdate} className="backoffice-modal-body">
              <label style={{ display: "block", marginBottom: "14px" }}>
                <strong>Zu änderndes Feld auswählen:</strong>
                <select
                  value={bulkField}
                  onChange={(e) => {
                    setBulkField(e.target.value);
                    if (e.target.value === "available") setBulkValue("true");
                    else if (e.target.value === "category") setBulkValue("FOOD");
                    else if (e.target.value === "unit") setBulkValue("Stück");
                    else setBulkValue("");
                  }}
                  style={{ width: "100%", marginTop: "6px" }}
                >
                  <option value="available">Verfügbarkeit (Im QR-Menü)</option>
                  <option value="category">Kategorie</option>
                  <option value="unit">Mengeneinheit</option>
                  <option value="priceCents">Preis (in €)</option>
                  <option value="quantity">Bestand</option>
                  <option value="sortOrder">Sortierung</option>
                  <option value="deliveryTimeDays">Lieferzeit (Tage)</option>
                  <option value="description">Beschreibung</option>
                </select>
              </label>

              <label style={{ display: "block", marginBottom: "20px" }}>
                <strong>Neuer Wert für alle betroffenen Positionen:</strong>
                {bulkField === "available" ? (
                  <select
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    style={{ width: "100%", marginTop: "6px" }}
                  >
                    <option value="true">Verfügbar (Aktiviert)</option>
                    <option value="false">Nicht verfügbar (Deaktiviert)</option>
                  </select>
                ) : bulkField === "category" ? (
                  <select
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    style={{ width: "100%", marginTop: "6px" }}
                  >
                    <option value="FOOD">Speise</option>
                    <option value="DRINK">Getränk</option>
                    <option value="COFFEE">Kaffee</option>
                  </select>
                ) : bulkField === "unit" ? (
                  <select
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    style={{ width: "100%", marginTop: "6px" }}
                  >
                    <option value="Stück">Stück</option>
                    <option value="Kilogramm">Kilogramm</option>
                    <option value="Gramm">Gramm</option>
                    <option value="Liter">Liter</option>
                  </select>
                ) : bulkField === "priceCents" ? (
                  <input
                    type="text"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder="z. B. 12,50"
                    style={{ width: "100%", marginTop: "6px" }}
                    required
                  />
                ) : bulkField === "sortOrder" || bulkField === "quantity" || bulkField === "deliveryTimeDays" ? (
                  <input
                    type="number"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    style={{ width: "100%", marginTop: "6px" }}
                    required
                  />
                ) : (
                  <textarea
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder="Gemeinsame Beschreibung..."
                    style={{ width: "100%", marginTop: "6px" }}
                  />
                )}
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowBulkEditModal(false)}
                >
                  Abbrechen
                </button>
                <button type="submit" className="btn" disabled={isUpdatingBulk}>
                  {isUpdatingBulk ? "Wird angewendet..." : "Änderung jetzt auf alle anwenden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
