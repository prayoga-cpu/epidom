/**
 * AI Import Types
 *
 * Shared types for the AI Import Agent pipeline.
 * Schemas are designed to be lenient to handle AI response variations.
 */

import { z } from "zod";

// =============================================================================
// ENTITY TYPES
// =============================================================================

export const EntityType = z.enum(["material", "product", "supplier", "recipe"]);
export type EntityType = z.infer<typeof EntityType>;

// =============================================================================
// CONFIDENCE LEVELS
// =============================================================================

export const ConfidenceLevel = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

// =============================================================================
// MEMORY TYPES
// =============================================================================

export const MemoryType = z.enum([
  "FIELD_MAPPING",
  "HEADER_TRANSLATION",
  "TYPO_CORRECTION",
  "CATEGORY_NORMALIZATION",
  "UNIT_NORMALIZATION",
  "SUPPLIER_ALIAS",
  "MATERIAL_ALIAS",
  "HEADER_ROW_PATTERN",
  "DELIMITER_PATTERN",
  "DEFAULT_CATEGORY",
  "SKIP_COLUMN",
]);
export type MemoryType = z.infer<typeof MemoryType>;

// =============================================================================
// TRANSFORM TYPES
// =============================================================================

export const TransformType = z.enum([
  "NONE",
  "EXTRACT_NUMBER",
  "EXTRACT_INT",
  "BOOLEAN_Y_N",
  "DATE_STANDARD",
  "UPPERCASE",
  "LOWERCASE",
  "TITLECASE",
  "TRIM",
]);
export type TransformType = z.infer<typeof TransformType>;

// =============================================================================
// STRUCTURE TYPES
// =============================================================================

export const StructureType = z.enum([
  "STANDARD_CSV",
  "TRANSPOSED",
  "MIXED",
  "HIERARCHICAL",
  "PIVOTED",
]);
export type StructureType = z.infer<typeof StructureType>;

// =============================================================================
// ANALYSIS SCHEMAS (Made lenient with defaults)
// =============================================================================

export const LanguageAnalysisSchema = z.object({
  primaryLanguage: z.string().default("unknown"),
  secondaryLanguages: z.array(z.string()).optional().default([]),
  numberFormat: z.enum(["us", "european", "indonesian", "indian", "unknown"]).default("us"),
  dateFormat: z.string().optional().nullable(),
  currencySymbol: z.string().optional().nullable(),
  hasEncodingIssues: z.boolean().default(false),
});
export type LanguageAnalysis = z.infer<typeof LanguageAnalysisSchema>;

export const DelimiterAnalysisSchema = z.object({
  isTabularData: z.boolean().default(true),
  delimiter: z.string().default(","),
  textQualifier: z.string().optional().nullable(),
  lineEnding: z.enum(["LF", "CRLF", "CR"]).default("LF"),
  confidence: ConfidenceLevel.default("MEDIUM"),
  irregularities: z.array(z.string()).optional().default([]),
});
export type DelimiterAnalysis = z.infer<typeof DelimiterAnalysisSchema>;

export const QualityAnalysisSchema = z.object({
  completenessScore: z.number().min(0).max(1).default(0.5),
  consistencyScore: z.number().min(0).max(1).default(0.5),
  validityScore: z.number().min(0).max(1).default(0.5),
  overallScore: z.number().min(0).max(1).default(0.5),
  importable: z.boolean().default(true),
  issues: z
    .array(
      z.object({
        type: z.string(),
        severity: z.enum(["HIGH", "MEDIUM", "LOW"]).default("LOW"),
        description: z.string().optional().nullable(),
        affectedColumns: z.array(z.number()).optional().default([]),
        examples: z.array(z.string()).optional().default([]),
      })
    )
    .default([]),
});
export type QualityAnalysis = z.infer<typeof QualityAnalysisSchema>;

export const StructureAnalysisSchema = z.object({
  structureType: StructureType.default("STANDARD_CSV"),
  language: z.string().default("unknown"),
  hasMultipleEntities: z.boolean().default(false),
  // The single best-guess entity type for the WHOLE file (works for any language,
  // since the model reads the headers directly). Used by auto-detection so a
  // single-entity file is not silently treated as "material".
  primaryEntityType: EntityType.optional().nullable(),
  junkRowsAtTop: z.number().default(0),
  headerRowIndex: z.number().default(0),
  dataStartIndex: z.number().default(1),
  junkRowsAtBottom: z.number().default(0),
  sections: z
    .array(
      z.object({
        name: z.string(),
        entityType: EntityType.optional().nullable(),
        startLine: z.number(),
        endLine: z.number(),
      })
    )
    .optional()
    .default([]),
  reasoning: z.string().default(""),
});
export type StructureAnalysis = z.infer<typeof StructureAnalysisSchema>;

// =============================================================================
// FIELD MAPPING SCHEMAS
// =============================================================================

export const FieldMappingSchema = z.object({
  sourceColumn: z.object({
    index: z.number(),
    header: z.string(),
  }),
  semanticMeaning: z.string().default(""),
  targetField: z.string(),
  confidence: ConfidenceLevel.default("MEDIUM"),
  reasoning: z.string().default(""),
  alternativeInterpretations: z.array(z.string()).optional().default([]),
  transformationNeeded: TransformType.default("NONE"),
  sampleTransformation: z.string().optional().nullable(),
  dataType: z.enum(["string", "number", "boolean", "date"]).default("string"),
});
export type FieldMapping = z.infer<typeof FieldMappingSchema>;

