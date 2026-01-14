/**
 * Store Context Loader for AI Import Agent
 *
 * Loads dynamic, store-specific context to help AI make
 * better decisions based on existing data and patterns.
 */

import { prisma } from "@/lib/prisma";

/**
 * Summary of existing entities for AI context
 */
export interface StoreContextData {
  // Existing entities summary
  existingSuppliers: Array<{
    id: string;
    name: string;
    normalizedName: string;
  }>;

  existingMaterials: Array<{
    id: string;
    sku: string;
    name: string;
    category: string | null;
    unit: string;
  }>;

  existingProducts: Array<{
    id: string;
    sku: string;
    name: string;
    category: string | null;
  }>;

  existingRecipes: Array<{
    id: string;
    name: string;
    category: string | null;
  }>;

  // Store patterns
  patterns: {
    commonCategories: {
      materials: string[];
      products: string[];
      recipes: string[];
    };
    commonUnits: string[];
    skuPatterns: {
      materials: string | null;
      products: string | null;
    };
    priceRanges: {
      materialUnitCost: { min: number; max: number; avg: number } | null;
      productCostPrice: { min: number; max: number; avg: number } | null;
      productSellingPrice: { min: number; max: number; avg: number } | null;
    };
  };

  // Statistics
  stats: {
    totalMaterials: number;
    totalProducts: number;
    totalSuppliers: number;
    totalRecipes: number;
  };
}

/**
 * Normalize string for fuzzy matching
 */
function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\-_]/g, " ")
    .replace(/\b(pt|cv|inc|ltd|corp|llc|co)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract pattern from SKUs
 */
function extractSkuPattern(skus: string[]): string | null {
  if (skus.length < 3) return null;

  // Check for common prefix
  const firstSku = skus[0];
  const prefixMatch = firstSku.match(/^([A-Z]{2,4}[-_]?)/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const matchCount = skus.filter((s) => s.startsWith(prefix)).length;
    if (matchCount / skus.length > 0.7) {
      return `${prefix}XXX`;
    }
  }

  return null;
}

/**
 * Calculate price range statistics
 */
function calculatePriceRange(
  prices: number[]
): { min: number; max: number; avg: number } | null {
  if (prices.length === 0) return null;

  const validPrices = prices.filter((p) => p > 0);
  if (validPrices.length === 0) return null;

  return {
    min: Math.min(...validPrices),
    max: Math.max(...validPrices),
    avg: validPrices.reduce((a, b) => a + b, 0) / validPrices.length,
  };
}

/**
 * Get most common values from array
 */
function getMostCommon(values: (string | null)[], limit: number = 5): string[] {
  const counts = new Map<string, number>();

  values.forEach((v) => {
    if (v) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

/**
 * Load store context for AI import
 *
 * This function fetches existing entities and calculates patterns
 * to help AI make better mapping and matching decisions.
 */
export async function loadStoreContext(storeId: string): Promise<StoreContextData> {
  // Fetch existing entities in parallel
  const [suppliers, materials, products, recipes] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId },
      select: { id: true, name: true },
      take: 200,
    }),
    prisma.material.findMany({
      where: { storeId },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        unitCost: true,
      },
      take: 500,
    }),
    prisma.product.findMany({
      where: { storeId },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        costPrice: true,
        sellingPrice: true,
      },
      take: 500,
    }),
    prisma.recipe.findMany({
      where: { storeId },
      select: { id: true, name: true, category: true },
      take: 200,
    }),
  ]);

  // Process suppliers
  const existingSuppliers = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    normalizedName: normalizeForMatching(s.name),
  }));

  // Process materials
  const existingMaterials = materials.map((m) => ({
    id: m.id,
    sku: m.sku,
    name: m.name,
    category: m.category,
    unit: m.unit,
  }));

  // Process products
  const existingProducts = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
  }));

  // Process recipes
  const existingRecipes = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
  }));

  // Calculate patterns
  const patterns = {
    commonCategories: {
      materials: getMostCommon(materials.map((m) => m.category)),
      products: getMostCommon(products.map((p) => p.category)),
      recipes: getMostCommon(recipes.map((r) => r.category)),
    },
    commonUnits: getMostCommon(materials.map((m) => m.unit)),
    skuPatterns: {
      materials: extractSkuPattern(materials.map((m) => m.sku)),
      products: extractSkuPattern(products.map((p) => p.sku)),
    },
    priceRanges: {
      materialUnitCost: calculatePriceRange(materials.map((m) => Number(m.unitCost))),
      productCostPrice: calculatePriceRange(products.map((p) => Number(p.costPrice))),
      productSellingPrice: calculatePriceRange(products.map((p) => Number(p.sellingPrice))),
    },
  };

  return {
    existingSuppliers,
    existingMaterials,
    existingProducts,
    existingRecipes,
    patterns,
    stats: {
      totalMaterials: materials.length,
      totalProducts: products.length,
      totalSuppliers: suppliers.length,
      totalRecipes: recipes.length,
    },
  };
}

