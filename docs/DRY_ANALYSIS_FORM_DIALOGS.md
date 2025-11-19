# DRY Analysis: Form Dialog Standardization

## Current State

### ✅ Sudah DRY
1. **FormDialogLayout Component** - Layout structure sudah di-reuse
   - Sticky header dengan title & description
   - Scrollable content area
   - Sticky footer
   - MaxWidth options

### ⚠️ Masih Ada Duplikasi (Peluang DRY)

#### 1. Footer Buttons Pattern (HIGH PRIORITY)

**Pattern yang berulang di hampir semua form dialogs:**

```tsx
footer={
  <>
    <Button
      type="button"
      variant="outline"
      onClick={() => onOpenChange(false)}
      disabled={isPending}
    >
      {t("common.actions.cancel") || "Cancel"}
    </Button>
    <Button
      type="submit"
      form="form-id"
      disabled={isPending}
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {submitText}
    </Button>
  </>
}
```

**Duplikasi ditemukan di:**
- `edit-product-dialog.tsx`
- `edit-supplier-dialog.tsx`
- `edit-material-dialog.tsx`
- `edit-recipe-dialog.tsx`
- `edit-personal-info-dialog.tsx`
- `edit-business-info-dialog.tsx`
- `place-order-dialog.tsx`
- `bulk-order-dialog.tsx`
- `update-delivery-status-dialog.tsx`
- Dan banyak lagi...

**Solusi: Buat `FormDialogFooter` component**

```tsx
interface FormDialogFooterProps {
  formId: string;
  onCancel: () => void;
  onSubmit?: () => void; // Optional, jika perlu custom handler
  submitText: string;
  cancelText?: string;
  isPending?: boolean;
  disabled?: boolean;
  variant?: "default" | "full-width"; // full-width untuk flex-1 buttons
  additionalButtons?: React.ReactNode; // Untuk buttons tambahan (remove, dll)
}
```

#### 2. Form Structure Pattern (MEDIUM PRIORITY)

**Pattern yang berulang:**

```tsx
<Form {...form}>
  <form id="form-id" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    {/* Form fields */}
  </form>
</Form>
```

**Tapi ini lebih sulit di-DRY karena:**
- Setiap form memiliki fields yang berbeda
- Form structure sudah cukup simple
- Tidak terlalu banyak duplikasi

**Rekomendasi:** Keep as is (KISS principle)

#### 3. Error Handling Pattern (LOW PRIORITY - Sudah ada useErrorHandler)

**Pattern yang berulang:**

```tsx
onError: (error) => {
  toast.error(t("common.error"), {
    description: error instanceof Error ? error.message : "An error occurred",
  });
}
```

**Status:** ✅ Sudah di-handle dengan `useErrorHandler` hook

## Rekomendasi: FormDialogFooter Component

### Implementation

```tsx
// src/components/ui/form-dialog-footer.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

interface FormDialogFooterProps {
  formId: string;
  onCancel: () => void;
  submitText: string;
  cancelText?: string;
  isPending?: boolean;
  disabled?: boolean;
  variant?: "default" | "full-width";
  additionalButtons?: React.ReactNode;
  showCancel?: boolean; // Default: true
}

export function FormDialogFooter({
  formId,
  onCancel,
  submitText,
  cancelText,
  isPending = false,
  disabled = false,
  variant = "default",
  additionalButtons,
  showCancel = true,
}: FormDialogFooterProps) {
  const { t } = useI18n();

  return (
    <>
      {showCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending || disabled}
          className={cn(variant === "full-width" && "flex-1")}
        >
          {cancelText || t("common.actions.cancel") || "Cancel"}
        </Button>
      )}
      {additionalButtons}
      <Button
        type="submit"
        form={formId}
        disabled={isPending || disabled}
        className={cn(variant === "full-width" && "flex-1")}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitText}
      </Button>
    </>
  );
}
```

### Usage Example

**Before (Duplikasi):**
```tsx
<FormDialogLayout
  footer={
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isPending}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button
        type="submit"
        form="edit-product-form"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("data.products.update")}
      </Button>
    </>
  }
>
```

**After (DRY):**
```tsx
<FormDialogLayout
  footer={
    <FormDialogFooter
      formId="edit-product-form"
      onCancel={() => onOpenChange(false)}
      submitText={t("data.products.update")}
      isPending={isPending}
    />
  }
>
```

### Benefits

1. **DRY** - Hapus duplikasi footer buttons di 20+ files
2. **Consistency** - Semua footer buttons memiliki behavior yang sama
3. **Maintainability** - Perubahan footer behavior hanya di satu tempat
4. **Type Safety** - Props yang jelas dan type-safe
5. **Flexibility** - Masih support custom buttons dengan `additionalButtons`

### Edge Cases Handled

1. **Full-width buttons** (profile dialogs) - `variant="full-width"`
2. **Additional buttons** (edit-avatar dengan remove button) - `additionalButtons`
3. **No cancel button** (beberapa dialogs) - `showCancel={false}`
4. **Custom cancel text** - `cancelText` prop

## Decision Matrix

| Aspect | Current | With FormDialogFooter | Recommendation |
|--------|---------|----------------------|----------------|
| **DRY** | ⚠️ Medium (duplikasi footer) | ✅ High | ✅ Implement |
| **KISS** | ✅ Simple | ✅ Still simple | ✅ Implement |
| **Flexibility** | ✅ High | ✅ High (props support custom) | ✅ Implement |
| **Maintainability** | ⚠️ Medium (20+ places to update) | ✅ High (1 place) | ✅ Implement |
| **Type Safety** | ✅ Good | ✅ Better (explicit props) | ✅ Implement |

## Conclusion

**Rekomendasi: ✅ IMPLEMENT FormDialogFooter**

**Alasan:**
1. Duplikasi yang jelas dan signifikan (20+ files)
2. Pattern yang konsisten di semua form dialogs
3. Tidak mengurangi flexibility (masih support custom)
4. Meningkatkan maintainability
5. Sesuai dengan prinsip DRY tanpa melanggar KISS

**Priority:** HIGH - Bisa diimplementasikan setelah semua form dialogs sudah di-standardize.

