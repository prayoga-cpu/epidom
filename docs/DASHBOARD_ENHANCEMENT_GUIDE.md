# Dashboard Enhancement Implementation Guide

This document outlines the completed foundational work and provides patterns for implementing the remaining dashboard enhancements.

## ✅ Completed Foundation (Phase 1-2)

### 1. Enhanced Mock Data

**Location:** `src/mocks/`

Created comprehensive mock data structures with full type safety:

- **`inventory.mock.ts`** - Materials, Recipes, Products, Suppliers, Stock Movements, Production Batches
  - 8 materials with complete fields (SKU, category, supplier linkage, stock levels)
  - 4 recipes with ingredients and cost calculations
  - 4 products with recipe linkage and pricing tiers
  - 4 suppliers with performance metrics
  - Production batches with quality tracking
  - Stock movements with audit trail

- **`orders.mock.ts`** - Orders with items, status history, payment tracking
  - 6 complete orders with customer info
  - Order items with pricing calculations
  - Status history timeline

- **`alerts.mock.ts`** - Alerts with types, priorities, resolution tracking
  - 8 alerts across different types (low_stock, expiry_warning, quality_issue, etc.)
  - Priority levels (critical, high, medium, low)
  - Resolution workflows

- **`users.mock.ts`** - Users, team members, activity logs, permissions
  - 5 users with different roles
  - Team member relationships
  - Activity logs
  - Permission definitions

- **`analytics.mock.ts`** - Dashboard stats, production history, cost breakdown
  - Dashboard statistics
  - Production history (weekly, monthly, quarterly)
  - Category-wise stock distribution
  - Top products by revenue
  - Waste tracking
  - Supplier performance
  - Cost breakdowns

### 2. TypeScript Type Definitions

**Location:** `src/types/entities.ts`

Complete type system aligned with Prisma schema:

- **Enums:** MaterialCategory, ProductionStatus, OrderStatus, PaymentStatus, MovementType, AlertType, AlertPriority, AlertStatus, UserRole, PaymentTerms
- **Core Entities:** Material, Recipe, Product, Supplier, Order, ProductionBatch, StockMovement, Alert, User, TeamMember
- **DTOs:** CreateMaterialDto, UpdateMaterialDto, MaterialFilters, etc. for all entities
- **API Types:** PaginationParams, PaginatedResponse, ApiResponse, BulkOperationResult

### 3. Utility Functions

**Location:** `src/lib/utils/`

Three utility modules:

**`export.ts`** - Data export functionality

- `exportToCSV()` - Convert data to CSV and download
- `exportToExcel()` - Export using xlsx library
- `exportToPDF()` - Export using jsPDF
- `exportData()` - Generic export function
- `copyToClipboard()` - Copy data as CSV

**`formatting.ts`** - Display formatting

- Date formatting (formatDate, formatDateTime, formatRelativeTime)
- Number formatting (formatNumber, formatPercentage, formatCompactNumber)
- Currency formatting (formatCurrency)
- Unit formatting (formatWeight, formatVolume)
- Status formatting (formatStatus, getStatusColor)
- Stock helpers (getStockStatus, getStockStatusColor, calculateStockPercentage)

**`filters.ts`** - Backend-ready filtering

- `buildQueryParams()` - Convert filters to URL params
- `buildQueryString()` - Generate query string
- `parseQueryParams()` - Parse URL params to filters
- `getDateRange()` - Get date ranges for presets
- Client-side helpers (filterBySearch, sortByField, paginateArray, applyFilters)

### 4. Shared Components

**Location:** `src/components/ui/`

Reusable UI components:

- **`confirmation-dialog.tsx`** - Reusable confirmation dialogs
- **`export-button.tsx`** - Export dropdown with CSV/Excel/PDF options
- **`date-range-picker.tsx`** - Date range selector with presets
- **`multi-select.tsx`** - Multi-select dropdown for filters
- **`form.tsx`** - Shadcn form components (installed)
- **`alert-dialog.tsx`**, **`command.tsx`**, **`calendar.tsx`**, **`popover.tsx`** (installed)

### 5. API Documentation

**Location:** `docs/API_SPECIFICATION.md`

Complete REST API specification with:

- All endpoints for Materials, Recipes, Products, Suppliers, Orders, Stock, Production, Alerts, Analytics
- Request/Response schemas
- Query parameters
- Error codes
- Rate limiting info
- Notes for backend implementation

## 🎯 Modern Form Pattern (Demonstrated)

**Example:** `src/features/dashboard/dashboard/components/add-material-dialog.tsx`

This dialog demonstrates the standard pattern for all forms:

### Key Features:

1. **React Hook Form + Zod Validation**

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  // ...
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: {
    /* ... */
  },
});
```

2. **Shadcn Form Components**

```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label *</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

3. **Enhanced Mock Data Integration**

```typescript
import { MOCK_SUPPLIERS } from "@/mocks";
import { MaterialCategory } from "@/types/entities";

// Use in Select dropdown
{MOCK_SUPPLIERS.map((supplier) => (
  <SelectItem key={supplier.id} value={supplier.id}>
    {supplier.name}
  </SelectItem>
))}
```

4. **Loading States & Async Handling**

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const onSubmit = async (data) => {
  setIsSubmitting(true);
  // TODO: API call
  // await fetch("/api/materials", { method: "POST", body: JSON.stringify(data) });
  setIsSubmitting(false);
  toast({ title: "Success!" });
  form.reset();
  setOpen(false);
};
```

5. **Type Safety Throughout**

```typescript
type FormValues = z.infer<typeof schema>;
const form = useForm<FormValues>({
  /* ... */
});
```

## 🚀 Implementation Roadmap

### Immediate Next Steps

#### 1. Apply Form Pattern to Remaining Dialogs (Priority: High)

**Dashboard Dialogs:**

- ✅ `add-material-dialog.tsx` (DONE - reference implementation)
- ⏳ `add-order-dialog.tsx` - Apply same pattern
- ⏳ `add-recipe-dialog.tsx` - Multi-step wizard (more complex)
- ⏳ `update-stock-dialog.tsx` - Stock adjustment with reasons
- ⏳ `view-order-dialog.tsx` - View-only, add edit functionality

**Data Page Dialogs:**

- ⏳ Create `material-details-dialog.tsx` - View with edit/delete
- ⏳ Create `edit-material-dialog.tsx` - Pre-filled form
- ⏳ Create `recipe-details-dialog.tsx` - Show ingredients, cost calc
- ⏳ Create `product-details-dialog.tsx` - Show recipe link, pricing
- ⏳ Create `supplier-details-dialog.tsx` - Performance metrics

**Management Page Dialogs:**

- ⏳ Enhance `schedule-delivery-dialog.tsx` - Calendar picker
- ⏳ Enhance `update-order-status-dialog.tsx` - Status tracking
- ⏳ Create `start-production-dialog.tsx` - Material availability check
- ⏳ Create `batch-details-dialog.tsx` - Production batch info

#### 2. Add Interactive Features (Priority: Medium)

**Tracking Page (`/tracking`):**

- Add filter toolbar (category, stock status, supplier)
- Add sort by column headers
- Add pagination controls
- Add bulk selection + actions
- Add restock button per row
- Add stock history button
- Create `stock-history-dialog.tsx`
- Create `bulk-restock-dialog.tsx`

**Data Page (`/data`):**

- Update `section.tsx` with search/filter
- Add view/edit/delete actions on hover
- Add bulk select mode
- Create details dialogs for each entity type

**Dashboard Page (`/dashboard`):**

- Make stat cards clickable (navigate with filters)
- Add date range filter to production chart
- Add export button to charts
- Make workflow segments clickable
- Add bulk actions to orders table

#### 3. Add Missing Dialogs (Priority: Medium)

**Alerts Page:**

- `alert-action-dialog.tsx` - Resolve, snooze, create order
- `place-order-dialog.tsx` - Generate purchase order from alert

**Profile Page:**

- `team-management-card.tsx` - Invite, remove members
- `notification-preferences-card.tsx` - Configure alerts
- `activity-log-card.tsx` - User activity timeline

#### 4. Translations (Priority: Low but Important)

Update `src/locales/en.ts`, `fr.ts`, `id.ts` with:

- All new dialog titles/descriptions
- All new form field labels
- All new button labels
- All validation messages
- All success/error toasts

Example additions needed:

```typescript
// en.ts
export const en = {
  // ... existing
  dialogs: {
    addMaterial: {
      title: "Add New Material",
      description: "Add a new material to your inventory",
      // ... more
    },
    // ... more dialogs
  },
  forms: {
    labels: {
      materialName: "Material Name",
      sku: "SKU",
      // ... more labels
    },
    validation: {
      required: "This field is required",
      minLength: "Minimum {0} characters required",
      // ... more validation
    },
  },
  // ... more
};
```

## 📋 Component Development Checklist

When creating/updating a dialog component:

- [ ] Import shadcn Form components
- [ ] Create Zod validation schema
- [ ] Set up useForm with zodResolver
- [ ] Use FormField for all inputs
- [ ] Add loading state (isSubmitting)
- [ ] Import and use enhanced mock data
- [ ] Add proper TypeScript types from entities.ts
- [ ] Add TODO comment for API integration
- [ ] Include FormMessage for validation errors
- [ ] Add success toast on submission
- [ ] Reset form after successful submission
- [ ] Add cancel button
- [ ] Disable buttons during submission
- [ ] Show loading spinner on submit button
- [ ] Add proper spacing (use space-y-4 for form)
- [ ] Use responsive grid layouts (sm:grid-cols-2, etc.)
- [ ] Add FormDescription where helpful
- [ ] Test validation (try submitting empty, invalid data)

## 🎨 UI/UX Patterns

### Dialog Sizes

- **Small:** Simple forms, confirmations (`sm:max-w-[425px]`)
- **Medium:** Standard forms (`sm:max-w-[600px]`)
- **Large:** Multi-step, complex forms (`sm:max-w-[700px]` or `sm:max-w-[900px]`)
- **Full:** Tables, detailed views (`sm:max-w-[95vw]`)

### Form Layout

- Use `space-y-4` for vertical spacing between form fields
- Use `grid gap-4 sm:grid-cols-2` for side-by-side fields
- Group related fields together
- Place required fields first
- Use FormDescription for helpful hints

### Button States

- Primary action: Default button, right side
- Secondary action: Outline button, left side
- Destructive action: Destructive variant
- Loading: Disable + spinner icon
- Success: Show toast, close dialog

### Data Display

- Use `Badge` for status indicators
- Use `Progress` for stock levels
- Use `Separator` between sections
- Use `Card` for grouped information
- Use `Table` for lists

## 🔄 API Integration Pattern

When ready to connect to backend:

```typescript
// 1. Create API client function (src/lib/api/)
export async function createMaterial(data: CreateMaterialDto) {
  const response = await fetch("/api/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create material");
  }

  return response.json();
}