/**
 * Format store context for AI prompt injection
 */
export function formatStoreContextForAI(context: StoreContextData): string {
  const lines: string[] = [
    "## STORE-SPECIFIC CONTEXT",
    "",
    `This store has: ${context.stats.totalMaterials} materials, ${context.stats.totalProducts} products, ${context.stats.totalSuppliers} suppliers, ${context.stats.totalRecipes} recipes.`,
    "",
  ];

  // Add existing suppliers for matching
  if (context.existingSuppliers.length > 0) {
    lines.push("### Existing Suppliers (for matching):");
    context.existingSuppliers.slice(0, 20).forEach((s) => {
      lines.push(`- "${s.name}" (normalized: "${s.normalizedName}")`);
    });
    if (context.existingSuppliers.length > 20) {
      lines.push(`- ... and ${context.existingSuppliers.length - 20} more`);
    }
    lines.push("");
  }

  // Add common categories
  if (context.patterns.commonCategories.materials.length > 0) {
    lines.push(
      `### Common Material Categories: ${context.patterns.commonCategories.materials.join(", ")}`
    );
  }
  if (context.patterns.commonCategories.products.length > 0) {
    lines.push(
      `### Common Product Categories: ${context.patterns.commonCategories.products.join(", ")}`
    );
  }

  // Add common units
  if (context.patterns.commonUnits.length > 0) {
    lines.push(`### Common Units: ${context.patterns.commonUnits.join(", ")}`);
  }

  // Add SKU patterns
  if (context.patterns.skuPatterns.materials) {
    lines.push(`### Material SKU Pattern: ${context.patterns.skuPatterns.materials}`);
  }
  if (context.patterns.skuPatterns.products) {
    lines.push(`### Product SKU Pattern: ${context.patterns.skuPatterns.products}`);
  }

  // Add price ranges
  if (context.patterns.priceRanges.materialUnitCost) {
    const range = context.patterns.priceRanges.materialUnitCost;
    lines.push(
      `### Material Price Range: ${range.min.toFixed(0)} - ${range.max.toFixed(0)} (avg: ${range.avg.toFixed(0)})`
    );
  }
  if (context.patterns.priceRanges.productSellingPrice) {
    const range = context.patterns.priceRanges.productSellingPrice;
    lines.push(
      `### Product Price Range: ${range.min.toFixed(0)} - ${range.max.toFixed(0)} (avg: ${range.avg.toFixed(0)})`
    );
  }

  lines.push("");
  lines.push("Use this information to make better matching and validation decisions.");

  return lines.join("\n");
}

/**
 * Find matching supplier by name (fuzzy)
 */
export function findMatchingSupplier(
  name: string,
  existingSuppliers: StoreContextData["existingSuppliers"],
  threshold: number = 0.8
): { id: string; name: string; similarity: number } | null {
  const normalizedInput = normalizeForMatching(name);

  let bestMatch: { id: string; name: string; similarity: number } | null = null;

  for (const supplier of existingSuppliers) {
    // Calculate simple similarity (Jaccard-like)
    const inputWords = new Set(normalizedInput.split(" ").filter((w) => w.length > 1));
    const supplierWords = new Set(supplier.normalizedName.split(" ").filter((w) => w.length > 1));

    if (inputWords.size === 0 || supplierWords.size === 0) continue;

    const intersection = [...inputWords].filter((w) => supplierWords.has(w)).length;
    const union = new Set([...inputWords, ...supplierWords]).size;
    const similarity = intersection / union;

    if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { id: supplier.id, name: supplier.name, similarity };
    }
  }

  return bestMatch;
}

/**
 * Find matching material by name or SKU
 */
export function findMatchingMaterial(
  nameOrSku: string,
  existingMaterials: StoreContextData["existingMaterials"]
): { id: string; name: string; sku: string } | null {
  const normalized = nameOrSku.toLowerCase().trim();

  // Exact SKU match
  const skuMatch = existingMaterials.find((m) => m.sku.toLowerCase() === normalized);
  if (skuMatch) return skuMatch;

  // Exact name match
  const nameMatch = existingMaterials.find((m) => m.name.toLowerCase() === normalized);
  if (nameMatch) return nameMatch;

  // Partial name match (contains)
  const partialMatch = existingMaterials.find(
    (m) => m.name.toLowerCase().includes(normalized) || normalized.includes(m.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  return null;
}
