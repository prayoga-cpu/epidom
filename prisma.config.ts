import { defineConfig } from "prisma/config";
import { directDatabaseUrl } from "./src/lib/db/connection-string";

try {
  process.loadEnvFile();
} catch (e) {
  // .env file might not exist in production env
}

// The Prisma CLI (migrate deploy, migrate dev, db push) uses datasource.url here.
// Migrations MUST run over a direct (non-pooled) connection: routed through pgBouncer
// (Neon's `-pooler` endpoint) the session-level migration advisory lock leaks onto a
// recycled backend and permanently blocks every future `migrate deploy` (P1002 timeout).
// directDatabaseUrl() prefers DIRECT_URL and otherwise derives the direct endpoint from
// a pooled Neon DATABASE_URL, so this stays correct even if DIRECT_URL is unset in the
// deploy environment. The runtime client keeps using the pooled DATABASE_URL.
// Imported relatively: this file is loaded by the Prisma CLI, outside tsconfig paths.
export default defineConfig({
  datasource: {
    url: directDatabaseUrl(),
  },
});
