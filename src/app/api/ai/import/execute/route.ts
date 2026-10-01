/**
 * AI Import Execute API Route
 *
 * POST /api/ai/import/execute
 *
 * Executes the import with user-confirmed decisions.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { bulkImportMultiEntity } from "@/features/dashboard/data/actions";
import { saveUserCorrections } from "@/lib/ai/memory/ai-memory.service";
import { z } from "zod";
import type { MemoryType } from "@/lib/ai/import/types";

// Rows are written one at a time (each product: a duplicate check, the write,
// its menu item). A full menu takes far longer than the platform default.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ExecuteRequestSchema = z.object({
  sessionId: z.string().cuid(),
  storeId: z.string().cuid(),
  entityType: z.enum(["material", "product", "supplier", "recipe"]),
  // The type picked (or detected) in the dialog. Separate from `entityType`,
  // which older clients fill with a placeholder when nothing was chosen.
  fallbackEntityType: z.enum(["material", "product", "supplier", "recipe"]).optional(),
  data: z.array(z.record(z.unknown())),
  decisions: z
    .array(
      z.object({
        rowIndex: z.number(),
        action: z.enum(["IMPORT", "SKIP", "UPDATE", "MERGE"]),
        targetId: z.string().optional(),
        overrides: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  mappingCorrections: z
    .array(
      z.object({
        sourceColumn: z.string(),
        originalMapping: z.string(),
        correctedMapping: z.string(),
      })
    )
    .optional(),
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
    const validation = ExecuteRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      sessionId,
      storeId,
      entityType,
      fallbackEntityType,
      data,
      decisions,
      mappingCorrections,
    } = validation.data;

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

    // Verify session
    const importSession = await prisma.aIImportSession.findFirst({
      where: {
        id: sessionId,
        storeId,
      },
    });

    if (!importSession) {
      return NextResponse.json({ error: "Import session not found" }, { status: 404 });
    }

    // Update session status
    await prisma.aIImportSession.update({
      where: { id: sessionId },
      data: { status: "importing" },
    });

    try {
      // Apply decisions to filter/modify data
      let dataToImport = data;

      if (decisions && decisions.length > 0) {
        dataToImport = data.filter((_, idx) => {
          const decision = decisions.find((d) => d.rowIndex === idx);
          if (!decision) return true; // No decision = import
          return decision.action !== "SKIP";
        });

        // Apply overrides
        dataToImport = dataToImport.map((row, idx) => {
          const originalIdx = data.indexOf(row);
          const decision = decisions.find((d) => d.rowIndex === originalIdx);
          if (decision?.overrides) {
            return { ...row, ...decision.overrides };
          }
          return row;
        });
      }

      // Execute bulk import
      const result = await bulkImportMultiEntity({
        storeId,
        data: dataToImport,
        fallbackEntityType,
      });

      // Save mapping corrections as memories
      if (mappingCorrections && mappingCorrections.length > 0) {
        const corrections = mappingCorrections.map((c) => ({
          memoryType: "FIELD_MAPPING" as MemoryType,
          sourcePattern: c.sourceColumn,
          targetMapping: c.correctedMapping,
        }));

        await saveUserCorrections(storeId, entityType, corrections);
      }

      // Update session with results
      await prisma.aIImportSession.update({
        where: { id: sessionId },
        data: {
          // A run that wrote nothing is a failure in the session history too.
          status: result.success ? "completed" : "failed",
          ...(!result.success && { errorMessage: result.error ?? "Import failed" }),
          importResult: result as object,
          userCorrections: mappingCorrections as object[] | undefined,
        },
      });

      return NextResponse.json({
        ...result,
        sessionId,
      });
    } catch (importError) {
      // Update session with error
      await prisma.aIImportSession.update({
        where: { id: sessionId },
        data: {
          status: "failed",
          errorMessage: importError instanceof Error ? importError.message : "Import failed",
        },
      });

      throw importError;
    }
  } catch (error) {
    console.error("AI Import Execute Error:", error);

    return NextResponse.json(
      {
        error: "Import execution failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
