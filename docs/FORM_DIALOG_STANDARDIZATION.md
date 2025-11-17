# Form Dialog Standardization Guide

## Overview

Semua form dialog di project ini harus menggunakan `FormDialogLayout` untuk konsistensi UX. Layout ini memastikan:
- **Title form selalu terlihat di atas** (sticky header)
- **Button action selalu terlihat di bawah** (sticky footer)
- **Content area scrollable** di tengah

## Komponen: FormDialogLayout

**Location:** `src/components/ui/form-dialog-layout.tsx`

### Props

```typescript
interface FormDialogLayoutProps {
  title: string;                    // Required: Dialog title
  description?: string;             // Optional: Dialog description
  children: React.ReactNode;         // Required: Form content (scrollable)
  footer?: React.ReactNode;         // Optional: Action buttons (sticky footer)
  className?: string;               // Optional: Additional classes for DialogContent
  contentClassName?: string;        // Optional: Additional classes for scrollable content
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";  // Default: "md"
  showCloseButton?: boolean;        // Default: true
}
```

## Pattern Penggunaan

### Basic Example

```tsx
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";

export function MyFormDialog() {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open Form</Button>
      </DialogTrigger>

      <FormDialogLayout
        title="Form Title"
        description="Form description"
        maxWidth="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="my-form-id">
              Submit
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="my-form-id" onSubmit={form.handleSubmit(onSubmit)}>
            {/* Form fields here */}
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
```

### Dengan React Hook Form

```tsx
<FormDialogLayout
  title={t("form.title")}
  description={t("form.description")}
  maxWidth="lg"
  footer={
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(false)}
        disabled={isPending}
      >
        {t("common.cancel")}
      </Button>
      <Button
        type="submit"
        form="my-form-id"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("common.save")}
      </Button>
    </>
  }
>
  <Form {...form}>
    <form
      id="my-form-id"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
    >
      {/* Form fields */}
    </form>
  </Form>
</FormDialogLayout>
```

## MaxWidth Guidelines

- `sm`: 400px - Simple forms (1-2 fields)
- `md`: 500px - Standard forms (3-5 fields) - **Default**
- `lg`: 600px - Medium forms (6-10 fields)
- `xl`: 700px - Large forms (10+ fields, bulk operations)
- `2xl`: 900px - Very large forms (tables, complex layouts)
- `full`: Full width - Rarely used

## Migration Checklist

Untuk mengupdate form dialog yang sudah ada:

1. ✅ Import `FormDialogLayout` instead of `DialogContent`, `DialogHeader`, `DialogFooter`
2. ✅ Pindahkan `DialogTitle` dan `DialogDescription` ke props `title` dan `description`
3. ✅ Pindahkan action buttons ke prop `footer`
4. ✅ Hapus `DialogHeader` dan `DialogFooter` dari JSX
5. ✅ Wrap form content dengan `FormDialogLayout`
6. ✅ Tambahkan `id` pada `<form>` dan `form` attribute pada submit button
7. ✅ Pastikan content area menggunakan `FormDialogLayout` children (auto scrollable)

## Files yang Sudah Diupdate

- ✅ `src/features/dashboard/management/edit-stock/stock-adjustment-dialog.tsx`
- ✅ `src/features/dashboard/management/edit-stock/bulk-adjustment-dialog.tsx`
- ✅ `src/features/stores/stores/components/create-store-dialog.tsx` (already using similar pattern)
- ✅ `src/features/stores/stores/components/edit-store-dialog.tsx` (already using similar pattern)
- ✅ `src/features/dashboard/data/products/components/add-product-dialog.tsx` (already using similar pattern)

## Files yang Perlu Diupdate

- ⏳ `src/features/dashboard/alerts/components/place-order-dialog.tsx`
- ⏳ `src/features/dashboard/data/materials/components/add-material-dialog.tsx`
- ⏳ `src/features/dashboard/data/materials/components/edit-material-dialog.tsx`
- ⏳ `src/features/dashboard/data/products/components/edit-product-dialog.tsx`
- ⏳ `src/features/dashboard/data/suppliers/components/add-supplier-dialog.tsx`
- ⏳ `src/features/dashboard/data/suppliers/components/edit-supplier-dialog.tsx`
- ⏳ `src/features/dashboard/data/recipes/components/add-recipe-dialog.tsx`
- ⏳ `src/features/dashboard/data/recipes/components/edit-recipe-dialog.tsx`
- ⏳ `src/features/dashboard/management/recipe-production/start-production-dialog.tsx`
- ⏳ `src/features/dashboard/alerts/components/bulk-order-dialog.tsx`
- ⏳ `src/features/marketing/shared/components/waitlist-dialog.tsx`
- ⏳ Dan form dialog lainnya...

## Benefits

1. **Consistent UX**: Semua form memiliki behavior yang sama
2. **Better Accessibility**: Title dan actions selalu visible
3. **Maintainability**: Single source of truth untuk form layout
4. **Responsive**: Auto-adapts untuk mobile dan desktop
5. **Type Safety**: TypeScript support untuk semua props

