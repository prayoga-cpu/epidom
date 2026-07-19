/**
 * Stage 5: Validation & Final Decision
 *
 * Final checks before import:
 * - Cross-row consistency
 * - Conflict resolution strategy
 * - Overall confidence scoring
 */

import { generateStructuredResponse } from "../../openai-client";
import type { TokenUsage } from "../../openai-client";
import { EPIDOM_CONTEXT } from "../../context/epidom-context";
import type { EntityType } from "../types";
import { z } from "zod";

/**
 * AI Call 13: Cross-row consistency check
 */
export async function checkConsistency(params: {
  rows: Array<Record<string, unknown>>;
  entityType: EntityType;
}): Promise<{
  issues: Array<{
    type: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    description: string;
    affectedRows: number[];
    suggestion: string;
  }>;
  autoFixable: number;
  needsUserInput: number;
  usage: TokenUsage;
}> {
  const { rows, entityType } = params;

  const systemPrompt = `${EPIDOM_CONTEXT}

You are validating data CONSISTENCY across all rows.
Check for logical errors, outliers, and constraint violations.`;

  const userPrompt = `Entity Type: ${entityType}

Data Rows (${rows.length} total):
${rows
  .slice(0, 20)
  .map((r, i) => `${i}: ${JSON.stringify(r)}`)
  .join("\n")}
${rows.length > 20 ? `... and ${rows.length - 20} more rows` : ""}

Validate:
1. SKUs are unique (if applicable)
2. Categories are consistent (not mixing case, spelling)
3. Units are consistent (not "kg" and "Kg" and "kilogram")
4. Prices are reasonable (no outliers like 0 or 9999999)
5. Stock values make sense (min < max, current >= 0)
6. Supplier names are consistent
7. Business logic (e.g., sellingPrice >= costPrice for products)

For each issue:
- Type and severity
- Affected rows
- Suggested fix
- Can it be auto-fixed?`;

  const ConsistencySchema = z.object({
    consistencyIssues: z.array(
      z.object({
        type: z.string(),
        severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
        description: z.string(),
        affectedRows: z.array(z.number()),
        suggestion: z.string(),
        autoFixable: z.boolean(),
      })
    ),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    ConsistencySchema
  );

  const autoFixable = data.consistencyIssues.filter((i) => i.autoFixable).length;
  const needsUserInput = data.consistencyIssues.filter((i) => !i.autoFixable).length;

  return {
    issues: data.consistencyIssues,
    autoFixable,
    needsUserInput,
    usage,
  };
}

/**
 * AI Call 14: Conflict resolution strategy
 */
export async function resolveConflicts(params: {
  conflicts: Array<{
    importRow: Record<string, unknown>;
    existingEntity: { id: string; name: string; [key: string]: unknown };
    conflictFields: string[];
  }>;
  entityType: EntityType;
}): Promise<{
  resolutions: Array<{
    rowIndex: number;
    recommendation: "UPDATE" | "SKIP" | "CREATE_NEW" | "ASK_USER";
    reasoning: string;
    confidence: number;
  }>;
  usage: TokenUsage;
}> {
  const { conflicts, entityType } = params;

  const systemPrompt = `${EPIDOM_CONTEXT}

You are determining the BEST STRATEGY for handling conflicts with existing data.
Consider data freshness, completeness, and user intent.`;

  const userPrompt = `Entity Type: ${entityType}

Conflicts (${conflicts.length} total):
${conflicts
  .map(
    (c, i) => `
Conflict ${i}:
Import: ${JSON.stringify(c.importRow)}
Existing: ${JSON.stringify(c.existingEntity)}
Conflicting Fields: ${c.conflictFields.join(", ")}
`
  )
  .join("\n")}

For each conflict, recommend:
- UPDATE: Update existing with new values (import data appears more recent)
- SKIP: Don't import, keep existing (existing data is better)
- CREATE_NEW: Create with different identifier (might be different item)
- ASK_USER: Need human decision (ambiguous)

Provide reasoning and confidence (0.0-1.0).`;

  const ResolutionSchema = z.object({
    resolutions: z.array(
      z.object({
        rowIndex: z.number(),
        recommendation: z.enum(["UPDATE", "SKIP", "CREATE_NEW", "ASK_USER"]),
        reasoning: z.string(),
        confidence: z.number().min(0).max(1),
      })
    ),
    batchRecommendation: z.object({
      summary: z.string(),
      allUpdates: z.boolean(),
      allSkips: z.boolean(),
      mixedStrategy: z.boolean(),
    }),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    ResolutionSchema
  );

  return {
    resolutions: data.resolutions,
    usage,
  };
}

/**
 * AI Call 15: Final confidence and import readiness
 */
export async function assessImportReadiness(params: {
  totalRows: number;
  structureConfidence: number;
  mappingConfidence: number;
  qualityScore: number;
  issuesFound: number;
  duplicatesFound: number;
  conflictsFound: number;
}): Promise<{
  overallConfidence: number;
  readyToImport: boolean;
  humanReviewRequired: boolean;
  summary: {
    totalRows: number;
    readyRows: number;
    warningRows: number;
    errorRows: number;
  };
  recommendations: string[];
  usage: TokenUsage;
}> {
  const {
    totalRows,
    structureConfidence,
    mappingConfidence,
    qualityScore,
    issuesFound,
    duplicatesFound,
    conflictsFound,
  } = params;

  const systemPrompt = `You are making a FINAL ASSESSMENT of import readiness.
Consider all analysis results and provide a go/no-go decision.`;

  const userPrompt = `Import Analysis Summary:
- Total Rows: ${totalRows}
- Structure Confidence: ${structureConfidence.toFixed(2)}
- Mapping Confidence: ${mappingConfidence.toFixed(2)}
- Quality Score: ${qualityScore.toFixed(2)}
- Issues Found: ${issuesFound}
- Duplicates Found: ${duplicatesFound}
- Conflicts Found: ${conflictsFound}

Provide final assessment:
1. Overall confidence (0.0-1.0)
2. Is data ready to import? (true/false)
3. Does it require human review? (true/false)
4. Summary: How many rows are ready, have warnings, or have errors?
5. Recommendations for user

Be conservative - if uncertain, require human review.`;

  const ReadinessSchema = z.object({
    overallConfidence: z.number().min(0).max(1),
    readyToImport: z.boolean(),
    humanReviewRequired: z.boolean(),
    summary: z.object({
      totalRows: z.number(),
      readyRows: z.number(),
      warningRows: z.number(),
      errorRows: z.number(),
    }),
    recommendations: z.array(z.string()),
    estimatedImportTime: z.string().optional(),
  });

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    ReadinessSchema
  );

  return {
    overallConfidence: data.overallConfidence,
    readyToImport: data.readyToImport,
    humanReviewRequired: data.humanReviewRequired,
    summary: data.summary,
    recommendations: data.recommendations,
    usage,
  };
}

/**
 * Run all validation analyses
 */
export async function runValidation(params: {
  entityType: EntityType;
  rows: Array<Record<string, unknown>>;
  conflicts: Array<{
    importRow: Record<string, unknown>;
    existingEntity: { id: string; name: string; [key: string]: unknown };
    conflictFields: string[];
  }>;
  analysisMetrics: {
    structureConfidence: number;
    mappingConfidence: number;
    qualityScore: number;
    issuesFound: number;
    duplicatesFound: number;
  };
}): Promise<{
  consistencyIssues: Array<{
    type: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    description: string;
    affectedRows: number[];
    suggestion: string;
  }>;
  conflictResolutions: Array<{
    rowIndex: number;
    recommendation: "UPDATE" | "SKIP" | "CREATE_NEW" | "ASK_USER";
    reasoning: string;
    confidence: number;
  }>;
  finalAssessment: {
    overallConfidence: number;
    readyToImport: boolean;
    humanReviewRequired: boolean;
    summary: {
      totalRows: number;
      readyRows: number;
      warningRows: number;
      errorRows: number;
    };
    recommendations: string[];
  };
  totalUsage: TokenUsage;
}> {
  const { entityType, rows, conflicts, analysisMetrics } = params;

  // Step 1: Consistency check
  const consistencyResult = await checkConsistency({ rows, entityType });

  // Step 2: Conflict resolution (if any conflicts)
  let conflictResult: {
    resolutions: Array<{
      rowIndex: number;
      recommendation: "UPDATE" | "SKIP" | "CREATE_NEW" | "ASK_USER";
      reasoning: string;
      confidence: number;
    }>;
    usage: TokenUsage;
  } = {
    resolutions: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };

  if (conflicts.length > 0) {
    conflictResult = await resolveConflicts({ conflicts, entityType });
  }

  // Step 3: Final readiness assessment
  const readinessResult = await assessImportReadiness({
    totalRows: rows.length,
    structureConfidence: analysisMetrics.structureConfidence,
    mappingConfidence: analysisMetrics.mappingConfidence,
    qualityScore: analysisMetrics.qualityScore,
    issuesFound: analysisMetrics.issuesFound + consistencyResult.issues.length,
    duplicatesFound: analysisMetrics.duplicatesFound,
    conflictsFound: conflicts.length,
  });

  // Aggregate usage
  const totalUsage = {
    promptTokens:
      consistencyResult.usage.promptTokens +
      conflictResult.usage.promptTokens +
      readinessResult.usage.promptTokens,
    completionTokens:
      consistencyResult.usage.completionTokens +
      conflictResult.usage.completionTokens +
      readinessResult.usage.completionTokens,
    totalTokens:
      consistencyResult.usage.totalTokens +
      conflictResult.usage.totalTokens +
      readinessResult.usage.totalTokens,
  };

  return {
    consistencyIssues: consistencyResult.issues,
    conflictResolutions: conflictResult.resolutions,
    finalAssessment: {
      overallConfidence: readinessResult.overallConfidence,
      readyToImport: readinessResult.readyToImport,
      humanReviewRequired: readinessResult.humanReviewRequired,
      summary: readinessResult.summary,
      recommendations: readinessResult.recommendations,
    },
    totalUsage,
  };
}
