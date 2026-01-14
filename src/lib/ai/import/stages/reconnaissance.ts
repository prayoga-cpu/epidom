/**
 * Stage 1: Reconnaissance
 *
 * Performs initial analysis of the CSV file:
 * - Language detection
 * - Delimiter/format detection
 * - Data quality assessment
 */

import { generateStructuredResponse } from "../../openai-client";
import type { TokenUsage } from "../../openai-client";
import {
  LanguageAnalysisSchema,
  DelimiterAnalysisSchema,
  QualityAnalysisSchema,
  type LanguageAnalysis,
  type DelimiterAnalysis,
  type QualityAnalysis,
} from "../types";

/**
 * AI Call 1: Detect language and regional formats
 */
export async function detectLanguage(csvPreview: string): Promise<{
  analysis: LanguageAnalysis;
  usage: TokenUsage;
}> {
  const systemPrompt = `You are an expert at detecting languages and regional data formats.
Analyze the provided text sample and determine:
1. Primary language(s) used
2. Regional format conventions (date, number, currency)
3. Any character encoding issues

Be precise and confident in your analysis.`;

  const userPrompt = `Analyze this CSV data sample:

${csvPreview}

Determine:
- Primary language
- Secondary languages (if any)
- Number format (US: 1,000.50 vs European: 1.000,50 vs Indonesian: 1.000,50)
- Date format pattern
- Currency symbol (if present)
- Any encoding issues`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    LanguageAnalysisSchema
  );

  return { analysis: data, usage };
}

/**
 * AI Call 2: Detect delimiter and file structure
 */
export async function detectDelimiter(rawContent: string): Promise<{
  analysis: DelimiterAnalysis;
  usage: TokenUsage;
}> {
  // Take first 2KB for analysis
  const sample = rawContent.substring(0, 2000);

  const systemPrompt = `You are an expert at analyzing tabular data file formats.
Determine the delimiter, text qualifier, and structural characteristics.
Be very precise - incorrect delimiter detection will break the entire import.`;

  const userPrompt = `Analyze this raw file content:

\`\`\`
${sample}
\`\`\`

Determine:
- Is this tabular data (CSV-like)?
- Field delimiter (comma, semicolon, tab, pipe, or custom)
- Text qualifier (double quotes, single quotes, or none)
- Line ending style (LF, CRLF, CR)
- Any irregularities (e.g., inconsistent delimiters, quoted fields with delimiters inside)

Return HIGH confidence only if you're certain.`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    DelimiterAnalysisSchema
  );

  return { analysis: data, usage };
}

/**
 * AI Call 3: Assess overall data quality
 */
export async function assessQuality(
  csvPreview: string,
  rowCount: number
): Promise<{
  analysis: QualityAnalysis;
  usage: TokenUsage;
}> {
  const systemPrompt = `You are a data quality expert.
Assess the completeness, consistency, and validity of this dataset.
Identify potential issues that might affect import success.`;

  const userPrompt = `Analyze this CSV data (${rowCount} total rows, showing preview):

${csvPreview}

Evaluate:
1. Completeness: What % of cells have data?
2. Consistency: Are formats consistent across rows?
3. Validity: Does data look reasonable and valid?
4. Issues: Identify specific problems (missing values, format inconsistencies, possible typos, outliers)

Provide scores from 0.0 to 1.0 for each dimension.
Determine if this data is importable or requires significant cleanup.`;

  const { data, usage } = await generateStructuredResponse(
    systemPrompt,
    userPrompt,
    QualityAnalysisSchema
  );

  return { analysis: data, usage };
}

/**
 * Run all reconnaissance analyses
 */
export async function runReconnaissance(params: {
  rawContent: string;
  csvPreview: string;
  rowCount: number;
}): Promise<{
  language: LanguageAnalysis;
  delimiter: DelimiterAnalysis;
  quality: QualityAnalysis;
  totalUsage: TokenUsage;
}> {
  const { rawContent, csvPreview, rowCount } = params;

  // Run all 3 AI calls in parallel for speed
  const [languageResult, delimiterResult, qualityResult] = await Promise.all([
    detectLanguage(csvPreview),
    detectDelimiter(rawContent),
    assessQuality(csvPreview, rowCount),
  ]);

  // Aggregate token usage
  const totalUsage = {
    promptTokens:
      languageResult.usage.promptTokens +
      delimiterResult.usage.promptTokens +
      qualityResult.usage.promptTokens,
    completionTokens:
      languageResult.usage.completionTokens +
      delimiterResult.usage.completionTokens +
      qualityResult.usage.completionTokens,
    totalTokens:
      languageResult.usage.totalTokens +
      delimiterResult.usage.totalTokens +
      qualityResult.usage.totalTokens,
  };

  return {
    language: languageResult.analysis,
    delimiter: delimiterResult.analysis,
    quality: qualityResult.analysis,
    totalUsage,
  };
}
