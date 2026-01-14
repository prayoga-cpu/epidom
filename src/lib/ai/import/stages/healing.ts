/**
 * Stage 4: Data Healing
 *
 * Fixes and normalizes data:
 * - Typo correction
 * - Missing value inference
 * - Duplicate detection
 */

import { generateStructuredResponse } from "../../openai-client";
import type { TokenUsage } from "../../openai-client";
import { EPIDOM_CONTEXT } from "../../context/epidom-context";
import {
  TypoCorrectionSchema,
  MissingValueInferenceSchema,
  DuplicateDetectionSchema,
  type TypoCorrection,
  type MissingValueInference,
  type DuplicateDetection,
  type EntityType,
} from "../types";
import { z } from "zod";
import type { StoreContextData } from "../../context/store-context";

/**
 * AI Call 10: Typo correction and normalization
 */
export async function correctTypos(params: {
  columnHeader: string;
  fieldType: string;
  values: string[];
  expectedValues?: string[];
}): Promise<{
  corrections: TypoCorrection[];
  usage: TokenUsage;
}> {
  const { columnHeader, fieldType, values, expectedValues } = params;

  const systemPrompt = `You are a data quality expert specializing in typo correction.
Fix typos and normalize inconsistent data while preserving meaning.`;

  const userPrompt = `Column: "${columnHeader}"
Field Type: ${fieldType}
${expectedValues ? `Expected Values: ${expectedValues.join(", ")}` : ""}

Values to check:
${values.map((v, i) => `${i + 1}. "${v}"`).join("\n")}

For each value, determine:
- Is it correct as-is?
- Is it a typo? What's the correction?
- Is it a different spelling of the same thing?
- Is it completely invalid?

Return corrections with confidence scores.`;

  const CorrectionsSchema = z.object({
    corrections: z.array(TypoCorrectionSchema),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    CorrectionsSchema
  );

  return { corrections: data.corrections, usage };
}

/**
 * AI Call 11: Missing value inference
 */
export async function inferMissingValues(params: {
  rowData: Record<string, unknown>;
  missingFields: string[];
  similarRows: Array<Record<string, unknown>>;
  entityType: EntityType;
}): Promise<{
  inferences: MissingValueInference[];
  usage: TokenUsage;
}> {
  const { rowData, missingFields, similarRows, entityType } = params;

  const systemPrompt = `${EPIDOM_CONTEXT}

You are analyzing a row with MISSING VALUES.
Try to infer them intelligently based on context and similar rows.

Be conservative - only infer if you're confident.`;

  const userPrompt = `Entity Type: ${entityType}

Row with missing values:
${JSON.stringify(rowData, null, 2)}

Missing fields: ${missingFields.join(", ")}

Similar rows for context:
${similarRows.map((r, i) => `${i + 1}. ${JSON.stringify(r)}`).join("\n")}

For each missing field, provide:
- Inferred value (if possible)
- Inference method/reasoning
- Confidence level
- Should we ask the user? (if low confidence)
- Suggested default (if no inference possible)`;

  const InferencesSchema = z.object({
    inferences: z.array(MissingValueInferenceSchema),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    InferencesSchema
  );

  return { inferences: data.inferences, usage };
}

/**
 * AI Call 12: Duplicate detection
 */
export async function detectDuplicates(params: {
  rows: Array<Record<string, unknown>>;
  entityType: EntityType;
  existingEntities?: Array<{ id: string; sku?: string; name: string }>;
}): Promise<{
  duplicates: DuplicateDetection;
  usage: TokenUsage;
}> {
  const { rows, entityType, existingEntities } = params;

  const systemPrompt = `${EPIDOM_CONTEXT}

You are detecting DUPLICATES and near-duplicates in import data.
This is critical to prevent creating duplicate records.`;

  const userPrompt = `Entity Type: ${entityType}

Import Rows (${rows.length} total):
${rows.map((r, i) => `${i}: ${JSON.stringify(r)}`).join("\n")}

${
  existingEntities && existingEntities.length > 0
    ? `
Existing Entities in Database:
${existingEntities.map((e) => `- ${e.sku ? `${e.sku}: ` : ""}${e.name}`).join("\n")}
`
    : ""
}

Detect:
1. Exact duplicates (same SKU or identifier)
2. Near duplicates (same name, different SKU - possible error)
3. Semantic duplicates (same thing, different spelling)
4. Database conflicts (already exists in database)

For each duplicate, suggest an action:
- KEEP_FIRST / KEEP_LAST
- MERGE
- UPDATE (for database conflicts)
- SKIP
- ASK_USER`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    DuplicateDetectionSchema
  );

  return { duplicates: data, usage };
}

/**
 * Run all data healing analyses
 */
export async function runDataHealing(params: {
  entityType: EntityType;
  rows: Array<Record<string, unknown>>;
  categoricalFields?: Array<{ field: string; expectedValues: string[] }>;
  storeContext?: StoreContextData;
}): Promise<{
  typoCorrections: TypoCorrection[];
  missingValueInferences: MissingValueInference[];
  duplicates: DuplicateDetection;
  totalUsage: TokenUsage;
}> {
  const { entityType, rows, categoricalFields, storeContext } = params;

  // Step 1: Typo correction for categorical fields (parallel)
  const typoPromises =
    categoricalFields?.slice(0, 3).map((field) => {
      const values = rows
        .map((r) => String(r[field.field] || ""))
        .filter((v) => v)
        .slice(0, 20);
      return correctTypos({
        columnHeader: field.field,
        fieldType: "categorical",
        values: Array.from(new Set(values)), // Unique values only
        expectedValues: field.expectedValues,
      });
    }) || [];

  const typoResults = await Promise.all(typoPromises);
  const allCorrections = typoResults.flatMap((r) => r.corrections);

  // Step 2: Missing value inference (for first 3 rows with missing data)
  const rowsWithMissing = rows
    .map((row, idx) => ({
      row,
      idx,
      missing: Object.keys(row).filter((k) => !row[k]),
    }))
    .filter((r) => r.missing.length > 0)
    .slice(0, 3);

  const inferencePromises = rowsWithMissing.map((r) =>
    inferMissingValues({
      rowData: r.row,
      missingFields: r.missing,
      similarRows: rows.filter((_, i) => i !== r.idx).slice(0, 3),
      entityType,
    })
  );

  const inferenceResults = await Promise.all(inferencePromises);
  const allInferences = inferenceResults.flatMap((r) => r.inferences);

  // Step 3: Duplicate detection
  const existingEntities =
    entityType === "material"
      ? storeContext?.existingMaterials
      : entityType === "product"
        ? storeContext?.existingProducts
        : entityType === "supplier"
          ? storeContext?.existingSuppliers
          : storeContext?.existingRecipes;

  const duplicateResult = await detectDuplicates({
    rows,
    entityType,
    existingEntities,
  });

  // Aggregate usage
  const totalUsage = {
    promptTokens:
      typoResults.reduce((sum, r) => sum + r.usage.promptTokens, 0) +
      inferenceResults.reduce((sum, r) => sum + r.usage.promptTokens, 0) +
      duplicateResult.usage.promptTokens,
    completionTokens:
      typoResults.reduce((sum, r) => sum + r.usage.completionTokens, 0) +
      inferenceResults.reduce((sum, r) => sum + r.usage.completionTokens, 0) +
      duplicateResult.usage.completionTokens,
    totalTokens:
      typoResults.reduce((sum, r) => sum + r.usage.totalTokens, 0) +
      inferenceResults.reduce((sum, r) => sum + r.usage.totalTokens, 0) +
      duplicateResult.usage.totalTokens,
  };

  return {
    typoCorrections: allCorrections,
    missingValueInferences: allInferences,
    duplicates: duplicateResult.duplicates,
    totalUsage,
  };
}
