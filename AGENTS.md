# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Aider, Codex) working in this repo. Keep this file short and link out. Long context goes in `/docs`.

---

## 0. Navigate with graphify first (save tokens)

This repo has a prebuilt knowledge graph at `graphify-out/`. For **any** question about the codebase — "how does X work", "what calls Y", "where is Z", architecture, or data flow — query the graph **before** grepping or opening many files. It returns a small scoped subgraph, far cheaper than raw search, and it already knows the structure (3.6k nodes, 194 communities).

```bash
graphify query "<question>"      # broad context — BFS over the graph
graphify explain "<symbol>"      # plain-language explanation of one node + its edges
graphify path "<A>" "<B>"        # shortest relationship path between two concepts
```

- Read `graphify-out/GRAPH_REPORT.md` for the architecture overview (god nodes = core abstractions like `useI18n()`, `cn()`, `getSession()`; community map).
- After changing code, run `graphify update .` to keep the graph current (AST-only, no API cost). A post-commit hook does this automatically.
- Fall back to reading source directly only when the graph doesn't surface enough.

---

## 1. What Epidom is, in one paragraph

Epidom is a free, all-in-one operating system for small Indonesian food & beverage businesses (warung, café, restaurant, cookie bar, home kitchen). The wedge is a customizable public storefront page (replaces Linktree + Google Drive menu + WhatsApp ordering). The ladder upsells to POS, operations (shift, KDS, inventory), and finance reports. **We do not compete with full POS suites head-on. We coexist with existing tools and replace them gradually.**

Full strategic context: see `/docs/STRATEGY.md`.

---

## 2. Project status

| Dimension            | Current state                                                       |
| -------------------- | ------------------------------------------------------------------- |
| Phase                | **Phase 5, Aggregator + Finance**                                   |
| Primary market       | Indonesia (primary), France/Worldwide (secondary)                   |
| Primary language     | `id`, then `en`. `fr` is deprecated, do not add new French strings. |
| Active strategic doc | `/docs/roadmap.md` (Phase 5 section)                                |
| Next phase           | None — Phase 5 is the final planned phase.                          |

If a task is not aligned with Phase 5, ask the operator before proceeding.

---

## 3. Stack at a glance

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Database**: PostgreSQL + Prisma ORM v6
- **Auth**: Better Auth (email/password + Google OAuth)
- **UI**: shadcn/ui (New York), Tailwind CSS 4, Radix, Lucide
- **State**: TanStack Query v5
- **Forms**: react-hook-form + Zod
- **Payments**:
  - **Stripe** for SaaS subscription billing (restaurants paying Epidom) AND as an option for end-customer payments (Worldwide)
  - **Xendit** for end-customer payments (Indonesia via QRIS, GoPay, OVO, DANA)
- **Notifications**: Fonnte for WhatsApp v1, migrating to WhatsApp Business API later
- **Background jobs**: Inngest (introduced in Phase 2)
- **Email**: Resend
- **Storage**: Vercel Blob, migrating to Cloudflare R2 in Phase 3+

---

## 4. Commands you can run

```bash
pnpm dev              # start dev server with Turbopack
pnpm build            # production build
pnpm lint             # ESLint
pnpm type-check       # tsc --noEmit
pnpm test             # Vitest, run once
pnpm test:watch       # Vitest watch mode

pnpm prisma migrate dev --name describe_change  # create + apply migration
pnpm prisma studio                              # DB GUI
pnpm prisma generate                            # regen client after schema edit
```

Always run `pnpm type-check && pnpm lint` before committing.

---

## 5. Directory map

```
src/
├── app/
│   ├── (app)/         # authenticated app surface
│   ├── (marketing)/   # public marketing site
│   ├── (public)/      # [Phase 1] public storefronts at /@slug
│   └── api/
├── features/          # FDA: one folder per feature, contains its own components/hooks
├── components/        # SHARED UI only (shadcn primitives, providers)
├── lib/               # core logic (auth, prisma, services, validation)
├── locales/           # id.ts (primary), en.ts. fr.ts is deprecated.
└── types/
prisma/
└── schema.prisma
docs/                  # READ THIS for context before non-trivial work
```

---

## 6. Coding rules (non-negotiable)

**Architecture**

- Pages stay thin. `page.tsx` fetches data on the server and imports a feature root component.
- Domain components live under `src/features/<feature>/`, not in `src/components/`.
- `src/components/ui/` is for generic shadcn primitives only.

**Database**

- All data queries scope to `storeId`. Never write a query that crosses tenants.
- Use Prisma `Decimal` for money and quantities, never `Float`.
- New tables get `@@map("snake_case_table_name")`.
- Every schema change goes through a migration. Never use `db push` against any branch other than your local.

