import { Client } from "pg";
import { to as copyTo } from "pg-copy-streams";
import { createGzip } from "node:zlib";
import { Upload } from "@aws-sdk/lib-storage";
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type _Object as S3Object,
} from "@aws-sdk/client-s3";
import { getR2Client, r2Bucket, isR2Configured } from "./r2-client";

/** Tables that are schema/tooling metadata, not application data — excluded so a
 *  restore never overwrites the target DB's own (correct, freshly-migrated) history. */
const EXCLUDED_TABLES = new Set(["_prisma_migrations"]);

const RETENTION_DAYS = 90;

/** Mirrors prisma.config.ts's migrationUrl() — CLI config isn't importable at
 *  runtime, so this small piece of logic is intentionally duplicated. Migrations
 *  (and this bulk export) must run over the direct, non-pooled connection. */
function directConnectionString(): string {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const db = process.env.DATABASE_URL;
  if (db?.includes("-pooler")) return db.replace("-pooler", "");
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}

interface TableInfo {
  name: string;
  rowEstimate: number;
}

async function discoverTables(client: Client): Promise<TableInfo[]> {
  const { rows } = await client.query<{ table_name: string; row_estimate: string }>(`
    SELECT relname AS table_name, n_live_tup AS row_estimate
    FROM pg_catalog.pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname
  `);
  return rows
    .filter((r) => !EXCLUDED_TABLES.has(r.table_name))
    .map((r) => ({ name: r.table_name, rowEstimate: Number(r.row_estimate) }));
}

/** Streams one table straight from Postgres through gzip into R2 — no local disk,
 *  no buffering the whole table in memory. Returns compressed bytes written. */
async function exportTableToR2(client: Client, table: string, keyPrefix: string): Promise<number> {
  const copyStream = client.query(copyTo(`COPY "${table}" TO STDOUT WITH CSV HEADER`));
  const gz = copyStream.pipe(createGzip());
  // .pipe() doesn't forward errors — without this, a COPY failure would leave
  // the gzip stream (and therefore the upload) hanging instead of rejecting.
  copyStream.on("error", (err) => gz.destroy(err));

  const upload = new Upload({
    client: getR2Client(),
    params: {
      Bucket: r2Bucket(),
      Key: `${keyPrefix}/${table}.csv.gz`,
      Body: gz,
      ContentType: "application/gzip",
    },
  });

  let bytes = 0;
  upload.on("httpUploadProgress", (p) => {
    if (typeof p.loaded === "number") bytes = p.loaded;
  });
  await upload.done();
  return bytes;
}

export interface ExportSummary {
  tableCount: number;
  totalRows: number;
  totalBytes: number;
  datePrefix: string;
}

/**
 * Exports every application table (data only — schema is reproducible from
 * `prisma/migrations/` in git) to `backups/<date>/<table>.csv.gz` in R2.
 * Table discovery and each table's export run over their own short-lived
 * connection so this is safe to call one table at a time from an Inngest step.
 */
export async function listBackupTables(): Promise<TableInfo[]> {
  const client = new Client({ connectionString: directConnectionString() });
  await client.connect();
  try {
    return await discoverTables(client);
  } finally {
    await client.end();
  }
}

export async function exportOneTable(table: string, datePrefix: string): Promise<number> {
  const client = new Client({ connectionString: directConnectionString() });
  await client.connect();
  try {
    return await exportTableToR2(client, table, `backups/${datePrefix}`);
  } finally {
    await client.end();
  }
}

export function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Deletes backup objects older than the retention window. */
export async function pruneOldBackups(): Promise<{ deletedObjects: number }> {
  if (!isR2Configured()) return { deletedObjects: 0 };

  const client = getR2Client();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deletedObjects = 0;
  let continuationToken: string | undefined;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: r2Bucket(),
        Prefix: "backups/",
        ContinuationToken: continuationToken,
      })
    );

    const stale = (list.Contents ?? []).filter((obj: S3Object) => {
      const dateFolder = obj.Key?.split("/")[1]; // backups/<date>/<table>.csv.gz
      if (!dateFolder) return false;
      const folderDate = new Date(dateFolder);
      return !Number.isNaN(folderDate.getTime()) && folderDate < cutoff;
    });

    if (stale.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: r2Bucket(),
          Delete: { Objects: stale.map((obj) => ({ Key: obj.Key! })) },
        })
      );
      deletedObjects += stale.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return { deletedObjects };
}