// 2. Update dialog to use API client
const onSubmit = async (data: MaterialFormValues) => {
  setIsSubmitting(true);
  try {
    const result = await createMaterial(data);
    toast({
      title: "Material Added",
      description: `${data.name} has been added successfully.`,
    });
    form.reset();
    setOpen(false);
    // Optionally: trigger refetch or update cache
  } catch (error) {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

## 📊 Testing Checklist

For each enhanced page/component:

- [ ] Form validation works (required fields, min/max, formats)
- [ ] Success toast appears after submission
- [ ] Error states display properly
- [ ] Loading states show during async operations
- [ ] Dialog opens and closes correctly
- [ ] Form resets after successful submission
- [ ] Cancel button works
- [ ] Buttons disable during submission
- [ ] Mock data displays correctly
- [ ] TypeScript types are correct (no `any`)
- [ ] Responsive design works on mobile
- [ ] Keyboard navigation works
- [ ] Console has no errors/warnings

## 🎯 Priority Order

Based on user impact and complexity:

### Phase 1 (Immediate)

1. ✅ Foundation (mock data, types, utilities, shared components)
2. ✅ API Documentation
3. ⏳ Convert remaining dashboard dialogs to new pattern
4. ⏳ Add material CRUD operations (create ✅, read, update, delete)

### Phase 2 (High Priority)

5. Recipe management with multi-step wizard
6. Product management with recipe linking
7. Order management with status tracking
8. Tracking page with filters and bulk actions

### Phase 3 (Medium Priority)

9. Supplier management with performance metrics
10. Production batch tracking
11. Alerts management with resolution workflow
12. Stock movements with audit trail

### Phase 4 (Polish)

13. Profile page team management
14. Activity logs
15. Advanced analytics
16. Translations for all new features

## 📝 Notes

- All filtering, sorting, pagination documented for backend but implemented client-side for now
- Forms use optimistic UI - show success immediately, handle errors gracefully
- Mock data simulates realistic delays (1 second)
- All components are fully typed - no `any` types
- Follow clean architecture - keep pages thin, extract to feature components
- Use TODO comments to mark where API integration is needed
- Test with both valid and invalid data
- Consider accessibility (ARIA labels, keyboard navigation)

## 🔗 Quick Links

- **Mock Data:** `src/mocks/`
- **Type Definitions:** `src/types/entities.ts`
- **Utilities:** `src/lib/utils/`
- **Shared Components:** `src/components/ui/`
- **API Docs:** `docs/API_SPECIFICATION.md`
- **Example Form:** `src/features/dashboard/dashboard/components/add-material-dialog.tsx`
- **Project Rules:** `CLAUDE.md`

---

**Last Updated:** October 28, 2025
**Status:** Foundation Complete ✅ | Implementation In Progress ⏳






