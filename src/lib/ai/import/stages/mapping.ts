/**
 * Stage 3: Semantic Mapping
 *
 * Maps CSV columns to database fields:
 * - Field meaning understanding (any language)
 * - Data type inference from samples
 * - Relationship detection
 */

import { generateStructuredResponse } from "../../openai-client";
import type { TokenUsage } from "../../openai-client";
import {
  EPIDOM_CONTEXT,
  getEntityFieldDefinitions,
} from "../../context/epidom-context";
import {
  MappingAnalysisSchema,
  type MappingAnalysis,
  type EntityType,
  TransformType,
} from "../types";
import { z } from "zod";
import type { StoreContextData } from "../../context/store-context";
import { formatMemoriesForAI } from "../../memory/ai-memory.service";
import type { AIMemory } from "../../memory/ai-memory.service";

/**
 * AI Call 7: Deep field understanding and mapping
 */
export async function mapFields(params: {
  entityType: EntityType;
  csvHeaders: string[];
  sampleRows: string[][];
  language: string;
  storeContext?: StoreContextData;
  memories?: AIMemory[];
}): Promise<{
  analysis: MappingAnalysis;
  usage: TokenUsage;
}> {
  const { entityType, csvHeaders, sampleRows, language, storeContext, memories } = params;

  // Build context
  let contextPrompt = EPIDOM_CONTEXT;
  contextPrompt += "\n\n" + getEntityFieldDefinitions(entityType);

  if (storeContext) {
    contextPrompt += "\n\n## EXISTING DATA IN THIS STORE\n";
    contextPrompt += `Total ${entityType}s: ${
      entityType === "material"
        ? storeContext.stats.totalMaterials
        : entityType === "product"
          ? storeContext.stats.totalProducts
          : entityType === "supplier"
            ? storeContext.stats.totalSuppliers
            : storeContext.stats.totalRecipes
    }\n`;

    if (entityType === "material" && storeContext.patterns.commonCategories.materials.length > 0) {
      contextPrompt += `Common categories: ${storeContext.patterns.commonCategories.materials.join(", ")}\n`;
    }
    if (entityType === "product" && storeContext.patterns.commonCategories.products.length > 0) {
      contextPrompt += `Common categories: ${storeContext.patterns.commonCategories.products.join(", ")}\n`;
    }
  }

  if (memories && memories.length > 0) {
    contextPrompt += "\n\n" + formatMemoriesForAI(memories);
  }

  const systemPrompt = `${contextPrompt}

You are an expert at understanding data semantics in ANY language.
Your task: Map CSV columns to database fields for ${entityType} entity.

Be intelligent:
- Understand MEANING, not just literal translation
- Consider context and sample values
- Detect required transformations
- Identify relationships (e.g., supplier names for auto-linking)`;

  // Format sample data
  const sampleData = sampleRows
    .slice(0, 5)
    .map((row, idx) => {
      const formatted = csvHeaders.map((h, i) => `${h}: "${row[i] || ""}"`).join(", ");
      return `Row ${idx + 1}: {${formatted}}`;
    })
    .join("\n");

  const userPrompt = `CSV Language: ${language}
Entity Type: ${entityType}

CSV Headers (${csvHeaders.length} columns):
${csvHeaders.map((h, i) => `${i}: "${h}"`).join("\n")}

Sample Data:
${sampleData}

Map each CSV column to the appropriate database field.
For each mapping, provide:
- Semantic meaning (what does this column represent?)
- Target database field
- Confidence level (HIGH/MEDIUM/LOW)
- Reasoning
- Required transformation (if any)
- Inferred data type

Also identify:
- Unmapped columns (no matching field)
- Ambiguous columns (could map to multiple fields)
- Detected relationships (e.g., supplier names)`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    MappingAnalysisSchema
  );

  return { analysis: data, usage };
}

/**
 * AI Call 8: Intelligent type inference from samples
 */
