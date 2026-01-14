# MVP ANTI-GRAVITY PLAN

## 🎯 Mission Statement
Transform `epidom` into a **Demo-Ready MVP** that validates ONE core merchant workflow:
**Import Data → Execute POS Transactions → Export Reports**

---

## ⚠️ HARD CONSTRAINTS

### Allowed Routes (LOCKED)
```
/import
/pos
/reports
```

### Explicit NON-GOALS (DO NOT BUILD)
- ❌ AI Parsing
- ❌ Dashboards / Analytics
- ❌ Alerts System
- ❌ Roles & Permissions
- ❌ Theme / Animation polish
- ❌ Supplier Management
- ❌ Recipe / Production Tracking

---

## 📊 Current State Analysis

### Existing Routes (To Be Hidden/Removed for MVP)
Based on current `src/app/(app)` structure:
- `(auth)` - Keep (Login required)
- `(stores)` - Keep (Store selection)
- `checkout` - **HIDE**
- `onboarding` - **HIDE** (Skip for demo, use pre-seeded store)
- `profile` - **HIDE**
- `store/[storeId]/...` - **REPLACE** with MVP routes

### Existing Database Schema (Ready to Use)
| Table | MVP Relevance | Status |
| :--- | :--- | :--- |
| `Product` | ✅ Core (SKU, costPrice, sellingPrice, currentStock) | **READY** |
| `Order` + `OrderItem` | ✅ Use for POS Transactions | **READY** (Repurpose) |
| `StockMovement` | ✅ Track stock changes | **READY** |
| `Store` | ✅ Multi-store support | **READY** |
| `Recipe`, `Material`, `Supplier` | ❌ Out of MVP scope | **IGNORE** |
| `AIImportMemory`, `AIImportSession` | ❌ No AI parsing in MVP | **IGNORE** |

---

## 🛠️ IMPLEMENTATION PLAN

### PHASE 1: Route Lockdown & Cleanup
**Goal:** Strip the app down to MVP routes only.

**Tasks:**
- [ ] Create new route group: `src/app/(app)/store/[storeId]/(mvp)/`
- [ ] Add routes: `import/page.tsx`, `pos/page.tsx`, `reports/page.tsx`
- [ ] Create simplified sidebar with ONLY 3 navigation items
- [ ] Hide or remove access to all other routes (Dashboard, Management, Tracking, Data, Alerts)

**Deliverable:** App loads with only `/import`, `/pos`, `/reports` accessible.

---

### PHASE 2: Import Module
**Goal:** Parse CSV/XLSX → Populate database with Products, Stock, COGS.

**Flow:**
```
[User Uploads File]
      ↓
[Client-Side Parse (xlsx/papaparse)]
      ↓
[Preview Table: Columns Detected]
      ↓
[User Maps: Column A = SKU, Column B = Name, etc.]
      ↓
[Submit → Server Action → Prisma createMany]
      ↓
[Database Populated]
```

**Tasks:**
- [ ] Create `src/features/mvp/import/` folder
- [ ] Build File Upload component (drag & drop)
- [ ] Implement client-side CSV/XLSX parsing
- [ ] Build Column Mapping UI (NO AI - manual selection)
- [ ] Create Server Action: `importProducts(data[])`
- [ ] Validate: SKU unique, costPrice & sellingPrice required, currentStock >= 0

**Required Fields to Import:**
| Field | Maps To | Required |
| :--- | :--- | :--- |
| SKU | `product.sku` | ✅ |
| Name | `product.name` | ✅ |
| Cost Price (COGS) | `product.costPrice` | ✅ |
| Selling Price | `product.sellingPrice` | ✅ |
| Initial Stock | `product.currentStock` | ✅ |
| Category | `product.category` | ❌ Optional |
| Unit | `product.unit` | ❌ Optional (default: "piece") |

**Validation Output:**
- [ ] Products visible in database
- [ ] Stock values correct
- [ ] COGS values correct

---

### PHASE 3: POS Module
**Goal:** Execute transactions that reduce stock and record cost snapshot.

**Flow:**
```
[Product Grid / Search]
      ↓
[Add to Cart]
      ↓
[Checkout Button]
      ↓
[Create Order + OrderItems]
      ↓
[Decrement Product.currentStock]
      ↓
[Record StockMovement (type: SALE)]
      ↓
[Transaction Complete]
```

