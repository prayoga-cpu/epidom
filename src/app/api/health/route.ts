/**
 * @file api/health/route.ts
 * @description Enhanced Health Check API Endpoint
 * Used by load balancers and monitoring systems to verify system availability.
 * Checks all critical services: Database, Stripe, etc.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { REACHABILITY_HEADER } from "@/lib/pwa/reachability";

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
 * HEAD /api/health
 *
 * Connectivity probe target for the PWA reachability monitor
 * (`src/lib/pwa/reachability.ts`), hit roughly once a second per visible tab
 * while a device is online. It deliberately does NOT share the GET handler's
 * work: when a route exports GET but not HEAD, Next.js auto-implements HEAD
 * by running GET and discarding the body (see
 * `next/dist/server/route-modules/app-route/helpers/auto-implement-methods`),
 * which would put a `SELECT 1` on Neon for every probe from every tablet in
 * every store. Declaring HEAD explicitly overrides that with a body-less 204
 * that touches nothing.
 *
 * The `x-epidom-reachable` header is the actual payload. A captive portal
 * answers any request with its own 200 login page, so the client treats
 * "reachable" as "the reply carries a header only this route emits" rather
 * than "the fetch resolved" — otherwise a café portal would read as a
 * healthy server and the app would sync against it.
 *
 * @returns {NextResponse} 204 No Content, never cached
 */
export function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      [REACHABILITY_HEADER]: "1",
      // Must never be served from a cache — a cached 204 would make an
      // offline device look permanently online.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
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
