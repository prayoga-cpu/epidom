import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Helper function to add connection pool parameters to DATABASE_URL
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || "";

  // Check if URL already has query parameters
  const separator = baseUrl.includes("?") ? "&" : "?";

  // Add connection pool settings optimized for Neon
  // connection_limit: Lower limit for serverless (10 is safer than 15)
  // pool_timeout: Time in seconds to wait for a connection
  // connect_timeout: Time to establish initial connection (important for Neon)
  // pgbouncer: Set to true if using Neon's connection pooler
  return `${baseUrl}${separator}connection_limit=10&pool_timeout=20&connect_timeout=10&pgbouncer=true`;
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
