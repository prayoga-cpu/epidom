import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { ENTITY_UNIQUE_FIELDS } from "@/lib/ai/import-schema";
import { storefrontService } from "@/lib/services/storefront.service";
import { parseImportedBarcode } from "@/lib/utils/barcode";
import { skuFromName } from "@/lib/utils/sku-generator";
import { parseGlobalNumber, parseImportedMoney } from "@/lib/utils/import-number";
import { getCurrencyDecimals } from "@/features/pos/lib/currency-decimals";
import { z } from "zod";

/**
 * Catalog import: turn spreadsheet-like rows into suppliers, materials,
 * recipes, products and menu items. Used by the Data page's import (the
 * server actions in src/features/dashboard/data/actions.ts, which check the
 * session and the store first) and by the Claude connector's import_catalog.
 * Nothing here checks who is asking: callers must have authorized storeId.
 */

// Type for import result with detailed stats
export interface ImportResult {
  success: boolean;
  count?: number;
  error?: string;
  details?: {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: Array<{ index: number; message: string }>;
  };
}

// Helper to normalize supplier names for fuzzy matching
// Removes "PT", "CV", "Inc", "Ltd", punctuation, and extra spaces
function normalizeSupplierName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[.,\-]/g, " ") // Replace punctuation with space
    .replace(/\b(pt|cv|inc|ltd|corp|llc|gmbh|tbk|ud)\b/g, "") // Remove entity types
    .replace(/\s+/g, " ") // Collapse spaces
    .trim();
}

/**
 * A row failure in words a merchant can act on. Prisma's message is a
 * multi-line dump of the whole invocation whose actual reason is its LAST line,
 * so keeping the first 100 characters reported nothing useful.
 */
function describeImportError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  if ((error as { code?: string }).code === "P2002") {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const fields = Array.isArray(target) ? target.filter((f) => f !== "storeId").join(", ") : "";
    return fields
      ? `Already used by another item: ${fields}`
      : "Duplicate of an item that already exists";
  }
  const lines = error.message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines[lines.length - 1] ?? "Unknown error").slice(0, 160);
}

/**
 * Import materials with createMany for efficiency
 */
/** The Log row for stock an import brings in with a new material or product. */
function openingStockMovement(quantity: number, unit: string) {
  return {
    type: MovementType.ADJUSTMENT,
    quantity,
    unit,
    balanceAfter: quantity,
    notes: "Initial stock (import)",
  };
}

