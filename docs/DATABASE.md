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

| Model | Purpose |
|---|---|
| `User`, `Session`, `Account`, `Verification` | Better Auth tables |
| `Business`, `Store` | Tenant hierarchy |
| `Subscription` | SaaS billing state |
| `Product`, `Material`, `MaterialSupplier` | Catalog (now operations-gated) |
| `Recipe`, `RecipeIngredient`, `RecipeProduct` | Recipes (now operations-gated) |
| `ProductionBatch` | Manufacturing batches (now enterprise-gated) |
| `StockMovement` | Inventory audit log |
| `Supplier`, `SupplierOrder`, `SupplierOrderItem` | Supply chain |
| `Order`, `OrderItem` | Sales (heavily extended in Phase 2) |
| `Alert` | Stock alerts |
| `ExchangeRate` | Currency conversion |
| `AIImportMemory`, `AIImportSession` | AI-assisted CSV import |

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

```prisma
model AggregatorConnection {
  id              String   @id @default(cuid())
  storeId         String
  aggregator      OrderSource
  externalId      String?  // their merchant ID with the aggregator
  emailParserKey  String?  // for v1 email forwarding flow
  isActive        Boolean  @default(true)
  
  store           Store    @relation(fields: [storeId], references: [id])
  
  @@unique([storeId, aggregator])
  @@map("aggregator_connections")
}
```

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

| Rule | Why |
|---|---|
| Every schema change goes through `prisma migrate dev --name <descriptive_name>` | History matters |
| Manual SQL allowed for enum changes and data migrations | Prisma can't safely do enum value rename |
| Never use `prisma db push` against any database except your local dev | It skips the migration history |
| Test the migration against a snapshot of prod data before merging | Most migration failures are data-shape problems |
| Commit the migration file alongside the schema change | They must move together |

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

| Model | Strategy |
|---|---|
| `User` | Hard delete, with cascade to all owned data |
| `Store` | Hard delete on user request, after explicit confirmation |
| `Subscription` | Never delete, only mark canceled |
| `Order` | Never delete. Mark with `status = "CANCELLED"`. Audit trail matters. |
| `Material`, `Product`, `Recipe` | Soft delete with `isActive: false`. Cannot delete if referenced by historical orders. |
| `MenuItem` | Soft delete with `isAvailable: false`. Hard delete only if never ordered. |
| `StockMovement`, `Shift`, `OrderItem` | Never delete. Append-only. |

The rationale: anything tied to money or compliance must be immutable in history.

---

## Backups and recovery

Production:
- Neon (or chosen Postgres provider) point-in-time recovery, 7 days
- Daily logical backup to Cloudflare R2 bucket, 90-day retention
- Quarterly restore drill (manual)

Staging:
- Same setup but 3-day retention

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
    data: items.map(i => ({
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
  where: { id, storeId },  // tenant scope
  data: { displayName, themeColor },
});

revalidateTag(`storefront:${updated.slug}`);
```

---

## Local development

```bash
# Spin up Postgres in Docker
docker run --name epidom-db \
  -e POSTGRES_USER=epidom \
  -e POSTGRES_PASSWORD=epidom \
  -e POSTGRES_DB=epidom \
  -p 5432:5432 \
  -d postgres:16

# Then in .env.local:
DATABASE_URL="postgresql://epidom:epidom@localhost:5432/epidom"

# Apply migrations
pnpm prisma migrate dev

# Open GUI
pnpm prisma studio

# Reset (DESTRUCTIVE)
pnpm prisma migrate reset
```

---

## DBML export

The repo includes `prisma-dbml-generator` and emits a DBML file at `prisma/dbml/schema.dbml` on each generate. Use this with dbdiagram.io for visual schema review.

```bash
pnpm prisma generate
# regenerates prisma/dbml/schema.dbml
```
