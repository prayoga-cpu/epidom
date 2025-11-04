import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { createCSVResponse } from "@/lib/utils/csv-export";
import { z } from "zod";

// Validation schema for filtering suppliers (same as main route)
const supplierFilterSchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["name", "contactPerson", "email", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/stores/[id]/suppliers/export
 * Export suppliers to CSV format
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
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const filters = supplierFilterSchema.parse(filterParams);

    // Get CSV data from service
    const csv = await supplierService.exportSuppliers(storeId, filters);

    // Return CSV file using utility
    return createCSVResponse(csv, "suppliers-export");
  } catch (error) {
    console.error("Error exporting suppliers:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid filter parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export suppliers" },
      { status: 500 }
    );
  }
}
