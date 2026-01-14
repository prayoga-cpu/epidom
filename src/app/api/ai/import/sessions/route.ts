/**
 * AI Import Sessions API Route
 *
 * GET /api/ai/import/sessions
 *
 * Lists past import sessions for a store.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get store ID from query
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!storeId) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

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

    // Get sessions
    const sessions = await prisma.aIImportSession.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        rowCount: true,
        entityType: true,
        status: true,
        aiCallCount: true,
        totalTokens: true,
        processingTimeMs: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate stats
    type SessionItem = (typeof sessions)[number];
    const stats = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s: SessionItem) => s.status === "completed").length,
      failedSessions: sessions.filter((s: SessionItem) => s.status === "failed").length,
      totalRowsImported: sessions
        .filter((s: SessionItem) => s.status === "completed")
        .reduce((sum: number, s: SessionItem) => sum + s.rowCount, 0),
      totalTokensUsed: sessions.reduce((sum: number, s: SessionItem) => sum + s.totalTokens, 0),
    };

    return NextResponse.json({
      sessions,
      stats,
    });
  } catch (error) {
    console.error("AI Import Sessions Error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
