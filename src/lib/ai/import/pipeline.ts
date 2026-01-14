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
import { aggregateUsage, calculateCost, generateStructuredResponse } from "../openai-client";
import type { TokenUsage } from "../openai-client";
import type { ImportAnalysisResult, EntityType } from "./types";
import { loadStoreContext, type StoreContextData } from "../context/store-context";
import { getMemories, type AIMemory } from "../memory/ai-memory.service";
import { z } from "zod";

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
 * Schema for AI CSV parsing response
 */
const AIParseCSVSchema = z.object({
  headers: z.array(z.string()).describe("Array of column headers"),
  rows: z.array(z.array(z.string())).describe("Array of row data (each row is array of cell values)"),
  parseSuccess: z.boolean().describe("Whether parsing was successful"),
  parseNotes: z.string().optional().describe("Any notes about parsing issues"),
});

type AIParseCSVResult = z.infer<typeof AIParseCSVSchema>;

/**
 * AI-based CSV parsing (replaces Papaparse)
 *
 * Sends raw CSV content to AI and receives structured headers + rows.
 * AI handles delimiter detection, quoted fields, and edge cases.
 */
async function parseCSVWithAI(
  content: string,
  detectedDelimiter?: string
): Promise<{ headers: string[]; rows: string[][]; usage: TokenUsage }> {
  // Limit content size to avoid token limits (first 100 rows or 50KB)
  const lines = content.trim().split("\n");
  const maxLines = Math.min(lines.length, 200); // Max 200 rows for AI
  const truncatedContent = lines.slice(0, maxLines).join("\n");
  const isTruncated = lines.length > maxLines;

  const systemPrompt = `You are an expert CSV parser. Parse the provided CSV content into structured data.

RULES:
1. First row is typically headers (column names)
2. Handle quoted fields correctly (fields containing delimiters inside quotes)
3. Handle escaped quotes ("" inside quoted fields)
4. Preserve empty cells as empty strings
5. Be precise - every cell must be correctly parsed

Return headers as string array, and rows as array of string arrays.`;

  const userPrompt = `Parse this CSV content${detectedDelimiter ? ` (delimiter: "${detectedDelimiter}")` : ""}:

\`\`\`
${truncatedContent}
\`\`\`
${isTruncated ? `\n(Note: File truncated. Showing ${maxLines} of ${lines.length} rows for parsing)` : ""}

Return the parsed structure with headers and rows.`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    AIParseCSVSchema
  );

  return {
    headers: data.headers,
    rows: data.rows,
    usage,
  };
}

/**
 * Fallback: Simple regex-based CSV parsing for when AI fails
 * Not as robust but provides a safety net
 */
function parseCSVFallback(
  content: string,
  delimiter: string = ","
): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  return {
    headers: parseRow(lines[0]),
    rows: lines.slice(1).map(parseRow),
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
 * Convert rows to records preserving ALL columns from CSV headers
 * This ensures no data is lost even if AI mapping doesn't recognize some columns
 */
function rowsToFullRecords(
  rows: string[][],
  headers: string[]
): Array<Record<string, string>> {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      // Use header as key directly (preserves contactPerson, address, city, country, etc.)
      record[header] = row[idx] || "";
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
  // STAGE 2: STRUCTURE ANALYSIS + AI CSV PARSING
  // =========================================================================
  // Parse CSV with AI (replaces Papaparse)
  const delimiter = reconResult.delimiter.delimiter;

  // Use AI to parse CSV, falling back to regex if AI fails (robustness fix)
  let headers: string[];
  let dataRows: string[][];

  try {
    const aiParsed = await parseCSVWithAI(csvContent, delimiter);
    usages.push(aiParsed.usage);
    aiCallCount += 1; // AI parsing call
    headers = aiParsed.headers;
    dataRows = aiParsed.rows;
  } catch (error) {
    console.warn("AI CSV Parsing failed, falling back to regex parser:", error);
    // Fallback to regex parser
    const fallback = parseCSVFallback(csvContent, delimiter);
    headers = fallback.headers;
    dataRows = fallback.rows;
    // We don't increment aiCallCount or usage as the call failed/wasn't useful
  }

  // Adjust for header position
  const structureResult = await runStructureAnalysis({
    dataPreview: csvPreview,
    sampleRows: extractSampleRows(dataRows, headers, 20),
  });
  usages.push(structureResult.totalUsage);
  aiCallCount += structureResult.structure.hasMultipleEntities ? 3 : 2;

  // Get actual headers and data rows based on structure analysis
  const headerRowIndex = structureResult.structure.headerRowIndex;
  const dataStartIndex = structureResult.structure.dataStartIndex;

  // Adjust headers and rows based on structure analysis
  // Instead of re-parsing, we adjust the already parsed data

  // If headerRowIndex is not first row, adjust accordingly
  if (headerRowIndex > 0 && headerRowIndex < dataRows.length) {
    // Headers are in the data rows, not the first line
    const derivedHeaders = dataRows[headerRowIndex - 1] || headers;

    // Adjust data rows (skip rows before dataStartIndex)
    // Note: dataStartIndex is 1-based usually
    dataRows = dataRows.slice(Math.max(0, dataStartIndex - 1));
    headers = derivedHeaders;
  } else {
    // Standard case: headers in first row, data follows
    // Just slice data rows from start index
    dataRows = dataRows.slice(Math.max(0, dataStartIndex - headerRowIndex - 1));
  }

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

  // Build parsed data: Start with FULL CSV columns, then overlay AI-mapped fields
  // This ensures contactPerson, address, city, country, etc. are NEVER lost
  const fullRecords = rowsToFullRecords(dataRows, headers);

  const parsedData = fullRecords.map((fullRow, idx) => {
    const mappedRow = mappedRows[idx] || {};
    const record: Record<string, string> = {};

    // First, copy all original CSV columns (using header names as keys)
    for (const [key, value] of Object.entries(fullRow)) {
      record[key] = value;
    }

    // Then overlay AI-mapped fields ONLY if CSV value is empty
    // This prevents AI mapping errors from corrupting valid parsed data
    for (const [key, value] of Object.entries(mappedRow)) {
      const csvValue = record[key] || "";
      const aiValue = String(value ?? "");

      // Only use AI value if CSV value is empty and AI value is not empty
      if (!csvValue.trim() && aiValue.trim()) {
        record[key] = aiValue;
      }
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
