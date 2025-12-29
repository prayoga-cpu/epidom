import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // DATABASE ACCESS
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
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse Input (Now includes storeId)
    const body = await req.json();
    const { csvPreview, type, storeId } = z
      .object({
        csvPreview: z.string().max(20000), // Increased limit for better context
        type: z.enum(["material", "product", "supplier", "recipe"]),
        storeId: z.string().uuid(),
      })
      .parse(body);

    // 3. FETCH AGENT MEMORY (Context from Database)
    // The Agent needs to know what already exists to make smart decisions.
    const [existingSuppliers, existingMaterials, existingProducts, existingUnits] = await Promise.all([
      prisma.supplier.findMany({
        where: { storeId },
        select: { name: true, id: true },
        take: 100, // Give AI context of top 100 suppliers
      }),
      prisma.material.findMany({
        where: { storeId },
        select: { name: true, unit: true },
        take: 100,
      }),
      prisma.product.findMany({
        where: { storeId },
        select: { name: true },
        take: 100,
      }),
      // Get unique units used in this store
      prisma.material.groupBy({
        by: ["unit"],
        where: { storeId },
        _count: true,
        orderBy: { _count: { unit: "desc" } },
        take: 20,
      }),
    ]);

    const supplierNames = existingSuppliers.map((s) => s.name);
    const materialNames = existingMaterials.map((m) => m.name);
    const productNames = existingProducts.map((p) => p.name);
    const commonUnits = existingUnits.map((u) => u.unit);

    // 4. PREPARE AGENT TOOLING (Schema Definition)

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
      targetField: targetFieldSchema,
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
        .default("NONE"),
    });

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

    // 5. Parse CSV & Create Deep Column Profiles
    const parsed = Papa.parse(csvPreview, {
      header: false,
      skipEmptyLines: true,
      preview: 25, // Increased preview rows
    });

    const rows = parsed.data as string[][];
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    const maxCols = Math.max(...rows.map((r) => r.length));
    const columnProfiles = [];
    const autoMatches: string[] = [];

    // Analyze each column individually
    for (let c = 0; c < maxCols; c++) {
      const headerVal = rows[0][c] || "";
      const sampleValues = rows
        .slice(1)
        .map((r) => r[c])
        .filter((val) => val && val.trim() !== "")
        .slice(0, 8); // Analyze more samples

      // Auto-Match Suggestion (Keyword Matching) - BUT ONLY AS A HINT
      const cleanHeader = headerVal.toLowerCase().replace(/[^a-z0-9]/g, "");
      let bestMatch = "";
      if (cleanHeader) {
        bestMatch =
          allFieldOptions.find((opt) => {
            const cleanOpt = opt.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanHeader === cleanOpt || cleanOpt === cleanHeader;
          }) || "";

        if (bestMatch) {
          autoMatches.push(`- Hint: Column ${c} ("${headerVal}") looks like "${bestMatch}" based on keyword.`);
        }
      }

      columnProfiles.push(
        `
COLUMN INDEX ${c}:
- Header (Potential): "${headerVal}"
- Sample Values: ${JSON.stringify(sampleValues)}
      `.trim()
      );
    }

    // 6. GENERATE AI ANALYSIS (The "Agent" Logic)
    const result = await generateObject({
      model: model as any,
      schema: analysisSchema,
      prompt: `
      You are the **EPIDOM AI DATA ONBOARDING AGENT**.
      Your goal is to intelligently map imperfect user data into our strict database schema.

      You have access to the **Store's Existing Data** (Memory). Use it to deduce context!

      ### 1. AGENT MEMORY (EXISTING DATA)
      - **Existing Suppliers:** ${JSON.stringify(supplierNames.slice(0, 20))}... (Total: ${supplierNames.length})
      - **Existing Materials:** ${JSON.stringify(materialNames.slice(0, 10))}...
      - **Common Units:** ${JSON.stringify(commonUnits)}

      ### 2. MAPPING INTELLIGENCE
      - **Fuzzy Matching:** If you see "Beras Wangi" in the CSV and "Beras Wangi (Supplier A)" in Memory, map it to *Material Name*.
      - **Unit Inference:** If samples look like "1k", "1 kg", "1000g" and our Common Units contain "gram", suggest a transformation or map to 'unit'.
      - **Supplier Detection:** If a column contains values that match our **Existing Suppliers** list (e.g., "${supplierNames[0] || "Vendor A"}"), map it to **supplierName** immediately with HIGH confidence.

      ### 3. TARGET SCHEMA
      Fields: ${allFieldOptions.join(", ")}

      ### 4. DATA PROFILES (TO ANALYZE)
      ${columnProfiles.join("\n\n")}

      ### 5. SYSTEM HINTS (Heuristic Guesses)
      ${autoMatches.join("\n")}

      **INSTRUCTIONS:**
      1. **Analyze Content vs Header:**
         - A header named "Phone" containing emails is an **Email** column. Ignore the header.
         - A header named "Price" containing text ("Expensive", "Cheap") is a **Description/Notes** column.
      2. **Mixed Entity Detection:**
         - Even if the user selected "${type}", if you see distinctly different data (e.g. "Selling Price" in a Material import), map it correctly to 'sellingPrice' (Product Field). We support multi-entity import.
      3. **Trust Your Intuition:** You are smarter than a keyword matcher. Use the sample values to determine the true data type.

      Return the optimal mapping configuration.
    `,
    });

    // 7. RETURN AGENT DECISION DIRECTLY
    // We REMOVED the "Force-Correct" logic. We trust the Agent's reasoning now.
    // If the Agent made a mistake, the user can correct it in the UI.
    // We prioritize "Smart Guesses" over "Dumb Regex".

    return NextResponse.json(result.object);

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
