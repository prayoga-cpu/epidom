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

    // 3. Select Target Schema based on Type
    // This reduces "Analysis Space" for AI, increasing accuracy
    let targetFieldSchema: any = MaterialFields;
    if (type === "product") targetFieldSchema = ProductFields;
    if (type === "supplier") targetFieldSchema = SupplierFields;
    if (type === "recipe") targetFieldSchema = RecipeFields;

    const dynamicMappingSchema = z.object({
      targetField: targetFieldSchema, // Restrict to specific fields
      csvHeader: z.string(),
      csvIndex: z.number(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      reasoning: z.string(),
      transform: z.enum([
        "NONE",
        "EXTRACT_NUMBER",
        "EXTRACT_INT",
        "BOOLEAN_Y_N",
        "DATE_STANDARD",
        "UPPERCASE",
        "LOWERCASE",
        "TITLECASE",
      ]),
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
- If you see "Harga Jual" or "Selling Price", this is NOT a material (it's a product). Set confidence LOW.`,

      product: `
### PRODUCT IMPORT SPECIFICS
- "Harga Jual", "Selling Price", "Price" → sellingPrice
- "Harga Pokok", "HPP", "Cost", "COGS" → costPrice
- "Stok", "Stock" → currentStock
- "Kategori", "Category" → category (Food, Beverage, Dessert, etc.)
- If you see "Bahan Baku" or ingredient-related terms, this is NOT a product (it's a material). Set confidence LOW.`,

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

    const result = await generateObject({
      model: model as any,
      schema: analysisSchema,
      prompt: `
You are an expert Data Analyst for EPIDOM, an Indonesian F&B Inventory Management System.

${domainContext}

---

## YOUR TASK

Analyze the CSV below and map columns to **${type.toUpperCase()}** entity fields.

**Available Target Fields:** ${JSON.stringify(
        type === "material"
          ? MaterialFields.options
          : type === "product"
            ? ProductFields.options
            : type === "supplier"
              ? SupplierFields.options
              : RecipeFields.options
      )}

${typeInstructions[type]}

---

## INPUT CSV SNIPPET

\`\`\`csv
${csvPreview}
\`\`\`

---

## INSTRUCTIONS

1. **Structure Discovery**
   - Skip junk rows (titles, dates, empty rows, totals, "Daftar...", "Laporan...")
   - Find the HEADER row (contains column names)
   - Find where DATA actually starts (first row after header)

2. **Column Mapping**
   - Match CSV columns to target fields based on semantic meaning
   - Consider Indonesian terminology
   - Handle number formats: "Rp 50.000" → 50000, "1.234,56" → 1234.56

3. **Confidence Levels**
   - HIGH: Clear match (e.g., "Nama Bahan" → name for material)
   - MEDIUM: Likely match but needs verification
   - LOW: Ambiguous or uncertain match

4. **Transforms**
   - EXTRACT_NUMBER: For prices/quantities with currency/text mixed
   - TITLECASE: For names that need capitalization
   - UPPERCASE/LOWERCASE: For standardization

5. **Edge Cases**
   - If a column doesn't match any field, you may skip it in mapping
   - If you suspect the data is for a DIFFERENT entity type, set all confidences to LOW

Output JSON matching the schema exactly.
`,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze CSV. Ensure API Key is set." },
      { status: 500 }
    );
  }
}
