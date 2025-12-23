# Database Schema

## Overview

EPIDOM uses PostgreSQL with Prisma ORM. The schema follows a multi-tenant architecture where all data is scoped to a `Store`.

## Entity Relationship Diagram

```
┌──────────┐     ┌────────────┐     ┌─────────┐
│   User   │────│  Business  │────│  Store  │
└──────────┘     └────────────┘     └─────────┘
     │                                   │
     ▼                                   │
┌──────────────┐                         │
│ Subscription │                         │
└──────────────┘                         │
                                         │
      ┌──────────────────────────────────┼──────────────────────────┐
      │                                  │                          │
      ▼                                  ▼                          ▼
┌────────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────────────┐
│  Material  │────│  Supplier   │     │ Product  │     │ ProductionBatch │
└────────────┘     └─────────────┘     └──────────┘     └─────────────────┘
      │                  │                   │                   │
      ▼                  ▼                   │                   │
┌────────────────────────────┐               │                   │
│    MaterialSupplier        │               │                   │
└────────────────────────────┘               │                   │
      │                                      │                   │
      ▼                                      ▼                   ▼
┌──────────────────┐                ┌─────────────────────────────────┐
│ RecipeIngredient │───────────────│           Recipe                │
└──────────────────┘                └─────────────────────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │  RecipeProduct  │
                                    └─────────────────┘
```

---

## Core Models

### User & Authentication

```prisma
model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  emailVerified Boolean
  locale        String   @default("en")
  currency      String   @default("EUR")

  business      Business?
  subscription  Subscription?
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
}
```

### Business & Store

```prisma
model Business {
  id       String  @id @default(cuid())
  userId   String  @unique
  name     String
  currency String  @default("EUR")

  stores   Store[]
}

model Store {
  id         String @id @default(cuid())
  businessId String
  name       String

  ingredients       Material[]
  products          Product[]
  recipes           Recipe[]
  suppliers         Supplier[]
  productionBatches ProductionBatch[]
}
```

### Inventory

```prisma
model Material {
  id           String  @id @default(cuid())
  storeId      String
  sku          String
  name         String
  unit         String  @default("kg")
  unitCost     Decimal @db.Decimal(10, 2)
  currentStock Decimal @default(0)
  minStock     Decimal @default(0)
  maxStock     Decimal @default(1000)

  materialSuppliers MaterialSupplier[]

  @@unique([storeId, sku])
}

model Product {
  id           String  @id @default(cuid())
  storeId      String
  sku          String
  name         String
  costPrice    Decimal @db.Decimal(10, 2)
  sellingPrice Decimal @db.Decimal(10, 2)
  currentStock Decimal @default(0)

  @@unique([storeId, sku])
}
```

### Recipe & Production

```prisma
model Recipe {
  id                    String @id @default(cuid())
  storeId               String
  name                  String
  yieldQuantity         Decimal
  yieldUnit             String
  productionTimeMinutes Int

  ingredients RecipeIngredient[]
}

model ProductionBatch {
  id              String           @id @default(cuid())
  storeId         String
  batchNumber     String           @unique
  productId       String
  recipeId        String?
  plannedQuantity Decimal
  actualQuantity  Decimal?
  status          ProductionStatus @default(PLANNED)
  scheduledDate   DateTime
  completedDate   DateTime?
}
```

---

## Enums

| Enum                  | Values                                                           |
| --------------------- | ---------------------------------------------------------------- |
| `SubscriptionPlan`    | STARTER, PRO, ENTERPRISE                                         |
| `SubscriptionStatus`  | ACTIVE, CANCELED, PAST_DUE, INCOMPLETE                           |
| `ProductionStatus`    | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED                       |
| `MovementType`        | PURCHASE, PRODUCTION_IN, PRODUCTION_OUT, SALE, ADJUSTMENT, WASTE |
| `OrderStatus`         | PENDING, CONFIRMED, IN_PRODUCTION, READY, DELIVERED, CANCELLED   |
| `SupplierOrderStatus` | PENDING, PLACED, RECEIVED, CANCELLED                             |

---

## Indexes

Key indexes for query performance:

```prisma
@@index([storeId])           // All store-scoped models
@@index([category])          // Materials, Products, Recipes
@@index([status])            // Orders, ProductionBatches
@@index([createdAt])         // Audit logs, StockMovements
```

---

## Migrations

```bash
# Generate migration
pnpm db:migrate:dev --name add_feature

# Apply to production
pnpm db:migrate:deploy

# Reset database (dev only)
pnpm db:reset
```
