/**
 * @file api/stores/[id]/stock/import/route.ts
 * @description Stock Import API
 * Handles bulk import of stock levels via CSV file.
 */

import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { importService } from "@/lib/services/import.service";



/**
 * POST /api/stores/[id]/stock/import
 * Implements bulk update of stock levels from a CSV file.
 *
 * Flow:
 * 1. Validate Store Auth
 * 2. Parse CSV
 * 3. Iterate rows and update stock
 * 4. Return summary of success/failures
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "CSV file is required"),
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "File must be a CSV file"),
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();
    
    // Process import using ImportService
    try {
      const result = await importService.importStock(storeId!, csvContent);
      return NextResponse.json(createSuccessResponse(result));
    } catch (error: any) {
      if (error.message === "CSV file is empty") {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "CSV file is empty"),
          { status: 400 }
        );
      }
      throw error;
    }
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/stock/import",
    requireStoreAuth: true,
  }
);
