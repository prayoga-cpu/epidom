import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile();
} catch (e) {
  // .env file might not exist in production env
}

// The Prisma CLI (migrate deploy, migrate dev, db push) uses datasource.url here.
// Migrations MUST run over a direct (non-pooled) connection: routed through pgBouncer
// (Neon's `-pooler` endpoint) the session-level migration advisory lock leaks onto a
// recycled backend and permanently blocks every future `migrate deploy` (P1002 timeout).
// Prefer DIRECT_URL; otherwise derive the direct endpoint from a pooled Neon DATABASE_URL
// by dropping the `-pooler` host suffix — so this stays correct even if DIRECT_URL is unset
// in the deploy environment. The runtime client keeps using the pooled DATABASE_URL.
function migrationUrl(): string | undefined {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const db = process.env.DATABASE_URL;
  if (db && db.includes("-pooler")) return db.replace("-pooler", "");
  return db;
}

export default defineConfig({
  datasource: {
    url: migrationUrl(),
  },
});
