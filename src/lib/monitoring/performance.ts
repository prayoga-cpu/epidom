/**
 * Performance Monitoring Utility
 *
 * Tracks and logs performance metrics for:
 * - API response times
 * - Database query times
 * - Component render times
 * - Web Vitals
 */

import { logger } from "@/lib/logger";

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Track API response time
 */
export function trackApiResponseTime(
  endpoint: string,
  method: string,
  duration: number,
  statusCode?: number
): void {
  const metric: PerformanceMetric = {
    name: "api_response_time",
    duration,
    timestamp: Date.now(),
    metadata: {
      endpoint,
      method,
      statusCode,
    },
  };

  logger.info("API Performance Metric", metric as unknown as Record<string, unknown>);

  // In production, send to analytics service
  if (process.env.NODE_ENV === "production") {
    // Example: analytics.track("api_response_time", metric);
  }
}

/**
 * Track database query time
 */
export function trackDatabaseQueryTime(
  query: string,
  duration: number,
  table?: string
): void {
  const metric: PerformanceMetric = {
    name: "database_query_time",
    duration,
    timestamp: Date.now(),
    metadata: {
      query: query.substring(0, 100), // Truncate long queries
      table,
    },
  };

  // Only log slow queries (> 1 second)
  if (duration > 1000) {
    logger.warn("Slow Database Query", metric as unknown as Record<string, unknown>);
  }

  // In production, send to analytics service
  if (process.env.NODE_ENV === "production") {
    // Example: analytics.track("database_query_time", metric);
  }
}

/**
 * Track component render time
 */
export function trackComponentRenderTime(
  componentName: string,
  duration: number
): void {
  const metric: PerformanceMetric = {
    name: "component_render_time",
    duration,
    timestamp: Date.now(),
    metadata: {
      componentName,
    },
  };

  // Only log slow renders (> 100ms)
  if (duration > 100) {
    logger.warn("Slow Component Render", metric as unknown as Record<string, unknown>);
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private metadata?: Record<string, unknown>;

  constructor(name: string, metadata?: Record<string, unknown>) {
    this.name = name;
    this.metadata = metadata;
    this.startTime = performance.now();
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    const metric: PerformanceMetric = {
      name: this.name,
      duration,
      timestamp: Date.now(),
      metadata: this.metadata,
    };

    logger.debug("Performance Timer", metric as unknown as Record<string, unknown>);
    return duration;
  }
}

/**
 * Create a performance timer
 */
export function createTimer(name: string, metadata?: Record<string, unknown>): PerformanceTimer {
  return new PerformanceTimer(name, metadata);
}

