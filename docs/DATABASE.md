# Database

Prisma schema, models, migrations, and the rules every query must follow.

---

## Stack

- PostgreSQL 14+
- Prisma ORM v6.17+
- Migrations in `prisma/migrations/`
- Generator targets default Prisma Client

---

## Schema overview

```
                    ┌──────────┐
                    │   User   │
                    └─────┬────┘
                          │ 1:N
                          ▼
                    ┌──────────┐                ┌──────────────────┐
                    │ Business │                │  Subscription    │
                    └─────┬────┘                │  (1:1 with User) │
                          │ 1:N                 └──────────────────┘
                          ▼
                    ┌──────────┐
                    │  Store   │
                    └─────┬────┘
                          │
   ┌──────────────────────┼──────────────────────┐
   │ 1:1                  │ 1:N                  │ 1:N
   ▼                      ▼                      ▼
┌─────────────┐    ┌──────────────┐      ┌────────────┐
│ Storefront  │    │   Product    │      │   Order    │
│  (Phase 1)  │    │  / Material  │      │ (Phase 2)  │
└──────┬──────┘    │  (Phase 4)   │      └──────┬─────┘
       │ 1:N       └──────────────┘             │ 1:N
       ▼                                        ▼
┌─────────────┐                          ┌────────────┐
│  MenuItem   │                          │ OrderItem  │
│  (Phase 1)  │                          │ (Phase 2)  │
└─────────────┘                          └────────────┘
```

---

## The cardinal rule

**Every query scopes to `storeId`.** No exceptions.

```typescript
// ✅ Correct
await prisma.order.findMany({ where: { storeId, status: "PENDING" } });

// ❌ Forbidden, leaks across tenants
await prisma.order.findMany({ where: { status: "PENDING" } });
```

A test in `src/test/tenant-isolation.test.ts` catches accidental cross-tenant queries by inspecting Prisma logs in test mode.

The only exceptions: `User`, `Subscription`, `Business`, `Session`, `Account`, `Verification`, `ExchangeRate`. These are scoped to `User` or are global lookup tables.

---

## Money and quantities

Use `Decimal`, never `Float`.

```prisma
price       Decimal  @db.Decimal(12, 2)   // money, 2 decimals
quantity    Decimal  @db.Decimal(12, 3)   // material quantities, 3 decimals
```

Rounding rules in business logic:

- Use `Decimal.toFixed(2)` only for display
- Sum and multiply with full precision, round at the end
- Currency conversions go through `ExchangeRate` table, never hardcoded rates

---

## Core models, by phase

### Existing (pre-Phase 0)

| Model                                            | Purpose                                      |
| ------------------------------------------------ | -------------------------------------------- |
| `User`, `Session`, `Account`, `Verification`     | Better Auth tables                           |
| `Business`, `Store`                              | Tenant hierarchy                             |
| `Subscription`                                   | SaaS billing state                           |
| `Product`, `Material`, `MaterialSupplier`        | Catalog (now operations-gated)               |
| `Recipe`, `RecipeIngredient`, `RecipeProduct`    | Recipes (now operations-gated)               |
| `ProductionBatch`                                | Manufacturing batches (now enterprise-gated) |
| `StockMovement`                                  | Inventory audit log                          |
| `Supplier`, `SupplierOrder`, `SupplierOrderItem` | Supply chain                                 |
| `Order`, `OrderItem`                             | Sales (heavily extended in Phase 2)          |
| `Alert`                                          | Stock alerts                                 |
| `ExchangeRate`                                   | Currency conversion                          |
| `AIImportMemory`, `AIImportSession`              | AI-assisted CSV import                       |

### Phase 1 additions

