import { prisma } from "@/lib/prisma";

/**
 * Foreign-key graph, read from Postgres itself.
 *
 * Every other approach considered here was a hand-maintained manifest that
 * drifts the moment a migration adds a relation, and drift in this particular
 * list is only discovered under incident pressure — when a restore silently
 * omits a table.
 *
 * The runtime DMMF shipped with Prisma 7 is stripped: `relationOnDelete`,
 * `relationFromFields` and `isList` are all absent from
 * `Prisma.dmmf.datamodel`, so the cascade graph cannot be derived from it.
 * `pg_constraint` is not a substitute for that metadata — it is the actual
 * thing Postgres enforces, which makes it strictly better than either the DMMF
 * or the schema file.
 */

export type DeleteRule = "CASCADE" | "SET_NULL" | "RESTRICT" | "NO_ACTION" | "SET_DEFAULT";

export interface ForeignKey {
  constraintName: string;
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
  onDelete: DeleteRule;
}

const DELETE_RULE: Record<string, DeleteRule> = {
  a: "NO_ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET_NULL",
  d: "SET_DEFAULT",
};

interface RawFk {
  constraint_name: string;
  child_table: string;
  parent_table: string;
  confdeltype: string;
  child_cols: string[];
  parent_cols: string[];
}

let cache: ForeignKey[] | null = null;

/** All foreign keys in the public schema, with their ON DELETE rule. */
export async function loadForeignKeys(): Promise<ForeignKey[]> {
  if (cache) return cache;

  const rows = await prisma.$queryRawUnsafe<RawFk[]>(`
    SELECT
      con.conname AS constraint_name,
      src.relname AS child_table,
      tgt.relname AS parent_table,
      con.confdeltype::text AS confdeltype,
      (SELECT array_agg(att.attname::text ORDER BY x.ord)
         FROM unnest(con.conkey) WITH ORDINALITY AS x(attnum, ord)
         JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = x.attnum
      ) AS child_cols,
      (SELECT array_agg(att.attname::text ORDER BY x.ord)
         FROM unnest(con.confkey) WITH ORDINALITY AS x(attnum, ord)
         JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = x.attnum
      ) AS parent_cols
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_class tgt ON tgt.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = src.relnamespace
    WHERE con.contype = 'f' AND n.nspname = 'public'
  `);

  cache = rows.map((r) => ({
    constraintName: r.constraint_name,
    childTable: r.child_table,
    childColumns: r.child_cols,
    parentTable: r.parent_table,
    parentColumns: r.parent_cols,
    onDelete: DELETE_RULE[r.confdeltype] ?? "NO_ACTION",
  }));

  return cache;
}

/** Clear the cache. Only needed in tests and after a migration in a long process. */
export function resetForeignKeyCache(): void {
  cache = null;
}

/** Children of `table` that Postgres deletes along with it. */
export async function cascadeChildren(table: string): Promise<ForeignKey[]> {
  const fks = await loadForeignKeys();
  return fks.filter((fk) => fk.parentTable === table && fk.onDelete === "CASCADE");
}

/** Rows that survive the delete but have a pointer nulled out. */
export async function setNullChildren(table: string): Promise<ForeignKey[]> {
  const fks = await loadForeignKeys();
  return fks.filter((fk) => fk.parentTable === table && fk.onDelete === "SET_NULL");
}

/**
 * Every table reachable from `root` by CASCADE edges, in parent-first order.
 *
 * The order is what a restore replays: inserting a child before its parent
 * violates the same foreign key that defined the edge. Cycles are broken by
 * visiting each table once — the deferred-FK pass in the restorer handles the
 * back-references that creates.
 */
export async function cascadeClosure(root: string): Promise<string[]> {
  const fks = await loadForeignKeys();
  const ordered: string[] = [];
  const seen = new Set<string>();

  const queue: string[] = [root];
  seen.add(root);
  ordered.push(root);

  while (queue.length > 0) {
    const table = queue.shift()!;
    for (const fk of fks) {
      if (fk.parentTable !== table || fk.onDelete !== "CASCADE") continue;
      if (seen.has(fk.childTable)) continue;
      seen.add(fk.childTable);
      ordered.push(fk.childTable);
      queue.push(fk.childTable);
    }
  }

  return ordered;
}

/**
 * Self-referencing and cyclic FKs, which a restore must defer.
 *
 * `Product.primaryRecipeId` and `Order.shiftId` are the two known cases, but
 * they are found here rather than listed: a future migration adding a third
 * nullable back-reference would otherwise break restore only for graphs that
 * happen to contain that shape.
 */
export async function deferredForeignKeys(tables: string[]): Promise<ForeignKey[]> {
  const fks = await loadForeignKeys();
  const inScope = new Set(tables);
  const position = new Map(tables.map((t, i) => [t, i]));

  return fks.filter((fk) => {
    if (!inScope.has(fk.childTable) || !inScope.has(fk.parentTable)) return false;
    if (fk.childTable === fk.parentTable) return true;
    // A child that appears before its parent in restore order is a back-edge.
    const childPos = position.get(fk.childTable)!;
    const parentPos = position.get(fk.parentTable)!;
    return childPos < parentPos;
  });
}