export const MappingAnalysisSchema = z.object({
  mappings: z.array(FieldMappingSchema).default([]),
  unmappedColumns: z
    .array(
      z.object({
        index: z.number(),
        header: z.string(),
        reason: z.string().default(""),
      })
    )
    .default([]),
  ambiguousColumns: z
    .array(
      z.object({
        index: z.number(),
        header: z.string(),
        possibleMappings: z.array(z.string()).default([]),
        bestGuess: z.string().default(""),
        confidence: ConfidenceLevel.default("LOW"),
        needsUserConfirmation: z.boolean().default(true),
      })
    )
    .default([]),
  detectedRelationships: z
    .array(
      z.object({
        type: z.string(),
        sourceColumn: z.string(),
        targetEntity: EntityType,
        linkMethod: z.string().default(""),
      })
    )
    .default([]),
});
export type MappingAnalysis = z.infer<typeof MappingAnalysisSchema>;

// =============================================================================
// DATA HEALING SCHEMAS
// =============================================================================

export const TypoCorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  type: z.enum(["TYPO", "MISSING_SPACE", "NORMALIZE", "OK", "INVALID"]).default("OK"),
  confidence: z.number().min(0).max(1).default(0.5),
});
export type TypoCorrection = z.infer<typeof TypoCorrectionSchema>;

export const MissingValueInferenceSchema = z.object({
  column: z.string(),
  inferredValue: z.string().nullable().default(null),
  method: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
  askUser: z.boolean().default(true),
  suggestDefault: z.string().nullable().optional(),
});
export type MissingValueInference = z.infer<typeof MissingValueInferenceSchema>;

export const DuplicateDetectionSchema = z.object({
  exactDuplicates: z
    .array(
      z.object({
        rows: z.array(z.number()),
        identifier: z.string(),
        action: z.enum(["KEEP_FIRST", "KEEP_LAST", "MERGE", "ASK_USER"]).default("ASK_USER"),
      })
    )
    .default([]),
  nearDuplicates: z
    .array(
      z.object({
        rows: z.array(z.number()),
        values: z.array(z.string()).default([]),
        similarity: z.number().default(0),
        suggestAction: z.enum(["MERGE", "KEEP_BOTH", "ASK_USER"]).default("ASK_USER"),
        needsConfirmation: z.boolean().default(true),
      })
    )
    .default([]),
  databaseConflicts: z
    .array(
      z.object({
        importRow: z.number(),
        importSku: z.string().default(""),
        existingId: z.string(),
        existingName: z.string(),
        conflictFields: z.array(z.string()).default([]),
        suggestAction: z.enum(["UPDATE", "SKIP", "CREATE_NEW", "ASK_USER"]).default("ASK_USER"),
      })
    )
    .default([]),
});
export type DuplicateDetection = z.infer<typeof DuplicateDetectionSchema>;

// =============================================================================
// FINAL ANALYSIS RESULT
// =============================================================================

export const ImportAnalysisResultSchema = z.object({
  // Stage 1: Reconnaissance
  language: LanguageAnalysisSchema,
  delimiter: DelimiterAnalysisSchema,
  quality: QualityAnalysisSchema,

  // Stage 2: Structure
  structure: StructureAnalysisSchema,

  // Stage 3: Mapping
  mapping: MappingAnalysisSchema,

  // Stage 4: Healing
  typoCorrections: z.array(TypoCorrectionSchema).default([]),
  missingValueInferences: z.array(MissingValueInferenceSchema).default([]),

  // Stage 5: Validation
  duplicates: DuplicateDetectionSchema,

  // Overall
  overallConfidence: z.number().min(0).max(1).default(0.5),
  readyToImport: z.boolean().default(false),
  humanReviewRequired: z.boolean().default(true),
  summary: z.object({
    totalRows: z.number().default(0),
    readyRows: z.number().default(0),
    warningRows: z.number().default(0),
    errorRows: z.number().default(0),
  }),
  recommendations: z.array(z.string()).default([]),

  // Metrics
  aiCallCount: z.number().default(0),
  totalTokens: z.number().default(0),
  estimatedCost: z.number().default(0),
});
export type ImportAnalysisResult = z.infer<typeof ImportAnalysisResultSchema>;

// =============================================================================
// IMPORT EXECUTION
// =============================================================================

export const ImportDecisionSchema = z.object({
  rowIndex: z.number(),
  action: z.enum(["IMPORT", "SKIP", "UPDATE", "MERGE"]),
  targetId: z.string().optional().nullable(),
  overrides: z.record(z.string(), z.unknown()).optional(),
});
export type ImportDecision = z.infer<typeof ImportDecisionSchema>;

export const ImportExecutionResultSchema = z.object({
  success: z.boolean(),
  summary: z.object({
    materials: z.object({ attempted: z.number(), succeeded: z.number() }),
    products: z.object({ attempted: z.number(), succeeded: z.number() }),
    suppliers: z.object({ attempted: z.number(), succeeded: z.number() }),
    recipes: z.object({ attempted: z.number(), succeeded: z.number() }),
    totalSucceeded: z.number(),
    autoCreated: z
      .object({
        suppliers: z.number().default(0),
        materials: z.number().default(0),
      })
      .default({ suppliers: 0, materials: 0 }),
  }),
  errors: z
    .array(
      z.object({
        rowIndex: z.number(),
        entityType: EntityType,
        error: z.string(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .default([]),
});
export type ImportExecutionResult = z.infer<typeof ImportExecutionResultSchema>;