```prisma
model Storefront {
  id              String   @id @default(cuid())
  storeId         String   @unique
  slug            String   @unique
  displayName     String
  tagline         String?
  description     String?
  logoUrl         String?
  heroImageUrl    String?
  themeColor      String   @default("#FF6B35")
  fontFamily      String   @default("Inter")

  whatsappNumber  String?
  instagramUrl    String?
  tiktokUrl       String?
  gofoodUrl       String?
  grabfoodUrl     String?
  shopeefoodUrl   String?
  googleMapsUrl   String?
  customLinks     Json?

  isPublished     Boolean  @default(false)
  acceptsOrders   Boolean  @default(false)
  openingHours    Json?
  viewCount       Int      @default(0)

  store           Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  menuCategories  MenuCategory[]
  menuItems       MenuItem[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([slug])
  @@map("storefronts")
}

model MenuCategory {
  id            String       @id @default(cuid())
  storefrontId  String
  name          String
  displayOrder  Int          @default(0)

  storefront    Storefront   @relation(fields: [storefrontId], references: [id], onDelete: Cascade)
  items         MenuItem[]

  @@map("menu_categories")
}

model MenuItem {
  id              String       @id @default(cuid())
  storefrontId    String
  categoryId      String?
  productId       String?      // optional link to Product for inventory deduction
  name            String
  description     String?
  price           Decimal      @db.Decimal(12, 2)
  currency        String       @default("IDR")
  imageUrl        String?
  isAvailable     Boolean      @default(true)
  isFeatured      Boolean      @default(false)
  displayOrder    Int          @default(0)
  modifiers       Json?        // [{name, options: [{name, priceAdd}]}]

  storefront      Storefront   @relation(fields: [storefrontId], references: [id], onDelete: Cascade)
  category        MenuCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  product         Product?     @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([storefrontId])
  @@map("menu_items")
}
```

### Phase 2 extensions

Adds to existing `Order`:

```prisma
model Order {
  // existing fields preserved

  storefrontId       String?
  orderType          OrderType    @default(DINE_IN)
  tableNumber        String?
  customerName       String?
  customerPhone      String?
  customerNotes      String?
  paymentMethod      PaymentMethod?
  paymentStatus      PaymentStatus @default(PENDING)
  paymentProviderRef String?
  source             OrderSource   @default(DIRECT)

  storefront         Storefront?  @relation(fields: [storefrontId], references: [id])

  @@index([storefrontId, createdAt])
  @@index([customerPhone])
}

enum OrderType {
  DINE_IN
  TAKEAWAY
  DELIVERY
}

enum PaymentMethod {
  CASH
  QRIS
  GOPAY
  OVO
  DANA
  SHOPEEPAY
  BANK_TRANSFER
  CARD
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum OrderSource {
  DIRECT
  GOFOOD
  GRABFOOD
  SHOPEEFOOD
  TOKOPEDIA
}
```

### Phase 3 additions

```prisma
model Table {
  id            String      @id @default(cuid())
  storeId       String
  number        String
  seatCapacity  Int         @default(4)
  zone          String?
  isActive      Boolean     @default(true)

  store         Store       @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orders        Order[]

  @@unique([storeId, number])
  @@map("tables")
}
```

OrderItem extension:

```prisma
model OrderItem {
  // existing fields preserved

  status         OrderItemStatus  @default(PENDING)
  preparedAt     DateTime?
  servedAt       DateTime?
}

enum OrderItemStatus {
  PENDING
  PREPARING
  READY
  SERVED
  CANCELLED
}
```

### Phase 4 additions

```prisma
model StaffMember {
  id          String      @id @default(cuid())
  storeId     String
  userId      String?
  name        String
  phone       String?
  role        StaffRole   @default(CASHIER)
  pin         String?     // hashed
  isActive    Boolean     @default(true)

  store       Store       @relation(fields: [storeId], references: [id])
  user        User?       @relation(fields: [userId], references: [id])
  shifts      Shift[]

  @@map("staff_members")
}

enum StaffRole {
  OWNER
  MANAGER
  CASHIER
  KITCHEN
  WAITER
}

model Shift {
  id              String      @id @default(cuid())
  storeId         String
  staffMemberId   String
  clockInAt       DateTime    @default(now())
  clockOutAt      DateTime?
  openingCash     Decimal?    @db.Decimal(12, 2)
  closingCash     Decimal?    @db.Decimal(12, 2)
  expectedCash    Decimal?    @db.Decimal(12, 2)
  discrepancy     Decimal?    @db.Decimal(12, 2)
  notes           String?

  store           Store       @relation(fields: [storeId], references: [id])
  staffMember     StaffMember @relation(fields: [staffMemberId], references: [id])
  orders          Order[]

  @@map("shifts")
}
```

Order gets `shiftId` relation.

### Phase 5 additions

Two new models track aggregator email ingestion. The `Order.source` enum was also extended with `GOFOOD | GRABFOOD | SHOPEEFOOD | TOKOPEDIA`.

