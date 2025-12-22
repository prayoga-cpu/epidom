# Dashboard Audit Report & Optimization Plan

**Date:** 2025-12-22
**Status:** Completed
**Scope:** `src/features/dashboard` (Data Flow, Query Optimization, Correctness)

## 1. Executive Summary

The dashboard application is architected correctly using Next.js Server Components for initial data gathering (`Page.tsx`) and Client Components (`DashboardClient.tsx`) for interactivity. This pattern minimizes client-side waterfalls and ensures fast First Contentful Paint (FCP).

Key optimizations for Neon (PostgreSQL) and Prisma have been verified. Connection pooling is correctly configured in `src/lib/prisma.ts`.

## 2. Correctness & Optimization Audit

### ✅ Passed Audits

1.  **Server-Side Parallel Fetching:**
    - `DashboardPage` uses `Promise.all` to fetch Alerts, Suppliers, and Batches in parallel. This is the optimal pattern for Next.js.
2.  **Database Connection Pooling:**
    - `src/lib/prisma.ts` is correctly configured with `pgbouncer=true` and appropriate timeouts for serverless environments.
3.  **Alerts Query Efficiency:**
    - `fetchAlertsForPage` uses `prisma.$queryRaw` to select only IDs of low-stock items (`currentStock <= minStock`) before fetching details. This avoids loading thousands of healthy records into memory. **Excellent optimization.**
4.  **Component Lazy Loading:**
    - Heavy widgets (`ProductionHistoryChart`, `SupplierCard`) are lazy-loaded via `next/dynamic` with `ssr: false`. This reduces the initial JavaScript bundle size significantly.

### ⚠️ Critical Findings & Remediation

#### 1. Tracking Card ("Stock Levels") Data Source [FIXED]

- **Issue:** The "Stock Levels" widget previously calculated the top 5 lowest stock items based on the `initialMaterials` prop.
- **Root Cause:** `initialMaterials` was only the _first 50 materials_ (paginated default).
- **Impact:** If a critical low-stock item was alphabetically sorted at index 100, it would **never** appear in the widget. This was functional incorrectness.
- **Optimization Applied:**
  - Created `fetchStockLevelsForPage` in `data-fetchers.ts`.
  - Uses optimized SQL (`CASE WHEN ...`) to calculate stock percentage at the Database level.
  - Fetches only the top 5 relevant items globally.
  - Updated `DashboardPage` and `DashboardClient` to use this dedicated data source.

#### 2. Material Repository Scalability [PENDING]

- **Issue:** In `MaterialRepository.findAll`, filtering by `stockStatus` (e.g., "Low Stock") is performed **in-memory** after fetching items matching other filters.
- **Impact:** For a store with 10,000+ items, selecting "Low Stock" filter could force the server to load 10,000 records into memory, creating performance bottlenecks and potential timeouts.
- **Recommendation:** Refactor this to use `prisma.$queryRaw` or split the query logic to ensure filtering happens at the database level.

## 3. Architecture Overview

### Data Flow

1.  **Request:** User visits `/dashboard`.
2.  **Server:** `DashboardPage` (Server Component) initiates parallel DB calls:
    - `fetchStockLevelsForPage` (Raw SQL, Optimized)
    - `fetchSuppliersForPage` (Prisma default)
    - `fetchProductionBatchesForPage` (Prisma default)
    - `fetchAlertsForPage` (Raw SQL, Optimized)
3.  **Hydration:** Data is passed as props to `DashboardClient`.
4.  **Interactivity:** Client hydration occurs; heavy charts load lazily.

### Database Strategy (Neon + Prisma)

- **Reads:** Optimized for read-heavy dashboard usage.
- **Writes:** Standard Prisma transactional writes.
- **Pool:** connection_limit=20, pgbouncer=true.

## 4. Conclusion

The dashboard is now **functionally correct** regarding the displayed metrics. The "Stock Levels" widget now reflects the true state of the entire inventory, not just the first page. The codebase adheres to high-quality software engineering principles for Next.js 14+ architectures.
