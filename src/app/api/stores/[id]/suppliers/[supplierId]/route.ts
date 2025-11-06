import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supplierService } from "@/lib/services/supplier.service";
import { updateSupplierSchema } from "@/lib/validation/inventory.schemas";
import { z } from "zod";

/**
 * GET /api/stores/[id]/suppliers/[supplierId]
 * Get a single supplier by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, supplierId } = await params;

    // Get supplier from service
    const supplier = await supplierService.getSupplierById(supplierId);

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Verify supplier belongs to store
    if (supplier.storeId !== storeId) {
      return NextResponse.json({ error: "Supplier does not belong to this store" }, { status: 403 });
    }

    return NextResponse.json(supplier, { status: 200 });
  } catch (error) {
    console.error("Error fetching supplier:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch supplier" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]/suppliers/[supplierId]
 * Update a supplier
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, supplierId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = updateSupplierSchema.parse(body);

    // Update supplier via service
    const supplier = await supplierService.updateSupplier(supplierId, storeId, {
      name: validatedData.name,
      contactPerson: validatedData.contactPerson,
      email: validatedData.email,
      phone: validatedData.phone,
      address: validatedData.address,
      city: validatedData.city,
      country: validatedData.country,
      notes: validatedData.notes,
      isActive: validatedData.isActive,
    });

    return NextResponse.json(supplier, { status: 200 });
  } catch (error) {
    console.error("Error updating supplier:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific business logic errors
      if (error.message.includes("does not belong")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update supplier" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/suppliers/[supplierId]
 * Delete a supplier (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, supplierId } = await params;

    // Delete supplier via service
    await supplierService.deleteSupplier(supplierId, storeId);

    return NextResponse.json({ message: "Supplier deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting supplier:", error);

    if (error instanceof Error) {
      if (error.message.includes("does not belong")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete supplier" },
      { status: 500 }
    );
  }
}
