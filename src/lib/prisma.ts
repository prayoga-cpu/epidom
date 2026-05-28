import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const SLOW_QUERY_THRESHOLD = 500;

function createPrismaClient(): PrismaClient {
  // Prisma 7 requires a driver adapter. PrismaPg uses the `pg` package under the hood
  // and handles pgBouncer-compatible pooling natively (no pgbouncer=true URL flag needed).
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const client = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

  if (process.env.NODE_ENV === "production") {
    client.$on("query", (e) => {
      if (e.duration > SLOW_QUERY_THRESHOLD) {
        logger.warn(`Slow query detected (${e.duration}ms)`, {
          duration: e.duration,
          query: e.query.substring(0, 200),
          threshold: SLOW_QUERY_THRESHOLD,
        });
      }
    });
  }

  if (process.env.NODE_ENV === "development" && process.env.LOG_QUERIES === "true") {
    client.$on("query", (e) => {
      console.log(`Query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
    });
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