**Validation**

- All API inputs validated with Zod schemas from `src/lib/validation/`.
- Use `react-hook-form` + `zodResolver` for forms. Legacy `FormData` flows are being phased out, don't add new ones.

**Auth**

- Server: `await getSession()` from `src/lib/auth.ts`
- Client: `useUser()` from `src/lib/auth-client.ts`
- Plan-gated routes use `await requirePlan(storeId, "OPERATIONS")` in their layout (added in Phase 4).

**Styling**

- Tailwind utility classes only. No inline styles, no CSS modules.
- Colors come from CSS variables, not raw hex.
- **All UI must be fully responsive for both mobile and desktop.** Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) starting from the smallest breakpoint and scaling up. Every component, page, table, dialog, and form must render correctly from 375 px (mobile) through 1920 px (desktop).
- Write mobile-first: the base (no prefix) class covers mobile, then override at larger breakpoints. Never write desktop-first or unguarded fixed widths that break on mobile.
- Data tables are wide by nature — wrap them in `-mx-4 overflow-x-auto sm:mx-0` and give the inner container `min-w-[Xpx]` so they scroll horizontally rather than overflow.
- Tab bars with multiple items must handle narrow viewports: use `overflow-x-auto` on the `TabsList`, or collapse into a 2-column grid at mobile (see management-client.tsx for the pattern).
- Most Indonesian merchants open the dashboard on Android phones; the storefront is also primarily accessed on mobile. Desktop usability for managers on larger screens is equally important — test both before marking a task done.

**i18n**

- Every user-facing string goes through `useI18n()`.
- Add the string to `src/locales/id.ts` and `src/locales/en.ts`. Do not add to `fr.ts`.

**Changelog & versioning**

- Every user-facing change MUST add an entry to `CHANGELOG.md` under a new or the most-recent version header, formatted `## [x.y.z] - YYYY-MM-DD · tag`, where `tag` ∈ `feat | fix | infra | ux`.
- Bump the version in `package.json` AND `src/lib/version.ts` (`APP_VERSION`) so both match that header.
- The build syncs `CHANGELOG.md` → the `Release` table automatically via `scripts/sync-changelog.ts`; never edit that table by hand.

**Graceful Degradation (Dummy Data)**

- If an environment/setup has not been implemented by the operator (e.g., missing API keys), keep the feature working gracefully by using state/static/dummy data.
- Document any use of dummy features in `STATUS.md`.

---

## 7. Things you must not do

1. Do not reintroduce cookie-bar-only language in marketing copy.
2. Do not add new French (`fr`) strings.
3. Do not delete code in `src/app/(app)/store/[storeId]/(dashboard)/{management,data,tracking,alerts}/`. These are paused, not abandoned. They return in Phase 4.
4. Do not couple the public storefront to internal inventory. `MenuItem.productId` is optional on purpose.
5. Do not put Stripe and Xendit logic in the same module. They serve different flows (SaaS billing vs customer payments).
6. Do not commit any `.env*` file other than `.env.example`.
7. Do not introduce maps libraries (`leaflet`, `maplibre-gl`). These were removed in Phase 0.
8. Do not skip writing a Zod schema for a new API input.

---

## 8. When you finish a task

- Run `pnpm type-check && pnpm lint`. Fix anything they flag.
- Add or update tests for the changed surface. Critical paths must have coverage.
- Write a one-paragraph PR description that includes: what changed, why, what to test manually.
- If you touched the schema, commit the migration file alongside.
- **Update the phase checklist in `STATUS.md`**.
- If any outside-codebase tasks are required (e.g., setting up an env var, updating Stripe), add them to the "Developer / Operator To-Do" list in `STATUS.md`.

---

## 9. Where to find more

| You need to understand...                       | Read                       |
| ----------------------------------------------- | -------------------------- |
| Why we pivoted, target market, competitors      | `/docs/STRATEGY.md`        |
| Phase plan, dependencies between phases         | `/docs/roadmap.md`         |
| What to do this week                            | `/docs/PHASE_0_CLEANUP.md` |
| Architecture decisions, route groups, providers | `/docs/ARCHITECTURE.md`    |
| Tier-by-tier feature list                       | `/docs/FEATURES.md`        |
| Pricing tiers, Stripe products                  | `/docs/BILLING.md`         |
| Env variables and required services             | `/docs/ENVIRONMENT.md`     |
| Schema, models, migrations                      | `/docs/DATABASE.md`        |

If a doc and this file disagree, this file wins. Flag the inconsistency to the operator.
