import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { z } from "zod";
import {
  createProductionBatchFormSchema,
  productionBatchFilterSchema,
} from "@/lib/validation/production.schemas";

/**
 * GET /api/stores/[id]/production-batches
 * Get all production batches for a store with optional filtering
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      status: searchParams.get("status") || undefined,
      recipeId: searchParams.get("recipeId") || undefined,
      productId: searchParams.get("productId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "scheduledDate",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || "0",
      take: searchParams.get("take") || "50",
    };

    const filters = productionBatchFilterSchema.parse(filterParams);

    // Get production batches from service
    const result = await productionBatchService.getProductionBatches(storeId, filters);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching production batches:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid filter parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch production batches" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/production-batches
 * Start production - creates a new production batch and deducts materials
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = createProductionBatchFormSchema.parse(body);

    // Start production via service
    const batch = await productionBatchService.startProduction({
      storeId,
      ...validatedData,
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error("Error starting production:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific business logic errors
      if (error.message.includes("Insufficient materials")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start production" },
      { status: 500 }
    );
  }
}
