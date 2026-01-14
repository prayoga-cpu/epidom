/**
 * AI Memory Service
 *
 * Manages learned patterns for the AI Import Agent.
 * Stores and retrieves memories to improve import accuracy over time.
 */

import { prisma } from "@/lib/prisma";
import type { MemoryType } from "../import/types";

/**
 * Memory record from database
 */
export interface AIMemory {
  id: string;
  storeId: string;
  memoryType: string;
  sourcePattern: string;
  targetMapping: string;
  entityType: string;
  confidence: number;
  usageCount: number;
  successCount: number;
  userConfirmed: boolean;
  lastUsed: Date;
}

/**
 * Create or update a memory
 */
export async function upsertMemory(params: {
  storeId: string;
  memoryType: MemoryType;
  sourcePattern: string;
  targetMapping: string;
  entityType: string;
  userConfirmed?: boolean;
}): Promise<AIMemory> {
  const { storeId, memoryType, sourcePattern, targetMapping, entityType, userConfirmed } = params;

  // Normalize source pattern for consistent matching
  const normalizedSource = sourcePattern.toLowerCase().trim();

  const existing = await prisma.aIImportMemory.findUnique({
    where: {
      storeId_memoryType_sourcePattern_entityType: {
        storeId,
        memoryType,
        sourcePattern: normalizedSource,
        entityType,
      },
    },
  });

  if (existing) {
    // Update existing memory
    return prisma.aIImportMemory.update({
      where: { id: existing.id },
      data: {
        targetMapping,
        usageCount: { increment: 1 },
        lastUsed: new Date(),
        userConfirmed: userConfirmed ?? existing.userConfirmed,
        // Boost confidence if user confirmed
        confidence: userConfirmed ? Math.min(existing.confidence + 0.1, 1.0) : existing.confidence,
      },
    });
  }

  // Create new memory
  return prisma.aIImportMemory.create({
    data: {
      storeId,
      memoryType,
      sourcePattern: normalizedSource,
      targetMapping,
      entityType,
      confidence: userConfirmed ? 0.8 : 0.5,
      userConfirmed: userConfirmed ?? false,
    },
  });
}

/**
 * Record a successful use of a memory
 */
export async function recordSuccess(memoryId: string): Promise<void> {
  const memory = await prisma.aIImportMemory.findUnique({
    where: { id: memoryId },
  });

  if (!memory) return;

  // Calculate new confidence based on success rate
  const newSuccessCount = memory.successCount + 1;
  const successRate = newSuccessCount / memory.usageCount;
  const newConfidence = Math.min(0.5 + successRate * 0.5, 1.0);

  await prisma.aIImportMemory.update({
    where: { id: memoryId },
    data: {
      successCount: newSuccessCount,
      confidence: newConfidence,
      lastUsed: new Date(),
    },
  });
}

/**
 * Record a failed use of a memory (user corrected AI's suggestion)
 */
export async function recordFailure(memoryId: string): Promise<void> {
  const memory = await prisma.aIImportMemory.findUnique({
    where: { id: memoryId },
  });

  if (!memory) return;

  // Decrease confidence but don't go below 0.1
  const newConfidence = Math.max(memory.confidence * 0.8, 0.1);

  await prisma.aIImportMemory.update({
    where: { id: memoryId },
    data: {
      confidence: newConfidence,
      lastUsed: new Date(),
    },
  });
}

/**
 * Get memories for a store, optionally filtered
 */
export async function getMemories(params: {
  storeId: string;
  memoryType?: MemoryType;
  entityType?: string;
  minConfidence?: number;
  limit?: number;
}): Promise<AIMemory[]> {
  const { storeId, memoryType, entityType, minConfidence = 0.3, limit = 100 } = params;

  return prisma.aIImportMemory.findMany({
    where: {
      storeId,
      ...(memoryType && { memoryType }),
      ...(entityType && { entityType }),
      confidence: { gte: minConfidence },
    },
    orderBy: [{ confidence: "desc" }, { usageCount: "desc" }],
    take: limit,
  });
}

/**
 * Find a specific memory by pattern
 */
