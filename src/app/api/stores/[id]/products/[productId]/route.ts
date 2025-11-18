import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validation/inventory.schemas";
import { z } from "zod";

/**
 * GET /api/stores/[id]/products/[productId]
 * Get a single product by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, productId } = await params;

    // Get product from service
    const product = await productService.getProductById(productId);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Verify product belongs to store
    if (product.storeId !== storeId) {
      return NextResponse.json({ error: "Product does not belong to this store" }, { status: 403 });
    }

    return NextResponse.json(product, { status: 200 });
  } catch (error) {

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch product" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]/products/[productId]
 * Update a product
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, productId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = updateProductSchema.parse(body);

    // Update product via service
    const product = await productService.updateProduct(productId, storeId, {
      sku: validatedData.sku,
      name: validatedData.name,
      description: validatedData.description,
      category: validatedData.category,
      costPrice:
        validatedData.costPrice !== undefined ? Number(validatedData.costPrice) : undefined,
      sellingPrice:
        validatedData.sellingPrice !== undefined ? Number(validatedData.sellingPrice) : undefined,
      currentStock:
        validatedData.currentStock !== undefined ? Number(validatedData.currentStock) : undefined,
      unit: validatedData.unit,
      minStock: validatedData.minStock !== undefined ? Number(validatedData.minStock) : undefined,
      maxStock: validatedData.maxStock !== undefined ? Number(validatedData.maxStock) : undefined,
      recipeIds: validatedData.recipeIds,
      productionTime: validatedData.productionTime,
      shelfLife: validatedData.shelfLife,
      isActive: validatedData.isActive,
    });

    return NextResponse.json(product, { status: 200 });
  } catch (error) {

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
      { error: error instanceof Error ? error.message : "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/products/[productId]
 * Delete a product (hard delete)
 * Note: Related records (OrderItem, ProductionBatch, StockMovement) will be cascade deleted
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, productId } = await params;

    // Delete product via service
    await productService.deleteProduct(productId, storeId);

    return NextResponse.json({ message: "Product deleted successfully" }, { status: 200 });
  } catch (error) {

    if (error instanceof Error) {
      if (error.message.includes("does not belong")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete product" },
      { status: 500 }
    );
  }
}
