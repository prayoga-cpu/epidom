import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Base Repository
 *
 * Provides common database operations and implements
 * the Dependency Inversion Principle by abstracting
 * Prisma interactions.
 *
 * All specific repositories should extend this class.
 */
export abstract class BaseRepository {
  protected readonly db: PrismaClient;

  constructor(dbClient?: PrismaClient) {
    this.db = dbClient ?? prisma;
  }

  /**
   * Begin a database transaction
   *
   * @example
   * const result = await repository.transaction(async (tx) => {
   *   await tx.user.create({ ... });
   *   await tx.business.create({ ... });
   *   return result;
   * });
   */
  async transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(async (tx) => {
      return callback(tx as PrismaClient);
    });
  }

  /**
   * Execute raw SQL query
   * Use sparingly - prefer Prisma's type-safe queries
   */
  async executeRaw(query: string, params?: unknown[]): Promise<unknown> {
    return this.db.$executeRawUnsafe(query, ...(params ?? []));
  }

  /**
   * Execute raw SQL query and return results
   * Use sparingly - prefer Prisma's type-safe queries
   */
  async queryRaw<T = unknown>(query: string, params?: unknown[]): Promise<T> {
    return this.db.$queryRawUnsafe(query, ...(params ?? [])) as Promise<T>;
  }
}
