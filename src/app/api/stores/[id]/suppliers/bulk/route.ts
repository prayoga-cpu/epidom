import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { z } from "zod";

/**
 * DELETE /api/stores/[id]/suppliers/bulk
 * Bulk delete suppliers (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete suppliers via service
    const result = await supplierService.bulkDeleteSuppliers(validatedData.ids, storeId);

    return NextResponse.json(
      {
        message: "Suppliers deleted successfully",
        deletedCount: result.deletedCount
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error bulk deleting suppliers:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("do not belong")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete suppliers" },
      { status: 500 }
    );
  }
}