```prisma
enum AggregatorPlatform {
  GOFOOD
  GRABFOOD
  SHOPEEFOOD
  TOKOPEDIA
}

model AggregatorConnection {
  id          String             @id @default(cuid())
  storeId     String
  platform    AggregatorPlatform
  displayName String?            // e.g. "Warung Bahagia - GoFood"
  isActive    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  store       Store              @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId, platform])
  @@index([storeId])
  @@map("aggregator_connections")
}

model AggregatorEmail {
  id            String              @id @default(cuid())
  storeId       String
  platform      AggregatorPlatform?
  fromAddress   String
  subject       String
  bodyText      String              @db.Text
  bodyHtml      String?             @db.Text
  parsedOrderId String?             // null until parsing succeeds
  parseStatus   String              @default("pending") // pending | success | failed | manual
  parseError    String?
  createdAt     DateTime            @default(now())

  store         Store               @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
  @@index([parseStatus])
  @@map("aggregator_emails")
}
```

`parseStatus` lifecycle: `pending` → `success` (OpenAI parsed + Order created) | `failed` (parse error, Inngest will retry) | `manual` (no `OPENAI_API_KEY` — body stored for human review).

---

## Subscription enum

Renamed in Phase 0:

```prisma
enum SubscriptionPlan {
  FREE
  POS
  OPERATIONS
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
  INCOMPLETE
}
```

Migration: `prisma/migrations/<timestamp>_rename_subscription_plans/`. Handles the enum swap manually with explicit SQL. See `/docs/PHASE_0_CLEANUP.md` task 1.2.

---

## Migration discipline

| Rule                                                                            | Why                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Every schema change goes through `prisma migrate dev --name <descriptive_name>` | History matters                                 |
| Manual SQL allowed for enum changes and data migrations                         | Prisma can't safely do enum value rename        |
| Never use `prisma db push` against any database except your local dev           | It skips the migration history                  |
| Test the migration against a snapshot of prod data before merging               | Most migration failures are data-shape problems |
| Commit the migration file alongside the schema change                           | They must move together                         |
| Write data backfills as inline SQL in the same `migration.sql`, not a script    | The backfill and the column must land atomically |
| Combine multi-value backfills into ONE `UPDATE ... CASE`, never one per value   | Each pass fully rewrites the table               |
| Document the down-SQL as a comment block at the bottom of `migration.sql`       | Prisma migrations are forward-only               |

**Backfills run against live traffic.** `package.json`'s build script is `prisma migrate deploy && tsx scripts/sync-changelog.ts && next build`, so every committed migration applies as the FIRST step of a Vercel build — while the *previous* deployment is still serving. Additive columns with a default or nullable are metadata-only on PG11+, but a table-rewriting `UPDATE` inside the migration blocks writes for its duration. Measure `count(*)` first; if the table is large, move the backfill to a batched, idempotent, `--dry-run`-capable script under `scripts/` and make the code tolerate a not-yet-backfilled row.

**Precedents worth copying:** `20260810124956_add_custom_product_line` (enum + column + index), `20260811033102_add_product_track_stock` (column + a commented backfill explaining why the column default would misrepresent existing rows), and `20260814105502_add_product_stock_mode` (enum + 6 columns + two backfills + documented down-SQL).

---

## Development vs production database (Neon branching)

Local dev and Vercel Preview deployments used to share the same connection
string as production — a bad local migration, a runaway seed script, or a
preview build's `prisma migrate deploy` could take prod down. Fixed via Neon's
branching (copy-on-write, so branching is instant and doesn't duplicate
storage):

- **`main`** — production branch. Only Vercel's `production`-scoped env vars
  point here. Nothing else should ever hold this connection string.
- **`development`** — branched off `main`. Local `.env` and Vercel's
  `preview`-scoped env vars point here. Reset to `main`'s current head nightly
  by `.github/workflows/reset-dev-db.yml` (`POST /branches/{id}/reset_to_parent`
  via the Neon API), or on demand via that workflow's "Run workflow" button.
  A reset discards whatever the dev branch accumulated and pulls a fresh
  copy of prod data — don't rely on anything written to it surviving.

Data only ever flows `main` → `development`. Schema changes flow the other
way: run `prisma migrate dev` locally (against `development`), commit the
migration file, merge to `main` — the Vercel production build already runs
`prisma migrate deploy` (see `package.json`), which applies it to `main`.
This is also why "test the migration against a snapshot of prod data before
merging" (above) is now close to automatic — `development` already *is* a
recent snapshot of prod.

