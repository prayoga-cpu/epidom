/**
 * @file api/health/route.ts
 * @description Health Check API Endpoint
 * Used by load balancers and monitoring systems to verify system availability.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/health
 *
 * Checks connectivity to critical services (Database).
 *
 * @returns {Promise<NextResponse>} Standardized JSON response
 * - 200 OK: System operational
 * - 503 Service Unavailable: Critical dependency failed
 */
export async function GET() {
  try {
    // Check database connection by running a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      createSuccessResponse({
        status: "ok",
        services: {
          database: "connected",
        },
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      })
    );
  } catch (error) {
    console.error("[Health Check] Failed:", error);

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "System unhealthy: Database connection failed",
        {
          timestamp: new Date().toISOString(),
        }
      ),
      { status: 503 }
    );
  }
}
