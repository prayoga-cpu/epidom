/**
 * AI Import Analysis API Route
 *
 * POST /api/ai/import/analyze
 *
 * Runs the full AI analysis pipeline on uploaded CSV data.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { runImportPipeline } from "@/lib/ai/import/pipeline";
import { z } from "zod";

const AnalyzeRequestSchema = z.object({
  storeId: z.string().cuid(),
  csvContent: z.string().min(1),
  entityType: z.enum(["material", "product", "supplier", "recipe"]).optional(),
  fileName: z.string().optional(),
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
    const validation = AnalyzeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { storeId, csvContent, entityType, fileName } = validation.data;

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

    // Create import session
    const importSession = await prisma.aIImportSession.create({
      data: {
        storeId,
        fileName: fileName || "upload.csv",
        fileSize: csvContent.length,
        rowCount: csvContent.split("\n").length - 1,
        entityType,
        status: "analyzing",
      },
    });

    try {
      // Run the AI pipeline
      const startTime = Date.now();

      const result = await runImportPipeline({
        storeId,
        csvContent,
        entityType,
        fileName,
      });

      const processingTime = Date.now() - startTime;

      // Update session with results
      await prisma.aIImportSession.update({
        where: { id: importSession.id },
        data: {
          status: "preview",
          analysisResult: result.analysis as object,
          aiCallCount: result.aiCallCount,
          totalTokens: result.totalTokens,
          processingTimeMs: processingTime,
          rowCount: result.parsedData.length,
        },
      });

      return NextResponse.json({
        success: true,
        sessionId: importSession.id,
        analysis: result.analysis,
        parsedData: result.parsedData,
        headers: result.headers,
        metrics: {
          aiCallCount: result.aiCallCount,
          totalTokens: result.totalTokens,
          estimatedCost: result.estimatedCost,
          processingTimeMs: processingTime,
        },
      });
    } catch (pipelineError) {
      // Update session with error
      await prisma.aIImportSession.update({
        where: { id: importSession.id },
        data: {
          status: "failed",
          errorMessage:
            pipelineError instanceof Error ? pipelineError.message : "Pipeline failed",
        },
      });

      throw pipelineError;
    }
  } catch (error) {
    console.error("AI Import Analysis Error:", error);

    return NextResponse.json(
      {
        error: "Analysis failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