export async function findMemory(params: {
  storeId: string;
  memoryType: MemoryType;
  sourcePattern: string;
  entityType: string;
}): Promise<AIMemory | null> {
  const { storeId, memoryType, sourcePattern, entityType } = params;
  const normalizedSource = sourcePattern.toLowerCase().trim();

  return prisma.aIImportMemory.findUnique({
    where: {
      storeId_memoryType_sourcePattern_entityType: {
        storeId,
        memoryType,
        sourcePattern: normalizedSource,
        entityType,
      },
    },
  });
}

/**
 * Delete old, low-confidence memories
 */
export async function pruneMemories(
  storeId: string,
  options?: {
    maxAge?: number; // Days
    minConfidence?: number;
    minUsageCount?: number;
  }
): Promise<number> {
  const { maxAge = 90, minConfidence = 0.2, minUsageCount = 2 } = options ?? {};

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);

  const result = await prisma.aIImportMemory.deleteMany({
    where: {
      storeId,
      OR: [
        // Old and low confidence
        {
          lastUsed: { lt: cutoffDate },
          confidence: { lt: minConfidence },
        },
        // Very low usage
        {
          usageCount: { lt: minUsageCount },
          userConfirmed: false,
          createdAt: { lt: cutoffDate },
        },
      ],
    },
  });

  return result.count;
}

/**
 * Format memories for AI prompt injection
 */
export function formatMemoriesForAI(memories: AIMemory[]): string {
  if (memories.length === 0) return "";

  const lines: string[] = [
    "## LEARNED PATTERNS FOR THIS STORE",
    "",
    "These patterns were learned from previous imports. Use them to make faster, more accurate decisions.",
    "",
  ];

  // Group by memory type
  const byType = new Map<string, AIMemory[]>();
  memories.forEach((m) => {
    if (!byType.has(m.memoryType)) {
      byType.set(m.memoryType, []);
    }
    byType.get(m.memoryType)!.push(m);
  });

  // Format field mappings
  const fieldMappings = byType.get("FIELD_MAPPING") ?? [];
  if (fieldMappings.length > 0) {
    lines.push("### Known Field Mappings:");
    fieldMappings.forEach((m) => {
      const marker = m.userConfirmed ? "✓" : "";
      lines.push(
        `- "${m.sourcePattern}" → ${m.targetMapping} (confidence: ${m.confidence.toFixed(2)}) ${marker}`
      );
    });
    lines.push("");
  }

  // Format typo corrections
  const typoCorrections = byType.get("TYPO_CORRECTION") ?? [];
  if (typoCorrections.length > 0) {
    lines.push("### Known Typos/Corrections:");
    typoCorrections.forEach((m) => {
      lines.push(`- "${m.sourcePattern}" → "${m.targetMapping}"`);
    });
    lines.push("");
  }

  // Format unit normalizations
  const unitNorms = byType.get("UNIT_NORMALIZATION") ?? [];
  if (unitNorms.length > 0) {
    lines.push("### Unit Normalizations:");
    unitNorms.forEach((m) => {
      lines.push(`- "${m.sourcePattern}" → "${m.targetMapping}"`);
    });
    lines.push("");
  }

  // Format supplier aliases
  const supplierAliases = byType.get("SUPPLIER_ALIAS") ?? [];
  if (supplierAliases.length > 0) {
    lines.push("### Supplier Aliases:");
    supplierAliases.forEach((m) => {
      lines.push(`- "${m.sourcePattern}" = "${m.targetMapping}"`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Batch save corrections from user review
 */
export async function saveUserCorrections(
  storeId: string,
  entityType: string,
  corrections: Array<{
    memoryType: MemoryType;
    sourcePattern: string;
    targetMapping: string;
  }>
): Promise<void> {
  await Promise.all(
    corrections.map((c) =>
      upsertMemory({
        storeId,
        memoryType: c.memoryType,
        sourcePattern: c.sourcePattern,
        targetMapping: c.targetMapping,
        entityType,
        userConfirmed: true, // User explicitly corrected
      })
    )
  );
}
