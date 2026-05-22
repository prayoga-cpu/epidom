import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Slow query threshold in milliseconds
const SLOW_QUERY_THRESHOLD = 500;

// Standard transaction settings for long-running operations
export const TRANSACTION_TIMEOUTS = {
  maxWait: 10000, // Maximum time to wait for transaction to start (10s)
  timeout: 20000, // Maximum time for transaction to complete (20s)
};

// Helper function to add connection pool parameters to DATABASE_URL
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || "";

  // Check if URL already has query parameters
  const separator = baseUrl.includes("?") ? "&" : "?";

  // Add connection pool settings optimized for Neon with transaction support
  // connection_limit: Increased to 20 for better concurrency under load
  // pool_timeout: Increased to 30s to accommodate longer transactions
  // connect_timeout: Time to establish initial connection (important for Neon)
  // statement_timeout: 25s max query time to prevent hung queries (5s buffer before pool timeout)
  // pgbouncer: Set to true if using Neon's connection pooler
  return `${baseUrl}${separator}connection_limit=20&pool_timeout=30&connect_timeout=10&statement_timeout=25000&pgbouncer=true`;
}

// Prisma query event type
interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

// Create Prisma client with query event logging
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

  // Log slow queries in production for monitoring
  if (process.env.NODE_ENV === "production") {
    (client.$on as (event: "query", callback: (e: PrismaQueryEvent) => void) => void)(
      "query",
      (e: PrismaQueryEvent) => {
        if (e.duration > SLOW_QUERY_THRESHOLD) {
          logger.warn(`Slow query detected (${e.duration}ms)`, {
            duration: e.duration,
            query: e.query.substring(0, 200), // Truncate for safety
            threshold: SLOW_QUERY_THRESHOLD,
          });
        }
      }
    );
  }

  // Log all queries in development (optional, can be noisy)
  if (process.env.NODE_ENV === "development" && process.env.LOG_QUERIES === "true") {
    (client.$on as (event: "query", callback: (e: PrismaQueryEvent) => void) => void)(
      "query",
      (e: PrismaQueryEvent) => {
        console.log(`Query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
      }
    );
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
