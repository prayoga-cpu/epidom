/**
 * AI Import Feedback API Route
 *
 * POST /api/ai/import/feedback
 *
 * Saves user corrections and feedback to improve AI over time.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { upsertMemory, recordSuccess, recordFailure } from "@/lib/ai/memory/ai-memory.service";
import { z } from "zod";
import type { MemoryType } from "@/lib/ai/import/types";

const FeedbackRequestSchema = z.object({
  sessionId: z.string().cuid(),
  storeId: z.string().cuid(),
  entityType: z.enum(["material", "product", "supplier", "recipe"]),
  feedback: z.array(
    z.object({
      type: z.enum([
        "FIELD_MAPPING",
        "TYPO_CORRECTION",
        "CATEGORY_NORMALIZATION",
        "UNIT_NORMALIZATION",
        "SUPPLIER_ALIAS",
        "MATERIAL_ALIAS",
      ]),
      sourcePattern: z.string(),
      aiSuggestion: z.string().optional(),
      userCorrection: z.string(),
      wasCorrect: z.boolean(),
      memoryId: z.string().optional(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validation = FeedbackRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { sessionId, storeId, entityType, feedback } = validation.data;

    // Verify store access
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: {
          userId: session.user.id,
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found or access denied" }, { status: 404 });
    }

    // Process feedback
    const results: Array<{ sourcePattern: string; action: string }> = [];

    for (const item of feedback) {
      if (item.wasCorrect) {
        // AI was correct - record success
        if (item.memoryId) {
          await recordSuccess(item.memoryId);
          results.push({ sourcePattern: item.sourcePattern, action: "success_recorded" });
        }
      } else {
        // AI was wrong - record failure and save correction
        if (item.memoryId) {
          await recordFailure(item.memoryId);
        }

        // Save the user's correction as new memory
        await upsertMemory({
          storeId,
          memoryType: item.type as MemoryType,
          sourcePattern: item.sourcePattern,
          targetMapping: item.userCorrection,
          entityType,
          userConfirmed: true,
        });

        results.push({ sourcePattern: item.sourcePattern, action: "correction_saved" });
      }
    }

    // Update session with feedback
    await prisma.aIImportSession.update({
      where: { id: sessionId },
      data: {
        userCorrections: feedback as object[],
      },
    });

    return NextResponse.json({
      success: true,
      memoriesUpdated: results.length,
      results,
    });
  } catch (error) {
    console.error("AI Import Feedback Error:", error);

    return NextResponse.json(
      {
        error: "Feedback processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