export async function inferDataTypes(params: {
  columnHeader: string;
  sampleValues: string[];
  targetField?: string;
}): Promise<{
  dataType: string;
  transformations: Array<{ step: number; action: string; details?: string }>;
  usage: TokenUsage;
}> {
  const { columnHeader, sampleValues, targetField } = params;

  const systemPrompt = `You are a data type inference expert.
Analyze sample values and determine the ACTUAL data type and required transformations.

Consider:
- Numbers with formatting (currency, thousands separators)
- Booleans expressed as text (Yes/No, True/False, 1/0, Active/Inactive)
- Dates in non-standard formats
- IDs/codes that should stay as strings
- Encoding issues`;

  const userPrompt = `Column: "${columnHeader}"
${targetField ? `Target Field: ${targetField}` : ""}

Sample Values:
${sampleValues.map((v, i) => `${i + 1}. "${v}"`).join("\n")}

Determine:
1. Inferred data type (string, number, boolean, date)
2. Original format pattern
3. Step-by-step transformations needed
4. Example transformation (input → output)
5. Edge cases to handle`;

  const TypeInferenceSchema = z.object({
    inferredType: z.enum(["string", "number", "boolean", "date"]),
    originalFormat: z.string(),
    transformations: z.array(
      z.object({
        step: z.number(),
        action: z.string(),
        details: z.string().optional(),
      })
    ),
    exampleTransformation: z.object({
      input: z.string(),
      output: z.union([z.string(), z.number(), z.boolean()]),
    }),
    edgeCases: z.array(z.string()).optional(),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    TypeInferenceSchema
  );

  return {
    dataType: data.inferredType,
    transformations: data.transformations,
    usage,
  };
}

/**
 * AI Call 9: Relationship detection
 */
export async function detectRelationships(params: {
  entityType: EntityType;
  mappedFields: Array<{ sourceColumn: string; targetField: string }>;
  sampleRows: string[][];
  storeContext?: StoreContextData;
}): Promise<{
  relationships: Array<{
    type: string;
    sourceColumn: string;
    targetEntity: EntityType;
    linkMethod: string;
    examples: Array<Record<string, string>>;
  }>;
  usage: TokenUsage;
}> {
  const { entityType, mappedFields, sampleRows, storeContext } = params;

  let contextPrompt = EPIDOM_CONTEXT;

  if (storeContext) {
    contextPrompt += "\n\n## EXISTING ENTITIES FOR MATCHING\n";

    if (entityType === "material" && storeContext.existingSuppliers.length > 0) {
      contextPrompt += "\nExisting Suppliers:\n";
      storeContext.existingSuppliers.slice(0, 10).forEach((s) => {
        contextPrompt += `- "${s.name}"\n`;
      });
    }

    if (
      (entityType === "recipe" || entityType === "product") &&
      storeContext.existingMaterials.length > 0
    ) {
      contextPrompt += "\nExisting Materials:\n";
      storeContext.existingMaterials.slice(0, 10).forEach((m) => {
        contextPrompt += `- "${m.name}" (${m.sku})\n`;
      });
    }
  }

  const systemPrompt = `${contextPrompt}

You are analyzing data to detect RELATIONSHIPS between entities.
This is critical for auto-linking and auto-creation during import.`;

  const sampleData = sampleRows
    .slice(0, 5)
    .map((row, idx) => {
      const obj: Record<string, string> = {};
      mappedFields.forEach((field, i) => {
        obj[field.targetField] = row[i] || "";
      });
      return `Row ${idx + 1}: ${JSON.stringify(obj)}`;
    })
    .join("\n");

  const userPrompt = `Entity Type: ${entityType}
Mapped Fields: ${mappedFields.map((f) => f.targetField).join(", ")}

Sample Data:
${sampleData}

Detect relationships:
1. Supplier-Material links (which supplier provides which material)
2. Recipe-Material links (which materials are ingredients)
3. Recipe-Product links (which products are made from recipes)
4. Any parent-child relationships

For each relationship, provide examples from the data.`;

  const RelationshipSchema = z.object({
    detectedRelationships: z.array(
      z.object({
        type: z.string(),
        sourceColumn: z.string(),
        targetEntity: z.enum(["material", "product", "supplier", "recipe"]),
        linkMethod: z.string().default(""),
        examples: z.array(z.record(z.string())).optional().default([]),
      })
    ).default([]),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    RelationshipSchema
  );

  return {
    relationships: data.detectedRelationships,
    usage,
  };
}

/**
 * Run all semantic mapping analyses
 */
export async function runSemanticMapping(params: {
  entityType: EntityType;
  csvHeaders: string[];
  sampleRows: string[][];
  language: string;
  storeContext?: StoreContextData;
  memories?: AIMemory[];
}): Promise<{
  mapping: MappingAnalysis;
  typeInferences: Record<string, { dataType: string; transformations: unknown[] }>;
  relationships: Array<{
    type: string;
    sourceColumn: string;
    targetEntity: EntityType;
    linkMethod: string;
  }>;
  totalUsage: TokenUsage;
}> {
  const { entityType, csvHeaders, sampleRows, language, storeContext, memories } = params;

  // Step 1: Map fields
  const mappingResult = await mapFields({
    entityType,
    csvHeaders,
    sampleRows,
    language,
    storeContext,
    memories,
  });

  // Step 2: Infer types for ambiguous columns (run in parallel)
  const ambiguousColumns = mappingResult.analysis.ambiguousColumns.slice(0, 3); // Limit to 3
  const typeInferencePromises = ambiguousColumns.map((col) => {
    const sampleValues = sampleRows.map((row) => row[col.index] || "").filter((v) => v);
    return inferDataTypes({
      columnHeader: col.header,
      sampleValues: sampleValues.slice(0, 10),
      targetField: col.bestGuess,
    });
  });

  const typeInferenceResults = await Promise.all(typeInferencePromises);

  // Build type inferences map
  const typeInferences: Record<string, { dataType: string; transformations: unknown[] }> = {};
  ambiguousColumns.forEach((col, idx) => {
    if (typeInferenceResults[idx]) {
      typeInferences[col.header] = {
        dataType: typeInferenceResults[idx].dataType,
        transformations: typeInferenceResults[idx].transformations,
      };
    }
  });

  // Step 3: Detect relationships
  const mappedFields = mappingResult.analysis.mappings.map((m) => ({
    sourceColumn: m.sourceColumn.header,
    targetField: m.targetField,
  }));

  const relationshipResult = await detectRelationships({
    entityType,
    mappedFields,
    sampleRows,
    storeContext,
  });

  // Aggregate usage
  const totalUsage = {
    promptTokens:
      mappingResult.usage.promptTokens +
      typeInferenceResults.reduce((sum, r) => sum + r.usage.promptTokens, 0) +
      relationshipResult.usage.promptTokens,
    completionTokens:
      mappingResult.usage.completionTokens +
      typeInferenceResults.reduce((sum, r) => sum + r.usage.completionTokens, 0) +
      relationshipResult.usage.completionTokens,
    totalTokens:
      mappingResult.usage.totalTokens +
      typeInferenceResults.reduce((sum, r) => sum + r.usage.totalTokens, 0) +
      relationshipResult.usage.totalTokens,
  };

  return {
    mapping: mappingResult.analysis,
    typeInferences,
    relationships: relationshipResult.relationships,
    totalUsage,
  };
}
