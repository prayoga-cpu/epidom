import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  MaterialFields,
  ProductFields,
  SupplierFields,
  RecipeFields,
  importAnalysisSchema,
} from "@/lib/ai/import-schema";
import Papa from "papaparse";

// Use OpenAI (gpt-4o) for high accuracy, fallback to Google Gemini if no OpenAI key
const model = process.env.OPENAI_API_KEY ? openai("gpt-4o") : google("gemini-1.5-flash");

export async function POST(req: Request) {
  try {
    // 1. Auth Check
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse Input
    const body = await req.json();
    const { csvPreview, type } = z
      .object({
        csvPreview: z.string().max(10000), // Limit input size
        type: z.enum(["material", "product", "supplier", "recipe"]),
      })
      .parse(body);

    // 3. Select Target Schema (SMART ALL-IN-ONE MODE)
    // Instead of restricting schema based on type, we allow ALL fields to be mapped.
    // This enables the "Smart Wizard" to detect mixed entities in a single CSV.

    // Combine all unique options
    const allFieldOptions = Array.from(
      new Set([
        ...MaterialFields.options,
        ...ProductFields.options,
        ...SupplierFields.options,
        ...RecipeFields.options,
      ])
    );

    const targetFieldSchema = z.enum(allFieldOptions as [string, ...string[]]);

    const dynamicMappingSchema = z.object({
      targetField: targetFieldSchema, // Restrict to specific fields
      csvHeader: z.string(),
      csvIndex: z.number(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      reasoning: z.string(),
      transform: z
        .enum([
          "NONE",
          "EXTRACT_NUMBER",
          "EXTRACT_INT",
          "BOOLEAN_Y_N",
          "DATE_STANDARD",
          "UPPERCASE",
          "LOWERCASE",
          "TITLECASE",
        ])
        .default("NONE"), // FIX: Default to NONE if AI forgets this field
    });

    // We rebuild the full schema with the dynamic target field
    const analysisSchema = z.object({
      structure: z.object({
        hasHeader: z.boolean(),
        headerRowIndex: z.number().int(),
        dataStartIndex: z.number().int(),
        footerRowsToSkip: z.number().int(),
      }),
      mappings: z.array(dynamicMappingSchema),
      summary: z.string(),
    });

    // 4. Build context-aware prompt based on entity type
    const domainContext = `
## EPIDOM SYSTEM CONTEXT

EPIDOM is an **Inventory & Recipe Management System for F&B Businesses** (Restaurants, Cafes, Bakeries, Catering).
The system is primarily used in **Indonesia**, so CSV data often uses:
- Indonesian terms: "Nama", "Harga", "Satuan", "Stok", "Bahan Baku", "Pemasok"
- Indonesian number format: 1.234.567,89 (dot as thousands, comma as decimal)
- Currency: "Rp", "IDR", or plain numbers

## ENTITY RELATIONSHIPS

\`\`\`
┌─────────────┐     supplies      ┌─────────────┐
│  SUPPLIER   │ ─────────────────▶│  MATERIAL   │
│ (Pemasok)   │                   │ (Bahan Baku)│
└─────────────┘                   └──────┬──────┘
                                         │
                                         │ used in
                                         ▼
                                  ┌─────────────┐
                                  │   RECIPE    │
                                  │   (Resep)   │
                                  └──────┬──────┘
                                         │
                                         │ produces
                                         ▼
                                  ┌─────────────┐
                                  │   PRODUCT   │
                                  │  (Produk)   │
                                  └─────────────┘
\`\`\`

### 1. MATERIAL (Bahan Baku / Raw Materials)
- The **ingredients** used to make recipes
- Examples: Flour, Sugar, Chicken, Cooking Oil, Salt
- Key fields: name, unit (kg/gram/liter/pcs), unitCost (cost per unit), currentStock, minStock
- Indonesian terms: "Bahan", "Bahan Baku", "Ingredient", "Material"

### 2. SUPPLIER (Pemasok / Vendor)
- Companies or individuals who **supply materials**
- Examples: PT Sumber Rejeki, Toko Beras Makmur
- Key fields: name, contactPerson, phone, email, address
- Indonesian terms: "Pemasok", "Supplier", "Vendor", "Toko"

### 3. RECIPE (Resep)
- Instructions for **combining materials** to create products
- Examples: Nasi Goreng Recipe, Chocolate Cake Recipe
- Key fields: name, yieldQuantity, yieldUnit, productionTimeMinutes, instructions
- Recipes have **ingredients** (list of materials with quantities)
- Indonesian terms: "Resep", "Recipe", "Menu"

### 4. PRODUCT (Produk)
- **Finished goods** sold to customers (produced from recipes)
- Examples: Nasi Goreng Special, Chocolate Cake Slice
- Key fields: name, sellingPrice, costPrice, currentStock, category
- Indonesian terms: "Produk", "Menu", "Item Jual", "Barang Jadi"
`;

    // 3. Define Domain Context (Enhanced with Universal/Global Logic)
    const epidomKnowledgeBase = `
    ### EPIDOM KNOWLEDGE BASE (GLOBAL F&B MANAGEMENT)
    You are importing data for a Universal Restaurant Management System.
    The data can be in ANY language (English, Indonesian, Spanish, French, etc.).

    **1. ENTITIES & RELATIONSHIPS:**
    - **Material (Ingredients):** Raw items bought from suppliers (e.g., "Flour", "Chicken", "Sugar").
      - Key Fields: unitCost, currentStock, unit, supplierName.
    - **Product (Menu Items):** Items sold to customers (e.g., "Fried Rice", "Latte").
      - Key Fields: sellingPrice, costPrice, category.
      - **Heuristic:** Columns like "Selling Price" or "Menu Price" strongly indicate a PRODUCT.
    - **Supplier (Vendors):** Companies/People who sell Materials.
      - Key Fields: name, contactPerson, phone, email, address.
    - **Recipe:** The instructional blueprint.
      - **Context:** Look for "Yield", "Production Time", or "Ingredients List".

    **2. GLOBAL TERMINOLOGY GUIDE (MULTI-LANGUAGE):**
     - **Money/Cost:** "Price", "Cost", "Harga", "Prix", "Precio", "Amount", "Value", "$", "€", "£", "Rp".
     - **Quantity/Stock:** "Qty", "Quantity", "Stock", "Count", "Jumlah", "Stok", "Balance", "Cant".
     - **Units:** "Unit", "UoM", "Satuan", "Measure", "Pack", "Size", "Unidad".
     - **Names:** "Name", "Item", "Product", "Description", "Nama", "Nombre", "Nom", "Description".

    **3. INTELLIGENT MAPPING RULES:**
    - **Numeric vs String:** NEVER map a strictly numeric column (e.g., "5000", "10.5") to a NAME field.
    - **String vs Numeric:** NEVER map a text column (e.g., "Chicken", "Kg") to a PRICE/QUANTITY field.
    - **Units:** "g", "kg", "pcs", "lb", "oz" are UNITS. Map to 'unit' or 'yieldUnit', NEVER 'qty'.
    - **Phone Numbers:** High-digit numbers starting with 0, +, or ( ) are Phones. Map to 'phone'.
    - **Prices:** Contextually large numbers are usually Money.

    **4. SPECIFIC FIELD MAPPING STRATEGY:**
    - **Material Fields:** [${MaterialFields.options.join(", ")}]
    - **Product Fields:** [${ProductFields.options.join(", ")}]
    - **Supplier Fields:** [${SupplierFields.options.join(", ")}]
    - **Recipe Fields:** [${RecipeFields.options.join(", ")}]
    `;

    // Type-specific instructions
    const typeInstructions: Record<string, string> = {
      material: `
### MATERIAL IMPORT SPECIFICS
- "Harga Beli", "Harga Satuan", "Unit Cost", "Cost" → unitCost
- "Stok", "Stock", "Qty", "Jumlah" → currentStock
- "Satuan", "Unit", "UoM" → unit (kg, gram, liter, pcs, pack, box)
- "Min Stok", "Safety Stock", "Reorder Point" → minStock
- "Max Stok", "Maximum Stock" → maxStock
- "Kategori", "Category", "Jenis" → category
- "SKU", "Kode", "Code" → sku
- "Supplier", "Pemasok" → supplierName
- If you see "Selling Price", map it to "sellingPrice" (Product Field).`,

      product: `
### PRODUCT IMPORT SPECIFICS
- "Harga Jual", "Selling Price", "Price" → sellingPrice
- "Harga Pokok", "HPP", "Cost", "COGS" → costPrice
- "Stok", "Stock" → currentStock
- "Kategori", "Category" → category (Food, Beverage, Dessert, etc.)
- If you see "Bahan Baku" related fields, map them to Material/Recipe fields (e.g. ingredient_name).`,

      supplier: `
### SUPPLIER IMPORT SPECIFICS
- "Nama Pemasok", "Supplier Name", "Vendor" → name
- "PIC", "Contact Person", "Nama Kontak" → contactPerson
- "Telp", "Phone", "HP", "No HP", "WhatsApp" → phone
- "Email", "E-mail" → email
- "Alamat", "Address" → address
- "Kota", "City" → city
- "Catatan", "Notes", "Keterangan" → notes`,

      recipe: `
### RECIPE IMPORT SPECIFICS
- "Nama Resep", "Recipe Name", "Menu" → name
- "Deskripsi", "Description" → description
- "Kategori", "Category" → category
- "Hasil", "Yield", "Porsi" → yieldQuantity
- "Satuan Hasil", "Yield Unit" → yieldUnit (portion, batch, pcs)
- "Waktu Produksi", "Production Time", "Prep Time" (in minutes) → productionTimeMinutes
- "Instruksi", "Instructions", "Cara Buat" → instructions
- "HPP", "Cost per Batch", "Biaya Produksi" → costPerBatch

**SPECIAL HANDLING FOR INGREDIENTS:**
If CSV contains ingredient lists (e.g., "Ayam 500g, Garam 10g, Bawang 50g"), map to 'ingredients_text'.
The system will parse this text later.`,
    };

    // 4. Parse CSV & Create Column Profiles (Robust Transposition)
    // Instead of sending rows which can be sparse/confusing, we send "Column Profiles"
    // This isolates each column's data, preventing "shifting" errors.
    const parsed = Papa.parse(csvPreview, {
      header: false,
      skipEmptyLines: true,
      preview: 20, // Parse first 20 rows to get good samples
    });

    const rows = parsed.data as string[][];
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    // Determine max columns
    const maxCols = Math.max(...rows.map((r) => r.length));
    const columnProfiles = [];
    const autoMatches: string[] = [];

    // Analyze each column individually
    for (let c = 0; c < maxCols; c++) {
      const headerVal = rows[0][c] || "";
      const sampleValues = rows
        .slice(1)
        .map((r) => r[c])
        .filter((val) => val && val.trim() !== "") // Only non-empty
        .slice(0, 5); // Take top 5 samples

      // Auto-Match Logic (Hybrid)
      const cleanHeader = headerVal.toLowerCase().replace(/[^a-z0-9]/g, "");
      let bestMatch = "";
      if (cleanHeader) {
        bestMatch =
          allFieldOptions.find((opt) => {
            const cleanOpt = opt.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanHeader === cleanOpt || cleanOpt === cleanHeader; // Strict match preferred
          }) || "";

        if (bestMatch) {
          autoMatches.push(`- Column ${c} ("${headerVal}") matches field "${bestMatch}"`);
        }
      }

      columnProfiles.push(
        `
COLUMN INDEX ${c}:
- Header (Row 0): "${headerVal}"
- Sample Values: ${JSON.stringify(sampleValues)}
- Auto-Detected Match: ${bestMatch ? bestMatch : "None"}
      `.trim()
      );
    }

    // 5. Generate AI Analysis
    const result = await generateObject({
      model: model as any,
      schema: analysisSchema,
      prompt: `
      You are a SENIOR DATA ENGINEER for EPIDOM. You are extremely smart, precise, and logical.
      Your task is to map CSV columns to database fields with 100% accuracy.

      **CONTEXT & RULES:**
      ${epidomKnowledgeBase}

      **LAYER 1: AUTOMATED HEADER ANALYSIS (Strong Hints):**
      The system has pre-analyzed headers and found these potential matches. IGNORE them only if Sample Values prove them wrong.
      ${autoMatches.join("\n")}

      **LAYER 2: YOUR JUDGEMENT (SAMPLES & CONTEXT):**
      **TARGET FIELDS:** ${allFieldOptions.join(", ")}

      **INPUT DATA (COLUMN PROFILES):**
      Analyze these columns. LOOK AT THE SAMPLES.

      ${columnProfiles.join("\n\n")}

      **INSTRUCTIONS:**
      1. **Check Layer 1:** If a column has an Auto-Match, heavily bias towards it.
      2. **Verify with Samples:**
         - If Header says "Price" but samples are "Chicken", trust Samples (map to Name).
         - If Header says "Name" but samples are "5000", trust Samples (map to Price/Qty).
      3. **Mixed Entity Mode:** Map everything possible.
      4. **Logic Check:**
         - Don't map "500" to "name".
         - Don't map "Chicken" to "price".
         - Don't map "kg" to "quantity".

      **OUTPUT:**
      Return a JSON object with 'mappings' for every useful column.
    `,
    });

    const aiResult = result.object;

    // 6. POST-PROCESS: Force-Correct AI Hallucinations using Auto-Matches
    // Logic: Code > AI. If header says "Phone", it IS "Phone".

    const forcedMatches = new Map<number, string>();
    const rowsForForce = parsed.data as string[][];
    // Use the first row as header.
    const headerRow = rowsForForce[0] || [];

    headerRow.forEach((hVal, c) => {
      if (!hVal) return;
      const cleanH = hVal.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!cleanH) return;

      // Find best matching field
      const bestMatch = allFieldOptions.find((opt) => {
        const cleanOpt = opt.toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanH === cleanOpt;
      });

      if (bestMatch) {
        forcedMatches.set(c, bestMatch);
      }
    });

    const finalMappings = aiResult.mappings.map((m) => {
      // If this column has a Forced Field based on Header
      if (forcedMatches.has(m.csvIndex)) {
        const forcedField = forcedMatches.get(m.csvIndex)!;

        // If AI guessed differently, CORRECT IT.
        // Also, if AI guessed same, we still confirm it.
        return {
          ...m,
          targetField: forcedField,
          confidence: "HIGH",
          reasoning: `Verified: Header '${m.csvHeader}' aligns with schema field '${forcedField}'.`,
        };
      }
      return m;
    });

    // Remove duplicates? Ensure only one column per index?
    // Actually, one index -> one mapping is standard.

    return NextResponse.json({
      ...aiResult,
      mappings: finalMappings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input format", details: error.errors },
        { status: 400 }
      );
    }
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: "Failed to analyze CSV" }, { status: 500 });
  }
}
