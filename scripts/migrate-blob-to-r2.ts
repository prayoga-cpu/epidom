/**
 * Migrate Vercel Blob upload URLs to Cloudflare R2 media bucket URLs.
 *
 * Finds every row in the 7 image-URL columns that still points at
 * *.public.blob.vercel-storage.com, downloads the file, re-uploads it to R2,
 * and patches the DB row.
 *
 * Usage:
 *   # Preview what would change (default — nothing written):
 *   npx tsx scripts/migrate-blob-to-r2.ts
 *
 *   # Apply changes:
 *   npx tsx scripts/migrate-blob-to-r2.ts --apply
 *
 * A CSV rollback map is written to ./migrate-blob-to-r2-rollback.csv so every
 * rewrite is reversible. The script is idempotent: rows already pointing at
 * media.epidom.fr are skipped.
 *
 * Required environment variables:
 *   DATABASE_URL (or DIRECT_URL)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_MEDIA_BUCKET, R2_MEDIA_PUBLIC_URL
 */

import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "fs";
import { writeFile } from "fs/promises";
import path from "path";

const DRY_RUN = !process.argv.includes("--apply");

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/** All 7 URL columns across 7 tables */
const URL_COLUMNS = [
  { table: "user", column: "image", idColumn: "id" },
  { table: "business", column: "logo", idColumn: "id" },
  { table: "store", column: "image", idColumn: "id" },
  { table: "feedback", column: "screenshotUrl", idColumn: "id" },
  { table: "schedule_image", column: "imageUrl", idColumn: "id" },
  { table: "menu_item", column: "imageUrl", idColumn: "id" },
  { table: "storefront", column: "logoUrl", idColumn: "id" },
] as const;

interface RollbackRow {
  table: string;
  column: string;
  id: string;
  oldUrl: string;
  newUrl: string;
}

function isBlobUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function isR2Url(url: string | null): boolean {
  if (!url) return false;
  const publicUrl = process.env.R2_MEDIA_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicUrl) return false;
  return url.startsWith(publicUrl);
}

function buildR2Key(blobUrl: string, table: string, column: string): string {
  const parsed = new URL(blobUrl);
  // Keep the original path so the key is stable and idempotent
  const name = parsed.pathname.replace(/^\/+/, "") || `${table}/${column}/${Date.now()}`;
  return `migrations/${name}`;
}

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getR2PublicUrl(key: string): string {
  const base = process.env.R2_MEDIA_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${key}`;
}

async function downloadBlob(url: string): Promise<{ data: Uint8Array; contentType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const data = new Uint8Array(await res.arrayBuffer());
  return { data, contentType };
}

async function uploadToR2(
  client: S3Client,
  key: string,
  data: Uint8Array,
  contentType: string
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_MEDIA_BUCKET!,
      Key: key,
      Body: data,
      ContentType: contentType,
      ContentLength: data.byteLength,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

async function main() {
  const missingEnvs = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_MEDIA_BUCKET",
    "R2_MEDIA_PUBLIC_URL",
  ].filter((k) => !process.env[k]);

  if (missingEnvs.length) {
    console.error(`Missing env vars: ${missingEnvs.join(", ")}`);
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN (pass --apply to write)" : "APPLY"}`);

  const prisma = new PrismaClient();
  const r2 = getR2Client();
  const rollback: RollbackRow[] = [];
  let scanned = 0;
  let skipped = 0;
  let migrated = 0;
  let errors = 0;

  try {
    for (const { table, column, idColumn } of URL_COLUMNS) {
      // Quote column names — only tables are snake_case in this schema
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
        `SELECT "${idColumn}", "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL`
      );

      for (const row of rows) {
        const id = row[idColumn];
        const url = row[column];
        scanned++;

        if (!isBlobUrl(url)) {
          skipped++;
          continue;
        }

        if (isR2Url(url)) {
          skipped++;
          continue;
        }

        const key = buildR2Key(url, table, column);
        const newUrl = getR2PublicUrl(key);

        console.log(`  [${table}.${column}] id=${id}\n    ${url}\n  → ${newUrl}`);

        if (!DRY_RUN) {
          try {
            const { data, contentType } = await downloadBlob(url);
            await uploadToR2(r2, key, data, contentType);
            await prisma.$executeRawUnsafe(
              `UPDATE "${table}" SET "${column}" = $1 WHERE "${idColumn}" = $2`,
              newUrl,
              id
            );
            rollback.push({ table, column, id, oldUrl: url, newUrl });
            migrated++;
          } catch (err) {
            console.error(`  ERROR migrating ${table}.${column} id=${id}:`, err);
            errors++;
          }
        } else {
          rollback.push({ table, column, id, oldUrl: url, newUrl });
          migrated++;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `\nDone. Scanned: ${scanned}, Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`
  );

  if (rollback.length > 0) {
    const csv = [
      "table,column,id,oldUrl,newUrl",
      ...rollback.map(
        (r) =>
          `${r.table},${r.column},${JSON.stringify(r.id)},${JSON.stringify(r.oldUrl)},${JSON.stringify(r.newUrl)}`
      ),
    ].join("\n");

    const outPath = path.join(process.cwd(), "migrate-blob-to-r2-rollback.csv");
    await writeFile(outPath, csv, "utf8");
    console.log(`Rollback map written to: ${outPath}`);
  }

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