See `docs/ENVIRONMENT.md` for the full env-var-to-branch-to-Vercel-target
table.

---

## Indexing strategy

Indexed by default (Prisma auto-indexes):

- All `@id` fields
- All foreign keys
- All `@unique` fields

Add explicit indexes for:

- Frequent `WHERE` conditions: `@@index([storeId, createdAt])` on `Order` for dashboard queries
- Search by phone or slug: `@@index([slug])` on `Storefront`
- Time-series queries: `@@index([storeId, createdAt])` everywhere it appears

Don't over-index. Each index slows writes. Audit after a few months of production data.

---

## Soft deletes vs hard deletes

| Model                                 | Strategy                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `User`                                | Hard delete, with cascade to all owned data                                           |
| `Store`                               | Hard delete on user request, after explicit confirmation                              |
| `Subscription`                        | Never delete, only mark canceled                                                      |
| `Order`                               | Never delete. Mark with `status = "CANCELLED"`. Audit trail matters.                  |
| `Material`, `Product`, `Recipe`       | Soft delete with `isActive: false`. Cannot delete if referenced by historical orders. |
| `MenuItem`                            | Soft delete with `isAvailable: false`. Hard delete only if never ordered.             |
| `StockMovement`, `Shift`, `OrderItem` | Never delete. Append-only.                                                            |

The rationale: anything tied to money or compliance must be immutable in history.

---

## Backups and recovery

See **`docs/BACKUP_RESTORE.md`** for the full implementation, restore steps,
and the quarterly-drill checklist. Summary:

Production:

- Neon point-in-time recovery, 7 days (built into Neon, no setup)
- Daily logical backup to Cloudflare R2 bucket, 90-day retention
  (`nightly-database-backup` Inngest cron, `src/lib/backup/`)
- Quarterly restore drill (manual, `docs/BACKUP_RESTORE.md`)

Staging:

- Same setup but 3-day PITR retention

Local dev:

- No backups. Use `prisma migrate reset` to start fresh.

---

## Common query patterns

### Fetch a storefront with its menu

```typescript
const storefront = await prisma.storefront.findUnique({
  where: { slug, isPublished: true },
  include: {
    menuCategories: {
      orderBy: { displayOrder: "asc" },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    },
  },
});
```

### Create an order with items in a transaction

```typescript
const order = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: {
      storeId,
      storefrontId,
      orderType: "DINE_IN",
      tableNumber: "12",
      customerPhone,
      // ...
    },
  });

  await tx.orderItem.createMany({
    data: items.map((i) => ({
      orderId: order.id,
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  });

  return order;
});
```

### Update storefront and invalidate cache

```typescript
import { revalidateTag } from "next/cache";

const updated = await prisma.storefront.update({
  where: { id, storeId }, // tenant scope
  data: { displayName, themeColor },
});

revalidateTag(`storefront:${updated.slug}`);
```

---

## Local development

`.env` already points `DATABASE_URL`/`DIRECT_URL` at the Neon `development`
branch (see "Development vs production database" above) — no local Postgres
to install. That branch gets reset from production nightly, so it's safe to
experiment against.

```bash
# Apply migrations
pnpm prisma migrate dev

# Open GUI
pnpm prisma studio

# Reset (DESTRUCTIVE — wipes the development branch's data; it'll get
# fresh prod data back at the next nightly reset regardless)
pnpm prisma migrate reset
```

A local Postgres via Docker is also an option if you'd rather not touch even
the dev branch:

```bash
docker run --name epidom-db \
  -e POSTGRES_USER=epidom \
  -e POSTGRES_PASSWORD=epidom \
  -e POSTGRES_DB=epidom \
  -p 5432:5432 \
  -d postgres:16

# Then override in .env:
DATABASE_URL="postgresql://epidom:epidom@localhost:5432/epidom"
DIRECT_URL="postgresql://epidom:epidom@localhost:5432/epidom"
```

---

## DBML export

The repo includes `prisma-dbml-generator` and emits a DBML file at `prisma/dbml/schema.dbml` on each generate. Use this with dbdiagram.io for visual schema review.

```bash
pnpm prisma generate
# regenerates prisma/dbml/schema.dbml
```
