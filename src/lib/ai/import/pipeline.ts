/**
 * AI Import Pipeline Orchestrator
 *
 * Coordinates all 5 stages of the AI analysis pipeline
 * and produces a complete ImportAnalysisResult.
 */

import { runReconnaissance } from "./stages/reconnaissance";
import { runStructureAnalysis } from "./stages/structure";
import { runSemanticMapping } from "./stages/mapping";
import { runDataHealing } from "./stages/healing";
import { runValidation } from "./stages/validation";
import { aggregateUsage, calculateCost } from "../openai-client";
import type { TokenUsage } from "../openai-client";
import type { ImportAnalysisResult, EntityType } from "./types";
import { loadStoreContext, type StoreContextData } from "../context/store-context";
import { getMemories, type AIMemory } from "../memory/ai-memory.service";
import Papa from "papaparse";

/**
 * Pipeline input parameters
 */
export interface PipelineInput {
  storeId: string;
  csvContent: string;
  entityType?: EntityType; // If known, skip entity detection
  fileName?: string;
}

/**
 * Pipeline output
 */
export interface PipelineOutput {
  analysis: ImportAnalysisResult;
  parsedData: Array<Record<string, string>>;
  headers: string[];
  aiCallCount: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Parse CSV content into rows
 */
function parseCSV(
  content: string,
  delimiter: string = ","
): { headers: string[]; rows: string[][] } {
  const result = Papa.parse(content.trim(), {
    delimiter: delimiter === "auto" ? undefined : delimiter,
    skipEmptyLines: true,
  });

  const data = result.data as string[][];
  if (data.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: data[0] || [],
    rows: data.slice(1),
  };
}

/**
 * Create preview string from first N lines
 */
function createPreview(content: string, lines: number = 30): string {
  return content.split("\n").slice(0, lines).join("\n");
}

/**
 * Extract sample rows as string array for AI
 */
function extractSampleRows(rows: string[][], headers: string[], limit: number = 10): string[] {
  return rows.slice(0, limit).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return JSON.stringify(obj);
  });
}

/**
 * Convert mapped rows to record objects
 */
function mapRowsToRecords(
  rows: string[][],
  headers: string[],
  mappings: Array<{ sourceColumn: { index: number }; targetField: string }>
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    mappings.forEach((mapping) => {
      const value = row[mapping.sourceColumn.index];
      record[mapping.targetField] = value;
    });
    return record;
  });
}

/**
 * Run the complete AI import analysis pipeline
 */
