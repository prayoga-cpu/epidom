/**
 * Stage 2: Structure Intelligence
 *
 * Analyzes the data structure and layout:
 * - Header detection (skip junk rows)
 * - Layout analysis (standard, transposed, hierarchical, etc.)
 * - Entity type detection (mixed entities in one file?)
 */

import { generateStructuredResponse } from "../../openai-client";
import type { TokenUsage } from "../../openai-client";
import { EPIDOM_CONTEXT, ENTITY_DETECTION_HINTS } from "../../context/epidom-context";
import {
  StructureAnalysisSchema,
  type StructureAnalysis,
  type EntityType,
} from "../types";
import { z } from "zod";

/**
 * AI Call 4: Detect header row and junk rows
 */
export async function detectHeaders(dataPreview: string): Promise<{
  analysis: StructureAnalysis;
  usage: TokenUsage;
}> {
  const systemPrompt = `${EPIDOM_CONTEXT}

${ENTITY_DETECTION_HINTS}

You are analyzing a CSV file to find the ACTUAL header row.
CSV files often have junk rows at the top (title, date, metadata) before the real headers.

Your task: Identify where the real data starts, and which entity type the file holds.`;

  const userPrompt = `Analyze this CSV data (first 30 lines):

${dataPreview}

Determine:
1. Structure type (STANDARD_CSV, TRANSPOSED, MIXED, HIERARCHICAL, PIVOTED)
2. Primary language
3. Does it contain multiple entity types? (suppliers, materials, products, recipes mixed together)
4. primaryEntityType: the SINGLE best-fit entity type for the whole file — "supplier", "material", "product", or "recipe". Read the column headers in their own language (e.g. French "Rendement"/"Ingrédient" => recipe, "Prix de vente" => product). Always pick the closest match even if unsure.
5. How many junk rows at the top?
6. Which line is the header row? (0-indexed)
7. Which line does actual data start? (0-indexed)
8. How many junk rows at the bottom? (summary/total rows)
9. If hierarchical, identify sections

Provide clear reasoning for your decisions.`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    StructureAnalysisSchema
  );

  return { analysis: data, usage };
}

/**
 * AI Call 5: Analyze data layout pattern
 */
export async function analyzeLayout(
  dataPreview: string,
  structureType: string
): Promise<{
  layoutDetails: Record<string, unknown>;
  usage: TokenUsage;
}> {
  const systemPrompt = `${EPIDOM_CONTEXT}

You are analyzing the DATA LAYOUT pattern.
Different layouts require different extraction strategies.`;

  const userPrompt = `This CSV has structure type: ${structureType}

Data sample:
${dataPreview}

Analyze the layout in detail:
- For STANDARD: Confirm each row = one record
- For TRANSPOSED: Identify which column contains field names, which contain entity data
- For MULTI_ROW: Identify grouping column (e.g., recipe name that repeats)
- For HIERARCHICAL: Identify section boundaries
- For MIXED: Identify which rows belong to which entity type

Return detailed layout information as JSON.`;

  const LayoutDetailsSchema = z.object({
    layoutType: z.string(),
    details: z.record(z.unknown()),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    reasoning: z.string(),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    LayoutDetailsSchema
  );

  return { layoutDetails: data.details, usage };
}

/**
 * AI Call 6: Detect entity types in mixed data
 */
export async function detectEntityTypes(dataRows: string[]): Promise<{
  entityBreakdown: Record<
    string,
    {
      count: number;
      rowIndices: number[];
      confidence: string;
    }
  >;
  usage: TokenUsage;
}> {
  const systemPrompt = `${EPIDOM_CONTEXT}

${ENTITY_DETECTION_HINTS}

You are analyzing rows to determine which entity type each represents.
This is critical for correct import routing.`;

  const userPrompt = `Analyze these data rows and classify each:

${dataRows.map((row, idx) => `Row ${idx}: ${row}`).join("\n")}

For each row, determine if it's:
- SUPPLIER (has contact/location fields)
- MATERIAL (has unitCost, no sellingPrice)
- PRODUCT (has costPrice AND sellingPrice)
- RECIPE (has yield/ingredient fields)

Return entity breakdown with row indices for each type.`;

  // Schema that accepts either array of numbers OR full object
  const EntityBreakdownSchema = z.object({
    isMixedEntity: z.boolean().default(false),
    entityBreakdown: z.record(
      z.union([
        z.array(z.number()), // AI might return just [0, 1, 2]
        z.object({
          count: z.number().optional(),
          rowIndices: z.array(z.number()).optional(),
          confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        }),
      ])
    ).default({}),
    reasoning: z.string().default(""),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    EntityBreakdownSchema
  );

  // Normalize the response to a consistent format
  const normalizedBreakdown: Record<
    string,
    { count: number; rowIndices: number[]; confidence: string }
  > = {};

  for (const [entityType, value] of Object.entries(data.entityBreakdown)) {
    if (Array.isArray(value)) {
      // AI returned just an array of row indices
      normalizedBreakdown[entityType] = {
        count: value.length,
        rowIndices: value,
        confidence: "MEDIUM",
      };
    } else if (value && typeof value === "object") {
      // AI returned full object
      normalizedBreakdown[entityType] = {
        count: value.count ?? value.rowIndices?.length ?? 0,
        rowIndices: value.rowIndices ?? [],
        confidence: value.confidence ?? "MEDIUM",
      };
    }
  }

  return { entityBreakdown: normalizedBreakdown, usage };
}

/**
 * Run all structure analyses
 */
export async function runStructureAnalysis(params: {
  dataPreview: string;
  sampleRows: string[];
  // When the entity type is already known (specified or confidently guessed),
  // skip the expensive multi-row entity-breakdown LLM call entirely.
  skipEntityDetection?: boolean;
}): Promise<{
  structure: StructureAnalysis;
  layoutDetails: Record<string, unknown>;
  entityBreakdown: Record<string, { count: number; rowIndices: number[]; confidence: string }>;
  totalUsage: TokenUsage;
}> {
  const { dataPreview, sampleRows, skipEntityDetection } = params;

  // Step 1: Detect headers and structure type
  const headerResult = await detectHeaders(dataPreview);

  // Step 2: Analyze layout based on detected structure
  const layoutResult = await analyzeLayout(dataPreview, headerResult.analysis.structureType);

  // Step 3: Detect entity types (if mixed)
  let entityResult = {
    entityBreakdown: {},
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };

  if (!skipEntityDetection && headerResult.analysis.hasMultipleEntities && sampleRows.length > 0) {
    entityResult = await detectEntityTypes(sampleRows.slice(0, 8)); // Analyze first 8 rows (kept small for latency)
  }

  // Aggregate usage
  const totalUsage = {
    promptTokens:
      headerResult.usage.promptTokens +
      layoutResult.usage.promptTokens +
      entityResult.usage.promptTokens,
    completionTokens:
      headerResult.usage.completionTokens +
      layoutResult.usage.completionTokens +
      entityResult.usage.completionTokens,
    totalTokens:
      headerResult.usage.totalTokens +
      layoutResult.usage.totalTokens +
      entityResult.usage.totalTokens,
  };

  return {
    structure: headerResult.analysis,
    layoutDetails: layoutResult.layoutDetails,
    entityBreakdown: entityResult.entityBreakdown,
    totalUsage,
  };
}
