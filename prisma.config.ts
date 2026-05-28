import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate deploy, migrate dev, db push) uses datasource.url here.
// In production this points to the direct (non-pooled) Neon endpoint so migrations
// are not routed through pgBouncer, which disables the prepared statements Prisma needs.
// The runtime Prisma client always uses DATABASE_URL from schema.prisma (pooled endpoint).
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
