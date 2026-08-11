/**
 * Restore a nightly backup (see src/lib/backup/, docs/BACKUP_RESTORE.md) into a
 * target database. Deliberately a CLI script, not a web-triggerable admin
 * action — the blast radius of an accidental prod overwrite is too high for a
 * button behind session auth.
 *
 * Target is meant to be a FRESH, EMPTY database, already `prisma migrate
 * deploy`'d (schema comes from git, not from the backup) — never point this at
 * a database with real data you care about. Verify the restored data, then
 * promote/cut over manually.
 *
 * Usage:
 *   pnpm tsx scripts/restore-from-backup.ts --date=2026-08-10 --target=postgresql://...
 *   (or set RESTORE_DATABASE_URL instead of --target)
 */
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { createGunzip } from "node:zlib";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getR2Client, r2Bucket, isR2Configured } from "@/lib/backup/r2-client";
import {
  databaseIdentity,
  directDatabaseUrl,
  normalizeSslMode,
} from "@/lib/db/connection-string";

function parseArgs(): { date: string; target: string } {
  const args = new Map(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [key, ...rest] = a.slice(2).split("=");
        return [key, rest.join("=")] as const;
      })
  );

  const date = args.get("date");
  const target = args.get("target") || process.env.RESTORE_DATABASE_URL;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Missing/invalid --date=YYYY-MM-DD");
  }
  if (!target) {
    throw new Error("Missing --target=<connection-string> (or set RESTORE_DATABASE_URL)");
  }

  // Refuse anything that looks like this app's own live database — restore
  // must always go into a separate, disposable target you verify before promoting.
  // Compared on host+database rather than the raw string: differing credentials,
  // query-param order or sslmode spelling must not let the live DB slip past this.
  const liveUrls = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    directDatabaseUrl(),
  ].filter((u): u is string => Boolean(u));
  const targetIdentity = databaseIdentity(target);
  const isLive = liveUrls.some((u) =>
    targetIdentity ? databaseIdentity(u) === targetIdentity : u === target
  );
  if (isLive) {
    throw new Error(
      "Refusing to restore into DATABASE_URL/DIRECT_URL — point --target at a separate, fresh database."
    );
  }

  return { date, target: normalizeSslMode(target) };
}

async function assertSchemaExists(client: Client): Promise<void> {
  const { rows } = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'backup_runs'
  `);
  if (rows[0]?.count === "0") {
    throw new Error(
      "Target database has no schema yet. Run `pnpm prisma migrate deploy` against --target first."
    );
  }
}

async function restoreTable(client: Client, key: string, table: string): Promise<number | null> {
  const s3 = getR2Client();
  const obj = await s3.send(new GetObjectCommand({ Bucket: r2Bucket(), Key: key }));
  const body = obj.Body;
  if (!body || !("pipe" in body)) {
    throw new Error(`Unexpected R2 response body for ${key}`);
  }

  const copyStream = client.query(copyFrom(`COPY "${table}" FROM STDIN WITH CSV HEADER`));
  const gunzip = createGunzip();
  (body as NodeJS.ReadableStream).pipe(gunzip).on("error", (err) => copyStream.destroy(err));
  gunzip.pipe(copyStream);

  await new Promise<void>((resolve, reject) => {
    copyStream.on("finish", resolve);
    copyStream.on("error", reject);
  });

  return copyStream.rowCount ?? null;
}

async function main() {
  if (!isR2Configured()) {
    throw new Error("R2 env vars not set (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME)");
  }
  const { date, target } = parseArgs();

  const s3 = getR2Client();
  const prefix = `backups/${date}/`;
  const list = await s3.send(new ListObjectsV2Command({ Bucket: r2Bucket(), Prefix: prefix }));
  const objects = (list.Contents ?? []).filter((o) => o.Key?.endsWith(".csv.gz"));

  if (objects.length === 0) {
    throw new Error(`No backup files found under ${prefix} in bucket ${r2Bucket()}`);
  }

  console.log(`Found ${objects.length} table dump(s) for ${date}. Connecting to target...`);

  const client = new Client({ connectionString: target });
  await client.connect();

  try {
    await assertSchemaExists(client);

    // Disables FK/trigger checks for the session — the same mechanism pg_dump's
    // data-only restore relies on — so tables can be restored in any order.
    await client.query("SET session_replication_role = replica");

    let restored = 0;
    for (const obj of objects) {
      const key = obj.Key!;
      const table = key.slice(prefix.length).replace(/\.csv\.gz$/, "");
      process.stdout.write(`  Restoring ${table}... `);
      try {
        const rowCount = await restoreTable(client, key, table);
        console.log(rowCount != null ? `${rowCount} rows` : "done");
        restored++;
      } catch (err) {
        console.log(`FAILED: ${err instanceof Error ? err.message : err}`);
      }
    }

    await client.query("SET session_replication_role = origin");
    console.log(`\nRestored ${restored}/${objects.length} tables from ${date}.`);
    console.log("Next: verify row counts / spot-check data, then promote this database manually.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nRestore failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