export async function runImportPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { storeId, csvContent, entityType: specifiedEntityType, fileName } = input;

  const usages: TokenUsage[] = [];
  let aiCallCount = 0;

  // Load store context and memories
  const storeContext = await loadStoreContext(storeId);
  let memories: AIMemory[] = [];

  // =========================================================================
  // STAGE 1: RECONNAISSANCE
  // =========================================================================
  const csvPreview = createPreview(csvContent, 30);
  const lineCount = csvContent.split("\n").length;

  const reconResult = await runReconnaissance({
    rawContent: csvContent,
    csvPreview,
    rowCount: lineCount,
  });
  usages.push(reconResult.totalUsage);
  aiCallCount += 3;

  // =========================================================================
  // STAGE 2: STRUCTURE ANALYSIS
  // =========================================================================
  // Parse CSV with detected delimiter
  const delimiter = reconResult.delimiter.delimiter;
  const parsed = parseCSV(csvContent, delimiter);

  // Adjust for header position
  const structureResult = await runStructureAnalysis({
    dataPreview: csvPreview,
    sampleRows: extractSampleRows(parsed.rows, parsed.headers, 20),
  });
  usages.push(structureResult.totalUsage);
  aiCallCount += structureResult.structure.hasMultipleEntities ? 3 : 2;

  // Get actual headers and data rows based on structure analysis
  const headerRowIndex = structureResult.structure.headerRowIndex;
  const dataStartIndex = structureResult.structure.dataStartIndex;

  // Re-parse with correct structure
  const allLines = csvContent.split("\n");
  const actualContent = allLines.slice(headerRowIndex).join("\n");
  const reparsed = parseCSV(actualContent, delimiter);

  const headers = reparsed.headers;
  const dataRows = reparsed.rows.slice(dataStartIndex - headerRowIndex - 1);

  // =========================================================================
  // STAGE 3: SEMANTIC MAPPING
  // =========================================================================
  // Determine entity type
  let entityType: EntityType = specifiedEntityType || "material";

  if (!specifiedEntityType && structureResult.entityBreakdown) {
    // Use the most common detected entity type
    const breakdown = structureResult.entityBreakdown;
    let maxCount = 0;
    for (const [type, info] of Object.entries(breakdown)) {
      if (info.count > maxCount) {
        maxCount = info.count;
        entityType = type as EntityType;
      }
    }
  }

  // Load memories for this entity type
  memories = await getMemories({
    storeId,
    entityType,
    minConfidence: 0.5,
    limit: 50,
  });

  const mappingResult = await runSemanticMapping({
    entityType,
    csvHeaders: headers,
    sampleRows: dataRows.slice(0, 10),
    language: structureResult.structure.language,
    storeContext,
    memories,
  });
  usages.push(mappingResult.totalUsage);
  aiCallCount += 3;

  // =========================================================================
  // STAGE 4: DATA HEALING
  // =========================================================================
  // Map rows to records using the mapping
  const mappedRows = mapRowsToRecords(dataRows, headers, mappingResult.mapping.mappings);

  // Identify categorical fields for typo checking
  const categoricalFields = mappingResult.mapping.mappings
    .filter((m) => m.targetField === "category" || m.targetField === "unit")
    .map((m) => ({
      field: m.targetField,
      expectedValues:
        m.targetField === "category"
          ? storeContext.patterns.commonCategories[
              entityType === "material"
                ? "materials"
                : entityType === "product"
                  ? "products"
                  : "recipes"
            ]
          : storeContext.patterns.commonUnits,
    }));

  const healingResult = await runDataHealing({
    entityType,
    rows: mappedRows,
    categoricalFields,
    storeContext,
  });
  usages.push(healingResult.totalUsage);
  aiCallCount += 3;

  // =========================================================================
  // STAGE 5: VALIDATION
  // =========================================================================
  // Build conflicts list from duplicate detection
  const conflicts = healingResult.duplicates.databaseConflicts.map((c) => ({
    importRow: mappedRows[c.importRow],
    existingEntity: { id: c.existingId, name: c.existingName },
    conflictFields: c.conflictFields,
  }));

  // Calculate confidence metrics
  const mappingConfidence =
    mappingResult.mapping.mappings.filter((m) => m.confidence === "HIGH").length /
    Math.max(mappingResult.mapping.mappings.length, 1);

  const validationResult = await runValidation({
    entityType,
    rows: mappedRows,
    conflicts,
    analysisMetrics: {
      structureConfidence: structureResult.structure.structureType === "STANDARD_CSV" ? 0.9 : 0.7,
      mappingConfidence,
      qualityScore: reconResult.quality.overallScore,
      issuesFound: reconResult.quality.issues.length,
      duplicatesFound:
        healingResult.duplicates.exactDuplicates.length +
        healingResult.duplicates.nearDuplicates.length,
    },
  });
  usages.push(validationResult.totalUsage);
  aiCallCount += conflicts.length > 0 ? 3 : 2;

  // =========================================================================
  // AGGREGATE RESULTS
  // =========================================================================
  const totalUsage = aggregateUsage(usages);
  const estimatedCost = calculateCost(totalUsage);

  const analysis: ImportAnalysisResult = {
    // Stage 1
    language: reconResult.language,
    delimiter: reconResult.delimiter,
    quality: reconResult.quality,

    // Stage 2
    structure: structureResult.structure,

    // Stage 3
    mapping: mappingResult.mapping,

    // Stage 4
    typoCorrections: healingResult.typoCorrections,
    missingValueInferences: healingResult.missingValueInferences,

    // Stage 5
    duplicates: healingResult.duplicates,

    // Final assessment
    overallConfidence: validationResult.finalAssessment.overallConfidence,
    readyToImport: validationResult.finalAssessment.readyToImport,
    humanReviewRequired: validationResult.finalAssessment.humanReviewRequired,
    summary: validationResult.finalAssessment.summary,
    recommendations: validationResult.finalAssessment.recommendations,

    // Metrics
    aiCallCount,
    totalTokens: totalUsage.totalTokens,
    estimatedCost,
  };

  // Build parsed data with mapped field names
  const parsedData = mappedRows.map((row) => {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      record[key] = String(value ?? "");
    }
    return record;
  });

  return {
    analysis,
    parsedData,
    headers,
    aiCallCount,
    totalTokens: totalUsage.totalTokens,
    estimatedCost,
  };
}
