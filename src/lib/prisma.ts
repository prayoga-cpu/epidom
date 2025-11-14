import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
