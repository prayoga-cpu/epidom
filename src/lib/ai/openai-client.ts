/**
 * OpenAI Client Wrapper for AI Import Agent
 *
 * Uses @ai-sdk/openai for structured output and streaming support.
 * Provides utility functions for the AI import pipeline.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";

// Default model for import analysis
export const AI_IMPORT_MODEL = "gpt-4o";

// Token tracking
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Generate structured JSON object from AI
 */
export async function generateStructuredResponse<T extends z.ZodType>(
  systemPrompt: string,
  userPrompt: string,
  schema: T,
  options?: {
    temperature?: number;
    /** Built-in ai-sdk retry/backoff on transient/rate-limit errors. Default 2. */
    maxRetries?: number;
    /** Hard ceiling (ms) for the whole call incl. retries. Default 30s. */
    timeoutMs?: number;
  }
): Promise<{
  data: z.infer<T>;
  usage: TokenUsage;
}> {
  const result = await generateObject({
    model: openai(AI_IMPORT_MODEL),
    schema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.1,
    maxRetries: options?.maxRetries ?? 2,
    abortSignal: AbortSignal.timeout(options?.timeoutMs ?? 30_000),
  });

  return {
    data: result.object,
    usage: {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    },
  };
}

/**
 * Generate text response from AI (for reasoning/explanations)
 */
export async function generateTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
  }
): Promise<{
  text: string;
  usage: TokenUsage;
}> {
  const result = await generateText({
    model: openai(AI_IMPORT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.3,
  });

  return {
    text: result.text,
    usage: {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    },
  };
}

/**
 * Estimate token count for a string (rough approximation)
 * GPT models use ~4 chars per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost based on token usage
 * GPT-4o pricing: $2.50/1M input, $10/1M output
 */
export function calculateCost(usage: TokenUsage): number {
  const inputCost = (usage.promptTokens / 1_000_000) * 2.5;
  const outputCost = (usage.completionTokens / 1_000_000) * 10;
  return inputCost + outputCost;
}

/**
 * Aggregate token usage from multiple calls
 */
export function aggregateUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.promptTokens,
      completionTokens: acc.completionTokens + usage.completionTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}