export async function importMaterials(data: any[], storeId: string): Promise<ImportResult> {
  try {
    // Filter out records without required fields
    const validData = data.filter(
      (item) => item.name && typeof item.name === "string" && item.name.trim()
    );

    if (validData.length === 0) {
      return {
        success: false,
        error: "No valid records found. Each material requires at least a 'name' field.",
      };
    }

    // 1. Process Suppliers (Auto-create if missing)
    // Extract raw names first
    const rawSupplierNames = [
      ...new Set(
        validData
          .map((d) => d.supplierName)
          .filter((n) => typeof n === "string" && n.trim().length > 0)
      ),
    ] as string[];

    const supplierMap = new Map<string, string>(); // Normalized Name -> ID

    if (rawSupplierNames.length > 0) {
      // Fetch ALL existing suppliers to perform in-memory fuzzy check (safer than database strict match)
      // Note: For <1000 suppliers this is fine. For scale, we'd need a search index.
      const existingSuppliers = await prisma.supplier.findMany({
        where: { storeId },
        select: { id: true, name: true },
      });

      // Build map of Normalized -> ID from DB
      existingSuppliers.forEach((s) => {
        supplierMap.set(normalizeSupplierName(s.name), s.id);
      });

      // Identify truly missing suppliers
      const suppliersToCreate = new Set<string>();

      rawSupplierNames.forEach((rawName) => {
        const normalized = normalizeSupplierName(rawName);
        if (!supplierMap.has(normalized)) {
          suppliersToCreate.add(rawName); // Use the raw name for creation (looks better)
        }
      });

      // Create missing suppliers
      if (suppliersToCreate.size > 0) {
        // We create them one by one or createMany, but createMany doesn't return IDs easily in all DBs.
        // Let's use loop for safety to get IDs and map them immediately
        // (Performance trade-off acceptable for <50 new suppliers)
        for (const newName of Array.from(suppliersToCreate)) {
          // Double check to avoid race condition if duplicates in list had diff casing
          const norm = normalizeSupplierName(newName);
          if (supplierMap.has(norm)) continue;

          const created = await prisma.supplier.create({
            data: {
              name: newName.trim(),
              storeId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            select: { id: true },
          });
          supplierMap.set(norm, created.id);
        }
      }
    }

    let successCount = 0;
    const errors: Array<{ index: number; message: string }> = [];

    // Material.unitCost (and MaterialSupplier.price) are stored in IDR, the
    // platform base currency — same as everywhere else costs are persisted.
    // Imported rows carry a plain number the merchant entered/pasted in
    // their own currency, so it has to be converted here or a non-IDR
    // store's imported materials silently mis-price by the exchange-rate
    // factor (e.g. a €5/kg ingredient stored as literally "5 IDR").
    const { currency: importCurrency, rate: importRate } =
      await storefrontService.getOwnerCurrencyAndRate(storeId);
    const moneyDecimals = getCurrencyDecimals(importCurrency);

    // Process each material individually to handle relationships properly
    for (let i = 0; i < validData.length; i++) {
      const item = validData[i];
      try {
        let supplierId = undefined;
        if (item.supplierName && typeof item.supplierName === "string") {
          // Use normalized lookup
          supplierId = supplierMap.get(normalizeSupplierName(item.supplierName));
        }

        const unitCostBase = storefrontService.convertOwnerToBaseSync(
          parseImportedMoney(item.unitCost, moneyDecimals) || 0,
          importRate
        );
        const supplierPriceBase = storefrontService.convertOwnerToBaseSync(
          parseImportedMoney(item.supplierPrice, moneyDecimals) ||
            parseImportedMoney(item.unitCost, moneyDecimals) ||
            0,
          importRate
        );

        // Prepare supplier relation data if supplier exists
        const materialSuppliersCreate = supplierId
          ? {
              create: {
                supplierId,
                price: supplierPriceBase,
                isPreferred: true,
              },
            }
          : undefined;

        const openingStock = parseGlobalNumber(item.currentStock) || 0;
        const unit = item.unit || "kg";
        await prisma.material.create({
          data: {
            storeId: item.storeId,
            sku:
              item.sku ||
              `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            name: String(item.name).trim(),
            description: item.description || undefined,
            category: item.category || undefined,
            unit,
            unitCost: unitCostBase,
            currentStock: openingStock,
            minStock: parseGlobalNumber(item.minStock) || 0,
            maxStock: item.maxStock ? parseGlobalNumber(item.maxStock) : undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            // Create relation to supplier
            materialSuppliers: materialSuppliersCreate,
            // Imported stock goes on the Log, as stock typed into the add form does.
            ...(openingStock !== 0 && {
              stockMovements: { create: openingStockMovement(openingStock, unit) },
            }),
          },
        });
        successCount++;
      } catch (error) {
        // Skip duplicates (unique constraint violation) silently like createMany does
        // record others
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (!msg.includes("Unique constraint")) {
          errors.push({ index: i + 1, message: describeImportError(error) });
        }
      }
    }

    return {
      success: successCount > 0,
      count: successCount,
      details: {
        attempted: data.length,
        succeeded: successCount,
        failed: data.length - successCount,
        errors: errors.slice(0, 10),
      },
    };
  } catch (error) {
    console.error("Material import error:", error);
    return {
      success: false,
      error: `Material import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Import products with createMany for efficiency
 */
export async function importProducts(data: any[], storeId: string): Promise<ImportResult> {
  try {
    const validData = data.filter(
      (item) => item.name && typeof item.name === "string" && item.name.trim()
    );

    if (validData.length === 0) {
      return {
        success: false,
        error: "No valid records found. Each product requires at least a 'name' field.",
      };
    }

    let successCount = 0;
    const errors: Array<{ index: number; message: string }> = [];

    // Product.costPrice/sellingPrice are stored in IDR, the platform base
    // currency. Imported rows carry a plain number the merchant entered/
    // pasted in their own currency, so it has to be converted here or a
    // non-IDR store's imported products silently mis-price by the
    // exchange-rate factor (e.g. a €2.20 pastry stored as literally "2.2 IDR").
    const { currency: importCurrency, rate: importRate } =
      await storefrontService.getOwnerCurrencyAndRate(storeId);
    const moneyDecimals = getCurrencyDecimals(importCurrency);

    // Product.sku is required and unique per store, but a menu sheet rarely
    // has a SKU column. Without a fallback every new row failed Prisma's
    // validation ("Argument `sku` is missing") and the import reported 0 of N.
    // Loaded once, and only when some row actually needs a generated code.
    let takenSkus: Set<string> | null = null;
    const nextSku = async (name: string) => {
      if (!takenSkus) {
        const existing = await prisma.product.findMany({
          where: { storeId },
          select: { sku: true },
        });
        takenSkus = new Set(existing.map((p) => p.sku.toUpperCase()));
      }
      return skuFromName(name, takenSkus);
    };

    // Process one by one to handle Updates (Upsert logic) and precise error reporting
    for (let i = 0; i < validData.length; i++) {
      const item = validData[i];
      try {
        const name = String(item.name).trim();
        const sku = item.sku ? String(item.sku).trim() || undefined : undefined;
        // Optional scan code (a spreadsheet often hands it over as a NUMBER; a
        // blank cell means "none"). Held to the same rule as the product form.
        const { barcode, error: barcodeError } = parseImportedBarcode(item.barcode);
        if (barcodeError) throw new Error(barcodeError);

        // Check for existing product by Name (primary match) or SKU (secondary)
        // We verify storeId and Insensitive Name match
        let existingProduct = await prisma.product.findFirst({
          where: {
            storeId,
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true, currentStock: true },
        });

        // If not found by name, try finding by SKU if provided
        if (!existingProduct && sku) {
          existingProduct = await prisma.product.findFirst({
            where: { storeId, sku },
            select: { id: true, currentStock: true },
          });
        }

        // Barcode is unique per store. A collision must FAIL THIS ROW with a
        // readable reason instead of surfacing Prisma's raw P2002 text (or, worse,
        // silently dropping the code and importing a product a scanner can't find).
        if (barcode) {
          const taken = await prisma.product.findFirst({
            where: {
              storeId,
              barcode,
              ...(existingProduct && { id: { not: existingProduct.id } }),
            },
            select: { id: true },
          });
          if (taken) throw new Error(`Barcode "${barcode}" is already used by another product`);
        }

        const hasStock =
          item.currentStock !== undefined &&
          item.currentStock !== null &&
          String(item.currentStock).trim() !== "";
        const importedStock = hasStock ? parseGlobalNumber(item.currentStock) || 0 : undefined;

        const productData = {
          name,
          sku,
          // Left out (not nulled) when absent, so re-importing a sheet without the
          // column never wipes barcodes already set on existing products.
          ...(barcode && { barcode }),
          description: item.description || undefined,
          category: item.category || undefined,
          unit: item.unit || "pcs",
          costPrice: storefrontService.convertOwnerToBaseSync(
            parseImportedMoney(item.costPrice, moneyDecimals) || 0,
            importRate
          ),
          sellingPrice: storefrontService.convertOwnerToBaseSync(
            parseImportedMoney(item.sellingPrice, moneyDecimals) || 0,
            importRate
          ),
          // Left out when the sheet has no stock (column or cell), like the
          // barcode above: re-importing without it used to zero every product.
          ...(importedStock !== undefined && { currentStock: importedStock }),
          minStock: parseGlobalNumber(item.minStock) || 0,
          maxStock: item.maxStock ? parseGlobalNumber(item.maxStock) : undefined,
          updatedAt: new Date(), // Always update timestamp
        };

        let productId: string;
        if (existingProduct) {
          // UPDATE existing product. A stock change goes on the Log, in the
          // same write as the stock itself.
          const stockDelta =
            importedStock !== undefined ? importedStock - Number(existingProduct.currentStock) : 0;
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              ...productData,
              ...(stockDelta !== 0 && {
                stockMovements: {
                  create: {
                    type: MovementType.ADJUSTMENT,
                    quantity: stockDelta,
                    unit: productData.unit,
                    balanceAfter: importedStock!,
                    notes: `Stock ${stockDelta > 0 ? "increase" : "decrease"} - Import`,
                  },
                },
              }),
            },
          });
          productId = existingProduct.id;
        } else {
          // CREATE new product
          const openingStock = importedStock ?? 0;
          const created = await prisma.product.create({
            data: {
              ...productData,
              sku: sku ?? (await nextSku(name)),
              currentStock: openingStock,
              storeId,
              createdAt: item.createdAt || new Date(),
              ...(openingStock !== 0 && {
                stockMovements: { create: openingStockMovement(openingStock, productData.unit) },
              }),
            },
          });
          productId = created.id;
        }

        // Auto-add the product to the store's POS/storefront menu by default
        // (no-ops if it's already linked) — users can still remove it manually.
        await storefrontService.autoLinkProductToMenu(storeId, {
          id: productId,
          name: productData.name,
          sellingPrice: productData.sellingPrice,
          category: productData.category ?? null,
        });

        successCount++;
      } catch (error) {
        errors.push({ index: i + 1, message: describeImportError(error) });
        console.error(`Product import error at row ${i + 1}:`, error);
      }
    }

    return {
      success: successCount > 0,
      count: successCount,
      details: {
        attempted: data.length,
        succeeded: successCount,
        failed: data.length - successCount,
        errors: errors.slice(0, 10),
      },
    };
  } catch (error) {
    console.error("Product import fatal error:", error);
    return {
      success: false,
      error: `Product import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Import suppliers
 */
export async function importSuppliers(data: any[], storeId: string): Promise<ImportResult> {
  try {
    const validData = data.filter(
      (item) => item.name && typeof item.name === "string" && item.name.trim()
    );

    if (validData.length === 0) {
      return {
        success: false,
        error: "No valid records found. Each supplier requires at least a 'name' field.",
      };
    }

    const cleanedData = validData.map((item) => {
      const cleaned = {
        storeId: item.storeId,
        name: String(item.name).trim(),
        contactPerson: item.contactPerson || undefined,
        email: item.email || undefined,
        phone: item.phone || undefined,
        address: item.address || undefined,
        city: item.city || undefined,
        country: item.country || undefined,
        notes: item.notes || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      return cleaned;
    });

    const result = await prisma.supplier.createMany({
      data: cleanedData,
      skipDuplicates: true,
    });

    return {
      success: true,
      count: result.count,
      details: {
        attempted: data.length,
        succeeded: result.count,
        failed: data.length - result.count,
        errors: [],
      },
    };
  } catch (error) {
    console.error("Supplier import error:", error);
    return {
      success: false,
      error: `Supplier import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Find or create a Material for a recipe ingredient.
 * Resolution order: SKU (unique per store) -> case-insensitive name -> create.
 * When creating, cascades a supplier link if a supplier name is provided.
 * Returns the material id, or null if the name is blank.
 */
async function resolveMaterialId(
  storeId: string,
  name: string,
  opts: {
    unit?: string;
    sku?: string;
    price?: number;
    stock?: number;
    supplier?: string;
  } = {}
): Promise<string | null> {
  const cleanName = (name || "").trim();
  if (!cleanName) return null;

  // 1. Match by SKU first when provided (sku is @@unique([storeId, sku]))
  const cleanSku = opts.sku?.trim();
  if (cleanSku) {
    const bySku = await prisma.material.findFirst({
      where: { storeId, sku: { equals: cleanSku, mode: "insensitive" } },
      select: { id: true },
    });
    if (bySku) return bySku.id;
  }

  // 2. Match by case-insensitive name
  const byName = await prisma.material.findFirst({
    where: { storeId, name: { equals: cleanName, mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return byName.id;

  // 3. Cascade-create the material (and its supplier, if any)
  let supplierId: string | undefined;
  const supplierName = opts.supplier?.trim();
  if (supplierName) {
    const existingSupplier = await prisma.supplier.findFirst({
      where: { storeId, name: { equals: supplierName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      const newSupplier = await prisma.supplier.create({
        data: { storeId, name: supplierName, createdAt: new Date(), updatedAt: new Date() },
        select: { id: true },
      });
      supplierId = newSupplier.id;
    }
  }

  const unit = opts.unit?.trim() || "kg";
  const openingStock = opts.stock ?? 0;
  const created = await prisma.material.create({
    data: {
      storeId,
      name: cleanName,
      unit,
      sku: cleanSku || `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      unitCost: opts.price ?? 0,
      currentStock: openingStock,
      category: "Imported",
      materialSuppliers: supplierId
        ? { create: { supplierId, price: opts.price ?? 0, isPreferred: true } }
        : undefined,
      ...(openingStock !== 0 && {
        stockMovements: { create: openingStockMovement(openingStock, unit) },
      }),
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Parse a combined ingredients cell into structured ingredients.
 * Splits on ";" / newline and understands several "name + qty + unit" shapes:
 *   "Farine:500g; Eau:300 ml", "Sel 5 g", "2 kg Sucre", "Farine de blé - 500 g".
 * Parts with no detectable quantity become a single ingredient (qty 1, unit "unit").
 */
function parseIngredientsBlob(blob: string): Array<{ name: string; qty: number; unit: string }> {
  // A chunk that is purely a quantity (+ optional unit), e.g. "500 g", "300ml".
  const isPureQuantity = (s: string) => /\d/.test(s) && /^[\d.,]+\s*[a-zA-Zµ%]*$/.test(s.trim());

  // Build ingredient parts. ";" and newlines are unambiguous separators. A comma
  // is ambiguous: it separates ingredients in "Flour 500g, Water 300ml" but a
  // name from its quantity in "Farine T65, 500 g". So we split on comma+space and
  // re-attach a trailing pure-quantity fragment to the preceding name.
  const parts: string[] = [];
  for (const segment of blob.split(/[;\n]+/)) {
    let buffer = "";
    for (const chunk of segment.split(/,\s+/)) {
      const t = chunk.trim();
      if (!t) continue;
      if (buffer && isPureQuantity(t)) {
        buffer = `${buffer} ${t}`; // e.g. "Farine T65" + "500 g"
      } else {
        if (buffer) parts.push(buffer);
        buffer = t;
      }
    }
    if (buffer) parts.push(buffer);
  }

  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      // "Name: 500 g" / "Name - 500g" / "Salt 5g" (name first, qty at the end)
      const trailing = part.match(/^(.*?)[\s:–\-]+([\d.,]+)\s*([a-zA-Zµ%]+)?$/);
      if (trailing && trailing[2]) {
        const name = trailing[1].replace(/[\s:–\-]+$/, "").trim();
        if (name) {
          return {
            name,
            qty: parseGlobalNumber(trailing[2]) || 1,
            unit: (trailing[3] || "unit").trim(),
          };
        }
      }
      // "500g Flour" / "2 kg Sugar" (qty + unit first)
      const leading = part.match(/^([\d.,]+)\s*([a-zA-Zµ%]+)?\s+(.+)$/);
      if (leading && leading[1] && leading[3]) {
        return {
          name: leading[3].trim(),
          qty: parseGlobalNumber(leading[1]) || 1,
          unit: (leading[2] || "unit").trim(),
        };
      }
      // No quantity detected — treat the whole part as a name
      return { name: part, qty: 1, unit: "unit" };
    })
    .filter((i) => i.name);
}

/**
 * Import recipes - uses individual creates for better error handling
 * since recipes may have complex validation
 *
 * GROUPING LOGIC:
 * - Same name + same yield = 1 Recipe (merge ingredients)
 * - Same name + different yield = 2 separate Recipes
 * - Multi-row format: continuation rows have empty yieldQuantity, inherit from first row
 */
export async function importRecipes(data: any[], storeId: string): Promise<ImportResult> {
  const errors: Array<{ index: number; message: string }> = [];
  let successCount = 0;

  // Costs are stored in IDR, the platform base currency, exactly as
  // importMaterials / importProducts do. This path used to write the sheet's
  // number as-is, so in a euro store an ingredient at 5.00 became "5 IDR" on
  // the material it created, and every recipe cost built on it was wrong.
  let toBase: (value: unknown) => number;
  try {
    const { currency, rate } = await storefrontService.getOwnerCurrencyAndRate(storeId);
    const decimals = getCurrencyDecimals(currency);
    toBase = (value) =>
      storefrontService.convertOwnerToBaseSync(parseImportedMoney(value, decimals) || 0, rate);
  } catch (error) {
    console.error("Recipe import error:", error);
    return {
      success: false,
      error: `Recipe import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  // 1. Group by Recipe Name + YieldQuantity to handle multi-row ingredients
  // Key format: "RecipeName|YieldQty" (e.g., "Roti Tawar|60" vs "Roti Tawar|30")
  const groups: Record<string, any[]> = {};
  const nameCounts: Record<string, number> = {}; // Track frequency of each base name
  let lastGroupKey: string | null = null;

  data.forEach((item, index) => {
    const name = item.name ? String(item.name).trim() : null;
    // Continuation rows might not have name, so we rely on lastGroupKey logic generally,
    // but for counting we need the base name.

    // Get yield quantity - if empty, this might be a continuation row
    const yieldQty = parseGlobalNumber(item.yieldQuantity);

    // Build group key: name + yield (or inherit from previous if continuation row)
    let groupKey: string;

    if (name && yieldQty && yieldQty > 0) {
      // New recipe or main row
      groupKey = `${name}|${yieldQty}`;
      lastGroupKey = groupKey;

      // Count this unique variant if not already counted
      if (!groups[groupKey]) {
        nameCounts[name] = (nameCounts[name] || 0) + 1;
      }
    } else if (lastGroupKey && (!name || lastGroupKey.startsWith(`${name}|`))) {
      // Continuation row: no name, or the same recipe's name repeated on each
      // ingredient row. A DIFFERENT name with no yield is a new recipe; it used
      // to fall in here and have its ingredients merged into the recipe above.
      groupKey = lastGroupKey;
    } else if (name) {
      // New recipe without yield specified (default 0)
      groupKey = `${name}|0`;
      lastGroupKey = groupKey;
      if (!groups[groupKey]) {
        nameCounts[name] = (nameCounts[name] || 0) + 1;
      }
    } else {
      errors.push({ index: index + 1, message: "Skipping invalid row (no name/yield)" });
      return;
    }

    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push({ ...item, originalIndex: index + 1 });
  });

  const groupKeys = Object.keys(groups);

  for (const key of groupKeys) {
    const rows = groups[key];
    const mainRow = rows[0];

    // Recover original name from the key or the row
    // Key format is "Name|Yield", so split it
    const lastPipeIndex = key.lastIndexOf("|");
    const baseName = key.substring(0, lastPipeIndex);
    const yieldQtyFromKey = key.substring(lastPipeIndex + 1);

    try {
      // SMART SUFFIX LOGIC:
      // If this name appears in multiple variants (count > 1), we append suffix.
      // Else we use the clean base name.
      let finalName = baseName;
      const yieldQuantity =
        parseGlobalNumber(mainRow.yieldQuantity) || parseGlobalNumber(yieldQtyFromKey) || 1;
      const yieldUnit = mainRow.yieldUnit || "unit";

      if (nameCounts[baseName] > 1) {
        finalName = `${baseName} (${yieldQuantity} ${yieldUnit})`;
      }

      // Prepare Ingredients
      const ingredientsToCreate: Array<{ materialId: string; quantity: number; unit: string }> = [];

      const addIngredient = (materialId: string, quantity: number, unit: string) => {
        const qty = quantity || 1;
        const u = unit || "unit";
        // RecipeIngredient is unique per (recipe, material), so the same material
        // listed twice must collapse to ONE row. Sum the quantities when the units
        // match (e.g. "Eau 300 ml; Eau 200 ml" -> 500 ml); otherwise keep the
        // first occurrence (cannot represent two different units for one material).
        const existing = ingredientsToCreate.find((i) => i.materialId === materialId);
        if (existing) {
          if (existing.unit === u) existing.quantity += qty;
          return;
        }
        ingredientsToCreate.push({ materialId, quantity: qty, unit: u });
      };

      // Format A: multi-row — one ingredient per row (ingredient_name columns)
      for (const row of rows) {
        const ingName = row.ingredient_name || row.ingredientName;
        if (ingName && typeof ingName === "string" && ingName.trim()) {
          const materialId = await resolveMaterialId(storeId, ingName, {
            unit: row.ingredient_unit || row.ingredientUnit,
            sku: row.ingredient_sku,
            price: toBase(row.ingredient_price),
            stock: parseGlobalNumber(row.ingredient_stock) || 0,
            supplier: row.ingredient_supplier,
          });
          if (materialId) {
            addIngredient(
              materialId,
              parseGlobalNumber(row.ingredient_qty) ||
                parseGlobalNumber(row.ingredientQuantity) ||
                1,
              row.ingredient_unit || row.ingredientUnit || "unit"
            );
          }
        }
      }

      // Format B: combined cell — a single column listing all ingredients,
      // e.g. "Farine:500g; Eau:300ml; Sel:5g". Parse it into real ingredients
      // (it is also kept in the instructions below for human reference).
      const blobSource =
        mainRow.ingredients_text || mainRow.ingredients || mainRow.Ingredients || "";
      if (typeof blobSource === "string" && blobSource.trim()) {
        for (const ing of parseIngredientsBlob(blobSource)) {
          const materialId = await resolveMaterialId(storeId, ing.name, { unit: ing.unit });
          if (materialId) addIngredient(materialId, ing.qty, ing.unit);
        }
      }

      // Format instructions
      let instructions = mainRow.instructions || "";
      if (mainRow.ingredients_text) {
        instructions = instructions
          ? `${instructions}\n\n--- Imported Ingredients ---\n${mainRow.ingredients_text}`
          : `--- Imported Ingredients ---\n${mainRow.ingredients_text}`;
      }

      // UPSERT LOGIC FOR RECIPE
      // Check if recipe exists by NAME (Final Name)
      const existingRecipe = await prisma.recipe.findFirst({
        where: { storeId, name: { equals: finalName, mode: "insensitive" } },
      });

      if (existingRecipe) {
        // UPDATE existing recipe
        await prisma.recipe.update({
          where: { id: existingRecipe.id },
          data: {
            description: mainRow.description || undefined,
            category: mainRow.category || undefined,
            yieldQuantity,
            yieldUnit,
            productionTimeMinutes: parseGlobalNumber(mainRow.productionTimeMinutes) || 0,
            instructions: instructions || undefined,
            costPerBatch: toBase(mainRow.costPerBatch),
            updatedAt: new Date(),
            // For ingredients, simpler to delete all and recreate for accuracy in sync
            ingredients: {
              deleteMany: {},
              create: ingredientsToCreate,
            },
          },
        });
      } else {
        // CREATE new recipe
        await prisma.recipe.create({
          data: {
            storeId,
            name: finalName,
            description: mainRow.description || null,
            category: mainRow.category || null,
            yieldQuantity,
            yieldUnit,
            productionTimeMinutes: parseGlobalNumber(mainRow.productionTimeMinutes) || 0,
            instructions: instructions || null,
            costPerBatch: toBase(mainRow.costPerBatch),
            createdAt: mainRow.createdAt || new Date(),
            updatedAt: mainRow.updatedAt || new Date(),
            ingredients:
              ingredientsToCreate.length > 0
                ? {
                    create: ingredientsToCreate,
                  }
                : undefined,
          },
        });
      }

      successCount += rows.length;
    } catch (error) {
      // Log error on the main row, but maybe applies to the whole group
      errors.push({ index: mainRow.originalIndex, message: describeImportError(error) });
    }
  }

  return {
    success: successCount > 0,
    count: successCount,
    details: {
      attempted: data.length,
      succeeded: successCount,
      failed: errors.length, // Only counts failed main items roughly
      errors: errors.slice(0, 10),
    },
  };
}

// ============================================================================
// SMART ALL-IN-ONE MULTI-ENTITY IMPORT
// ============================================================================

// Schema for multi-entity import
export const multiEntityImportSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  data: z.array(z.record(z.any())).min(1, "At least one record is required"),
  /** What the import dialog says these rows are; decides a row nothing else identifies. */
  fallbackEntityType: z.enum(["supplier", "material", "recipe", "product", "menu_item"]).optional(),
});

// Extended result type for multi-entity import
export type ImportEntity = "supplier" | "material" | "recipe" | "product" | "menu_item";

/** One row the import could not write, with the reason. */
export interface ImportFailure {
  entity: ImportEntity;
  /** 1-based position within that entity's rows; null for a whole-group failure. */
  row: number | null;
  message: string;
}

/** Enough to show the pattern; a sheet with one systematic problem repeats it on every row. */
const MAX_REPORTED_FAILURES = 10;

export interface MultiEntityImportResult {
  success: boolean;
  error?: string;
  summary: {
    suppliers: { attempted: number; succeeded: number };
    materials: { attempted: number; succeeded: number };
    recipes: { attempted: number; succeeded: number };
    products: { attempted: number; succeeded: number };
    menu_items: { attempted: number; succeeded: number };
    totalSucceeded: number;
  };
  /** Why rows were not imported (capped). Absent when every row went in. */
  failures?: ImportFailure[];
  /** Rows with no name at all (blank lines, totals), which no entity can take. */
  skippedRows?: number;
}

/**
 * Detect which entity type a row best matches based on filled fields.
 * Priority:
 * 1. Check 'category' column for explicit hints (e.g., "Suppliers", "Materials", "Recipes", "Products")
 * 2. Check unique fields: Recipe > Material > Product > Supplier (most specific first)
 * Uses centralized field definitions from import-schema.ts (DRY principle)
 */
function detectEntityType(
  row: Record<string, unknown>,
  fallback?: ImportEntity
): ImportEntity | null {
  const hasValue = (field: string) =>
    row[field] !== undefined && row[field] !== "" && row[field] !== null;

  // 1. First check 'category' column for explicit entity type hints
  const category = String(row.category || "")
    .toLowerCase()
    .trim();
  if (category.includes("supplier") || category === "suppliers") return "supplier";
  if (category.includes("material") || category === "materials") return "material";
  if (category.includes("recipe") || category === "recipes") return "recipe";
  if (category.includes("product") || category === "products") return "product";

  // 1b. Explicit menu_item category hint
  if (
    category.includes("menu_item") ||
    category.includes("build your own") ||
    category.includes("byo")
  )
    return "menu_item";

  // 2. Fallback: Check in order of specificity (most specific first)
  // A row with groupName + optionName + priceAdd (and no costPrice) = BYO menu option
  if (hasValue("groupName") && hasValue("optionName") && !hasValue("costPrice")) return "menu_item";
  if (ENTITY_UNIQUE_FIELDS.recipe.some(hasValue)) return "recipe";
  if (ENTITY_UNIQUE_FIELDS.material.some(hasValue)) return "material";
  if (ENTITY_UNIQUE_FIELDS.product.some(hasValue)) return "product";
  if (ENTITY_UNIQUE_FIELDS.supplier.some(hasValue)) return "supplier";

  // Nothing in the row says what it is. Use the type chosen in the import
  // dialog; without one, a bare name is a supplier (the simplest entity). A
  // menu sheet whose rows have no price used to land in Suppliers this way.
  if (hasValue("name")) return fallback ?? "supplier";

  return null;
}

/**
 * Import BYO menu rows as a single MenuItem with modifier groups.
 *
 * Each row represents one option within a modifier group:
 *   { menuItemName, groupName, optionName, priceAdd, isRequired?, maxSelections? }
 *
 * Rows are grouped by menuItemName → grouped by groupName → options[].
 * One MenuItem is created (or found by name) per unique menuItemName.
 */
async function importMenuItems(
  rows: Record<string, any>[],
  storeId: string
): Promise<ImportResult> {
  let count = 0;
  const errors: Array<{ index: number; message: string }> = [];

  // Find the storefront for this store
  const storefront = await prisma.storefront.findFirst({ where: { storeId } });
  if (!storefront) {
    return { success: false, count: 0, error: "No storefront found for this store." };
  }

  // Group rows by menuItemName (fall back to "Build Your Own")
  const byItem: Record<string, typeof rows> = {};
  for (const row of rows) {
    const itemName = String(row.menuItemName || row.name || "Build Your Own").trim();
    (byItem[itemName] ??= []).push(row);
  }

  for (const [itemName, itemRows] of Object.entries(byItem)) {
    try {
      // Build modifiers JSON from the option rows
      const groupMap: Record<
        string,
        {
          isRequired: boolean;
          maxSelections: number;
          options: Array<{ name: string; priceAdd: number }>;
        }
      > = {};

      for (const row of itemRows) {
        const groupName = String(row.groupName || "Options").trim();
        const optionName = String(row.optionName || row.option || "").trim();
        if (!optionName) continue;
        const priceAdd = parseImportedMoney(String(row.priceAdd ?? row.price ?? 0));
        if (!groupMap[groupName]) {
          // Groups named BASE/MAIN/required or numbered "1 …" default to required
          const nameUpper = groupName.toUpperCase();
          const looksRequired =
            nameUpper.startsWith("BASE") ||
            nameUpper.startsWith("MAIN") ||
            nameUpper.startsWith("1 ") ||
            row.isRequired === true ||
            row.isRequired === "true" ||
            row.isRequired === 1;
          groupMap[groupName] = {
            isRequired: !!looksRequired,
            maxSelections: Number(row.maxSelections) || 1,
            options: [],
          };
        }
        groupMap[groupName].options.push({ name: optionName, priceAdd: Number(priceAdd) });
      }

      // For non-required groups, default maxSelections to the option count if not set
      for (const [, group] of Object.entries(groupMap)) {
        if (!group.isRequired && group.maxSelections === 1 && group.options.length > 1) {
          group.maxSelections = group.options.length;
        }
      }

      const modifiers = Object.entries(groupMap).map(([name, g]) => ({
        name,
        isRequired: g.isRequired,
        maxSelections: g.maxSelections,
        options: g.options,
      }));

      // Find or create the "Build Your Own" category
      let category = await prisma.menuCategory.findFirst({
        where: { storefrontId: storefront.id, name: "Build Your Own" },
      });
      if (!category) {
        category = await prisma.menuCategory.create({
          data: { storefrontId: storefront.id, name: "Build Your Own", displayOrder: 0 },
        });
      }

      // Upsert the MenuItem (match by name within this storefront)
      const existing = await prisma.menuItem.findFirst({
        where: { storefrontId: storefront.id, name: itemName },
      });
      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            modifiers: modifiers as unknown as object,
            categoryId: category.id,
            buildYourOwn: true,
          },
        });
      } else {
        await storefrontService.createMenuItem(storefront.id, {
          name: itemName,
          price: 0,
          categoryId: category.id,
          department: "KITCHEN",
          displayOrder: 0,
          isAvailable: true,
          showOnCashier: true,
          isFeatured: false,
          modifiers,
          // The import's whole point: the groups are the build steps.
          buildYourOwn: true,
        });
      }
      count++;
    } catch (err) {
      errors.push({ index: 0, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const total = Object.keys(byItem).length;
  return {
    success: errors.length < total,
    count,
    details: { attempted: total, succeeded: count, failed: errors.length, errors },
  };
}

/**
 * Smart All-in-One Multi-Entity Import, for an already-authorized store.
 *
 * 1. Analyzes each row to detect its entity type
 * 2. Groups rows by entity type
 * 3. Imports in dependency order: Supplier → Material → Recipe → Product → MenuItem
 * 4. Returns a detailed breakdown of results
 */
export async function importCatalogRows(
  storeId: string,
  data: Record<string, any>[],
  fallbackEntityType?: ImportEntity
): Promise<MultiEntityImportResult> {
  const defaultSummary = {
    suppliers: { attempted: 0, succeeded: 0 },
    materials: { attempted: 0, succeeded: 0 },
    recipes: { attempted: 0, succeeded: 0 },
    products: { attempted: 0, succeeded: 0 },
    menu_items: { attempted: 0, succeeded: 0 },
    totalSucceeded: 0,
  };

  // 4. Group rows by detected entity type
  const grouped: {
    supplier: Record<string, any>[];
    material: Record<string, any>[];
    recipe: Record<string, any>[];
    product: Record<string, any>[];
    menu_item: Record<string, any>[];
  } = {
    supplier: [],
    material: [],
    recipe: [],
    product: [],
    menu_item: [],
  };

  const now = new Date();
  let skippedRows = 0;
  for (const row of data) {
    const entityType = detectEntityType(row, fallbackEntityType);
    if (entityType) {
      grouped[entityType].push({
        ...row,
        storeId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      skippedRows++;
    }
  }

  // 5. Import in dependency order
  const summary = { ...defaultSummary };

  // The per-entity importers already know why each row failed; this used to
  // drop all of it and answer "success, 0 of 91" with no reason on screen.
  const failures: ImportFailure[] = [];
  const collectFailures = (entity: ImportEntity, result: ImportResult) => {
    if (result.error) failures.push({ entity, row: null, message: result.error });
    for (const e of result.details?.errors ?? []) {
      failures.push({ entity, row: e.index, message: e.message });
    }
  };

  // 5a. Suppliers first (no dependencies)
  if (grouped.supplier.length > 0) {
    summary.suppliers.attempted = grouped.supplier.length;
    const result = await importSuppliers(grouped.supplier, storeId);
    summary.suppliers.succeeded = result.count || 0;
    collectFailures("supplier", result);
  }

  // 5b. Materials second (may reference suppliers)
  if (grouped.material.length > 0) {
    summary.materials.attempted = grouped.material.length;
    const result = await importMaterials(grouped.material, storeId);
    summary.materials.succeeded = result.count || 0;
    collectFailures("material", result);
  }

  // 5c. Recipes third (reference materials, may cascade-create materials & suppliers)
  if (grouped.recipe.length > 0) {
    summary.recipes.attempted = grouped.recipe.length;
    const result = await importRecipes(grouped.recipe, storeId);
    summary.recipes.succeeded = result.count || 0;
    collectFailures("recipe", result);
  }

  // 5d. Products (may reference recipes)
  if (grouped.product.length > 0) {
    summary.products.attempted = grouped.product.length;
    const result = await importProducts(grouped.product, storeId);
    summary.products.succeeded = result.count || 0;
    collectFailures("product", result);
  }

  // 5e. Menu items (BYO modifier groups → MenuItem.modifiers)
  if (grouped.menu_item.length > 0) {
    summary.menu_items.attempted = grouped.menu_item.length;
    const result = await importMenuItems(grouped.menu_item, storeId);
    summary.menu_items.succeeded = result.count || 0;
    collectFailures("menu_item", result);
  }

  // 6. Calculate totals
  summary.totalSucceeded =
    summary.suppliers.succeeded +
    summary.materials.succeeded +
    summary.recipes.succeeded +
    summary.products.succeeded +
    summary.menu_items.succeeded;

  const attempted =
    summary.suppliers.attempted +
    summary.materials.attempted +
    summary.recipes.attempted +
    summary.products.attempted +
    summary.menu_items.attempted;
  const reported = failures.slice(0, MAX_REPORTED_FAILURES);

  // Nothing went in at all: that is a failed import, not a successful one
  // that happened to import zero rows.
  if (attempted > 0 && summary.totalSucceeded === 0 && failures.length > 0) {
    return {
      success: false,
      error: failures[0].message,
      summary,
      failures: reported,
      ...(skippedRows > 0 && { skippedRows }),
    };
  }
  // Every row was blank or nameless: nothing was even attempted.
  if (attempted === 0) {
    return {
      success: false,
      error: "No row has a name, so there was nothing to import.",
      summary,
      skippedRows,
    };
  }

  return {
    success: true,
    summary,
    ...(reported.length > 0 && { failures: reported }),
    ...(skippedRows > 0 && { skippedRows }),
  };
}
/**
 * Import rows that are all one known entity, skipping row-type detection
 * (which reads `category` hints, so a product category like "Suppliers"
 * could be misread). For callers that already know what the rows are, such as
 * the Claude connector's import_catalog.
 */
export async function importCatalogEntity(
  storeId: string,
  entity: Exclude<ImportEntity, "menu_item">,
  rows: Record<string, any>[]
): Promise<ImportResult> {
  const now = new Date();
  const prepared = rows.map((row) => ({ ...row, storeId, createdAt: now, updatedAt: now }));
  switch (entity) {
    case "supplier":
      return importSuppliers(prepared, storeId);
    case "material":
      return importMaterials(prepared, storeId);
    case "recipe":
      return importRecipes(prepared, storeId);
    case "product":
      return importProducts(prepared, storeId);
  }
}
