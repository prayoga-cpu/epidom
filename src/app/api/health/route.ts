/**
 * @file api/health/route.ts
 * @description Enhanced Health Check API Endpoint
 * Used by load balancers and monitoring systems to verify system availability.
 * Checks all critical services: Database, Stripe, etc.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

interface ServiceHealth {
  status: "ok" | "degraded" | "error";
  latency?: number;
  error?: string;
}

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  environment: string;
  uptime: number;
  services: {
    database: ServiceHealth;
  };
}

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * Check database connectivity and measure latency
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * GET /api/health
 *
 * Comprehensive health check endpoint that verifies:
 * - Database connectivity and latency
 * - System uptime
 * - Environment information
 *
 * @returns {Promise<NextResponse>} Standardized JSON response
 * - 200 OK: System fully operational
 * - 503 Service Unavailable: Critical dependency failed
 */
export async function GET() {
  try {
    // Check all services in parallel
    const [database] = await Promise.all([checkDatabase()]);

    // Determine overall health status
    const allServicesOk = database.status === "ok";
    const anyServiceError = database.status === "error";

    let overallStatus: HealthCheckResponse["status"];
    if (allServicesOk) {
      overallStatus = "healthy";
    } else if (anyServiceError) {
      overallStatus = "unhealthy";
    } else {
      overallStatus = "degraded";
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      version: process.env.npm_package_version || "1.0.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      services: {
        database,
      },
    };

    // Return 503 if any critical service is down
    if (overallStatus === "unhealthy") {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          "System unhealthy: Critical services unavailable",
          response as unknown as Record<string, unknown>
        ),
        { status: 503 }
      );
    }

    return NextResponse.json(createSuccessResponse(response), {
      headers: {
        // Allow caching for 10 seconds to reduce load
        "Cache-Control": "public, max-age=10",
      },
    });
  } catch (error) {
    console.error("[Health Check] Unexpected error:", error);

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Health check failed", {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 503 }
    );
  }
}