**Tasks:**
- [ ] Create `src/features/mvp/pos/` folder
- [ ] Build Product Grid (simple, no fancy design)
- [ ] Build Cart component (Zustand store)
- [ ] Create Server Action: `createPosTransaction(cart)`
  - Create `Order` record
  - Create `OrderItem` records (snapshot `costPrice` at time of sale)
  - Decrement `Product.currentStock` for each item
  - Create `StockMovement` record for audit trail
- [ ] Ensure atomic transaction (Prisma `$transaction`)

**Validation Output:**
- [ ] 3 transactions executed successfully
- [ ] Stock decremented correctly after each sale
- [ ] Order records stored with cost snapshot

**UI Requirements (Minimal):**
- Product list with search
- Cart sidebar
- "Checkout" button
- Success confirmation

---

### PHASE 4: Reports / Export Module
**Goal:** Export database tables to CSV (Google Sheets compatible).

**Export Tables:**
| Export Name | Source | Columns |
| :--- | :--- | :--- |
| Product Master | `Product` | SKU, Name, Category, Unit |
| Current Stock | `Product` | SKU, Name, currentStock |
| COGS Report | `Product` | SKU, Name, costPrice, sellingPrice |
| Transactions | `Order` + `OrderItem` | Date, OrderNumber, Items, Total, Profit |
| OPEX (Manual) | Custom Input | Date, Description, Amount |

**Tasks:**
- [ ] Create `src/features/mvp/reports/` folder
- [ ] Build Export buttons for each table
- [ ] Implement CSV generation (no formulas, no merged cells)
- [ ] Add simple OPEX input form (Date, Description, Amount)
- [ ] Store OPEX in database or allow direct export

**CSV Format Rules:**
- UTF-8 encoding
- Comma separated
- No formatting/formulas
- Header row included
- One-click download

**Validation Output:**
- [ ] All 4 export types downloadable
- [ ] CSV opens correctly in Google Sheets
- [ ] No manual cleanup required

---

## ✅ MVP PASS CRITERIA

The MVP is **PASSED** if and only if:

| Step | Validation | Status |
| :--- | :--- | :--- |
| 1 | CSV/XLSX uploaded and parsed | ⬜ |
| 2 | Products, Stock, COGS stored in database | ⬜ |
| 3 | 3 POS transactions executed | ⬜ |
| 4 | Stock correctly decremented | ⬜ |
| 5 | All tables exported to clean CSV | ⬜ |

---

## 📁 Proposed Folder Structure

```
src/
  features/
    mvp/
      import/
        components/
          file-uploader.tsx
          column-mapper.tsx
          import-preview.tsx
        actions.ts          # Server Actions
        page.tsx
      pos/
        components/
          product-grid.tsx
          cart.tsx
          checkout-button.tsx
        store.ts            # Zustand cart store
        actions.ts          # Server Actions
        page.tsx
      reports/
        components/
          export-button.tsx
          opex-form.tsx
        actions.ts          # Server Actions
        page.tsx
      shared/
        mvp-sidebar.tsx     # Simplified 3-item navigation
```

---

## 🚀 Execution Order

1. **Route Lockdown** - Create `/import`, `/pos`, `/reports` routes, hide others
2. **Import Module** - Build upload → parse → store flow
3. **POS Module** - Build product selection → cart → checkout flow
4. **Reports Module** - Build export functionality
5. **End-to-End Test** - Run full demo flow, validate pass criteria

---

## ⏱️ Time Estimate

| Phase | Effort |
| :--- | :--- |
| Route Lockdown | 2-4 hours |
| Import Module | 4-6 hours |
| POS Module | 6-8 hours |
| Reports Module | 2-4 hours |
| Testing & Fixes | 2-4 hours |
| **Total** | **16-26 hours** |

---

## 📝 Notes

- **Speed > Design:** Functional UI is sufficient. No animations, no glassmorphism.
- **No AI:** Column mapping is MANUAL (dropdown selection).
- **Repurpose Existing:** Use existing `Order`, `OrderItem`, `Product` tables. No new schema unless absolutely necessary.
- **Atomic Transactions:** All POS checkouts must use Prisma `$transaction` to prevent partial updates.
