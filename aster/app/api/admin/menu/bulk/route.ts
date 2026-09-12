import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { adminCookieName, validAdminToken } from "@/lib/admin-auth";

function ok(req: NextRequest) {
  return validAdminToken(req.cookies.get(adminCookieName())?.value);
}

// Erlaubte Datenbankfelder von MenuItem, die per Excel / Batch gesetzt werden können
const ALLOWED_MENU_FIELDS = [
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
] as const;

// Schema für einen einzelnen Datensatz beim Bulk-Import
const batchItemSchema = z.object({
  id: z.string().optional(), // optional für Update vs Insert
  name: z.string().trim().min(1, "Name ist erforderlich").max(100),
  description: z.string().default(""),
  imageUrl: z.string().nullable().optional(),
  priceCents: z.number().int().min(0, "Preis muss positiv sein"),
  category: z.enum(["FOOD", "DRINK", "COFFEE"]).default("FOOD"),
  available: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  quantity: z.number().int().default(0),
  unit: z.enum(["Stück", "Kilogramm", "Gramm", "Liter"]).default("Stück"),
  deliveryTimeDays: z.number().int().nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

const bulkImportPayloadSchema = z.object({
  columns: z.array(z.string()),
  items: z.array(batchItemSchema),
});

const bulkUpdatePayloadSchema = z.object({
  ids: z.array(z.string()).optional(), // Wenn leer/nicht angegeben -> alle Positionen
  updates: z.record(z.string(), z.any()),
});

const bulkDeletePayloadSchema = z.object({
  ids: z.array(z.string()).optional(), // Wenn leer/nicht angegeben -> alle Positionen
  deleteAll: z.boolean().optional(),
});

// GET: Liefert Metadaten über erlaubte Spalten
export async function GET(req: NextRequest) {
  if (!ok(req)) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  return NextResponse.json({
    allowedFields: ALLOWED_MENU_FIELDS,
    fieldDefinitions: {
      name: { type: "string", label: "Name", required: true },
      description: { type: "string", label: "Beschreibung", required: false },
      priceCents: { type: "number", label: "Preis in Cent (oder Preis in Euro)", required: true },
      category: { type: "enum", label: "Kategorie (FOOD, DRINK, COFFEE)", required: false, allowed: ["FOOD", "DRINK", "COFFEE"] },
      available: { type: "boolean", label: "Verfügbar (true/false / ja/nein / 1/0)", required: false },
      sortOrder: { type: "number", label: "Sortierung", required: false },
      quantity: { type: "number", label: "Bestand", required: false },
      unit: { type: "enum", label: "Einheit (Stück, Kilogramm, Gramm, Liter)", required: false, allowed: ["Stück", "Kilogramm", "Gramm", "Liter"] },
      deliveryTimeDays: { type: "number", label: "Lieferzeit in Tagen", required: false },
      supplierId: { type: "string", label: "Lieferant-ID", required: false },
      imageUrl: { type: "string", label: "Bild-URL", required: false },
    },
  });
}

// POST: Speichern von Excel / Bulk-Importierten Zeilen mit Spaltenprüfung
export async function POST(req: NextRequest) {
  if (!ok(req)) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const raw = await req.json();

    // 1. Spaltenvalidierung: Prüfen auf Namensgleichheit mit DB-Feldern
    const providedColumns: string[] = raw.columns || [];
    if (!Array.isArray(providedColumns) || providedColumns.length === 0) {
      return NextResponse.json(
        { error: "Keine Spaltenüberschriften in der Datei gefunden." },
        { status: 400 }
      );
    }

    const invalidColumns = providedColumns.filter(
      (col) => !ALLOWED_MENU_FIELDS.includes(col as any) && col !== "id" && col !== "price" && col !== "preis"
    );

    if (invalidColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Ungültige Spaltennamen in der Datei: [${invalidColumns.join(", ")}]. Erlaubte Spalten: [${ALLOWED_MENU_FIELDS.join(", ")}]`,
          invalidColumns,
          allowedColumns: ALLOWED_MENU_FIELDS,
        },
        { status: 400 }
      );
    }

    // 2. Parse payload
    const parsed = bulkImportPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json(
        { error: `Ungültige Datenzeilen: ${issues}` },
        { status: 400 }
      );
    }

    const { items } = parsed.data;
    if (items.length === 0) {
      return NextResponse.json({ error: "Keine Datensätze zum Speichern vorhanden." }, { status: 400 });
    }

    // 3. Batch-Transaktion ausführen: Entweder Upsert oder CreateMany
    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.id) {
          // Prüfen ob existiert
          const exists = await tx.menuItem.findUnique({ where: { id: item.id } });
          if (exists) {
            await tx.menuItem.update({
              where: { id: item.id },
              data: {
                name: item.name,
                description: item.description,
                priceCents: item.priceCents,
                category: item.category,
                available: item.available,
                sortOrder: item.sortOrder,
                quantity: item.quantity,
                unit: item.unit,
                deliveryTimeDays: item.deliveryTimeDays ?? null,
                supplierId: item.supplierId ?? null,
                imageUrl: item.imageUrl?.trim() || null,
              },
            });
            updatedCount++;
            continue;
          }
        }

        // Ansonsten anlegen
        await tx.menuItem.create({
          data: {
            name: item.name,
            description: item.description,
            priceCents: item.priceCents,
            category: item.category,
            available: item.available,
            sortOrder: item.sortOrder,
            quantity: item.quantity,
            unit: item.unit,
            deliveryTimeDays: item.deliveryTimeDays ?? null,
            supplierId: item.supplierId ?? null,
            imageUrl: item.imageUrl?.trim() || null,
          },
        });
        createdCount++;
      }
    });

    return NextResponse.json({
      success: true,
      message: `${createdCount} neu angelegt, ${updatedCount} aktualisiert.`,
      createdCount,
      updatedCount,
    });
  } catch (err: any) {
    console.error("Bulk Import Error:", err);
    return NextResponse.json(
      { error: err?.message || "Fehler beim Speichern der Menüdaten." },
      { status: 500 }
    );
  }
}

// PATCH: Bulk-Update von einem oder mehreren Feldern für alle oder ausgewählte Positionen
export async function PATCH(req: NextRequest) {
  if (!ok(req)) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const parsed = bulkUpdatePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Update-Parameter." }, { status: 400 });
    }

    const { ids, updates } = parsed.data;

    // Prüfen, ob alle keys in updates erlaubte Spalten sind
    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 0) {
      return NextResponse.json({ error: "Keine Felder zum Aktualisieren übergeben." }, { status: 400 });
    }

    const invalidKeys = updateKeys.filter((k) => !ALLOWED_MENU_FIELDS.includes(k as any));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Ungültige Spalten für Update: [${invalidKeys.join(", ")}]. Erlaubt: [${ALLOWED_MENU_FIELDS.join(", ")}]`,
        },
        { status: 400 }
      );
    }

    // Konstruiere das prisma update object
    const prismaData: Record<string, any> = {};

    if ("name" in updates && typeof updates.name === "string") {
      prismaData.name = updates.name.trim();
    }
    if ("description" in updates && typeof updates.description === "string") {
      prismaData.description = updates.description.trim();
    }
    if ("priceCents" in updates && typeof updates.priceCents === "number") {
      prismaData.priceCents = Math.max(0, Math.round(updates.priceCents));
    }
    if ("category" in updates && ["FOOD", "DRINK", "COFFEE"].includes(updates.category)) {
      prismaData.category = updates.category;
    }
    if ("available" in updates && typeof updates.available === "boolean") {
      prismaData.available = updates.available;
    }
    if ("sortOrder" in updates && typeof updates.sortOrder === "number") {
      prismaData.sortOrder = Math.round(updates.sortOrder);
    }
    if ("quantity" in updates && typeof updates.quantity === "number") {
      prismaData.quantity = Math.max(0, Math.round(updates.quantity));
    }
    if ("unit" in updates && ["Stück", "Kilogramm", "Gramm", "Liter"].includes(updates.unit)) {
      prismaData.unit = updates.unit;
    }
    if ("deliveryTimeDays" in updates) {
      prismaData.deliveryTimeDays = updates.deliveryTimeDays === null ? null : Math.round(updates.deliveryTimeDays);
    }
    if ("supplierId" in updates) {
      prismaData.supplierId = updates.supplierId || null;
    }
    if ("imageUrl" in updates) {
      prismaData.imageUrl = updates.imageUrl?.trim() || null;
    }

    const whereClause = ids && ids.length > 0 ? { id: { in: ids } } : {};

    const result = await prisma.menuItem.updateMany({
      where: whereClause,
      data: prismaData,
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} Positionen erfolgreich aktualisiert.`,
      updatedCount: result.count,
    });
  } catch (err: any) {
    console.error("Bulk Update Error:", err);
    return NextResponse.json(
      { error: err?.message || "Fehler beim Ausführen der Massenbearbeitung." },
      { status: 500 }
    );
  }
}

// DELETE: Bulk-Löschen von ausgewählten oder allen Positionen
export async function DELETE(req: NextRequest) {
  if (!ok(req)) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = bulkDeletePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Lösch-Parameter." }, { status: 400 });
    }

    const { ids, deleteAll } = parsed.data;

    if (!deleteAll && (!ids || ids.length === 0)) {
      return NextResponse.json({ error: "Keine Positionen zum Löschen ausgewählt." }, { status: 400 });
    }

    const whereClause = deleteAll ? {} : { id: { in: ids } };

    // Prüfen, ob Fremdschlüsselverletzungen auftreten könnten oder abfangen
    try {
      const result = await prisma.menuItem.deleteMany({
        where: whereClause,
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} Positionen erfolgreich gelöscht.`,
        deletedCount: result.count,
      });
    } catch (dbErr: any) {
      return NextResponse.json(
        {
          error: "Einige Positionen können nicht gelöscht werden, da sie bereits mit bestehenden Bestellungen verknüpft sind.",
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("Bulk Delete Error:", err);
    return NextResponse.json(
      { error: err?.message || "Fehler beim Massenlöschen." },
      { status: 500 }
    );
  }
}
