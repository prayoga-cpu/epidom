import { PrismaClient, Prisma } from "@prisma/client";
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
  async transaction<T>(
    callback: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      return callback(tx as PrismaClient);
    });
  }

  /**
   * Execute raw SQL query using Prisma's tagged template for automatic parameterization.
   * Use sparingly - prefer Prisma's type-safe queries.
   *
   * @example
   * await this.executeRaw(Prisma.sql`UPDATE "users" SET "name" = ${name} WHERE "id" = ${id}`);
   */
  async executeRaw(query: Prisma.Sql): Promise<number> {
    return this.db.$executeRaw(query);
  }

  /**
   * Execute raw SQL query and return results using Prisma's tagged template
   * for automatic parameterization. Use sparingly - prefer Prisma's type-safe queries.
   *
   * @example
   * const users = await this.queryRaw<User[]>(Prisma.sql`SELECT * FROM "users" WHERE "id" = ${id}`);
   */
  async queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> {
    return this.db.$queryRaw<T>(query);
  }
}
