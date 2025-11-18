# Error Handling Guide

## Overview

Sistem error handling yang konsisten dan user-friendly untuk seluruh dashboard. Semua error ditampilkan dengan jelas dan actionable untuk user.

## Komponen Utama

### 1. Error Handler Utility (`src/lib/utils/error-handler.ts`)

Utility functions untuk handle berbagai jenis error:

- `extractErrorMessage()` - Extract error message dari berbagai error types
- `extractErrorCode()` - Extract error code dari error
- `getUserFriendlyErrorMessage()` - Get user-friendly error message
- `showErrorToast()` - Show error toast notification
- `handleApiError()` - Handle API error response dengan detail lengkap
- `isValidationError()` - Check jika error adalah validation error
- `getValidationErrors()` - Get validation errors by field

### 2. useErrorHandler Hook (`src/hooks/use-error-handler.ts`)

Hook untuk consistent error handling:

```tsx
const { handleError, getErrorDetails, getErrorMessage, showSuccess } = useErrorHandler();
```

## Error Messages

Semua error codes memiliki user-friendly messages yang sudah didefinisikan di `ERROR_MESSAGES`:

- **Authentication errors**: "You need to sign in to continue"
- **Validation errors**: "Please check your input and try again."
- **Not found errors**: "The requested resource was not found."
- **Subscription errors**: "This feature is not available in your current plan."
- Dan lainnya...

## Usage Patterns

### Pattern 1: TanStack Query Mutation dengan Auto Error Handling

```tsx
import { useMutation } from "@tanstack/react-query";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { toast } from "sonner";

export function useCreateMaterial(storeId: string) {
  const { handleError, showSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: async (data: CreateMaterialInput) => {
      const response = await fetch(`/api/stores/${storeId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return response.json();
    },
    onSuccess: () => {
      showSuccess("Material created successfully");
      // Invalidate queries...
    },
    onError: (error) => {
      handleError(error, "Failed to create material");
    },
  });
}
```

### Pattern 2: Manual Error Handling dengan Detail

```tsx
import { useErrorHandler } from "@/hooks/use-error-handler";

function MyComponent() {
  const { getErrorDetails, handleError } = useErrorHandler();

  const handleSubmit = async (data: FormData) => {
    try {
      const response = await fetch("/api/endpoint", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorDetails = getErrorDetails(error);

        // Handle validation errors differently
        if (errorDetails.isValidationError) {
          // Set form errors
          Object.entries(errorDetails.validationErrors).forEach(([field, message]) => {
            setError(field, { message });
          });
          return;
        }

        // Show toast for other errors
        handleError(error, "Failed to submit");
        return;
      }

      // Success handling...
    } catch (error) {
      handleError(error, "An error occurred");
    }
  };
}
```

### Pattern 3: TanStack Query dengan Custom Error Handling

```tsx
import { useMutation } from "@tanstack/react-query";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { isValidationError, getValidationErrors } from "@/lib/utils/error-handler";

export function useUpdateProduct(storeId: string) {
  const { handleError } = useErrorHandler();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProductInput }) => {
      const response = await fetch(`/api/stores/${storeId}/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return response.json();
    },
    onError: (error) => {
      // Custom handling for validation errors
      if (isValidationError(error)) {
        const validationErrors = getValidationErrors(error);
        // Handle validation errors in form
        console.log("Validation errors:", validationErrors);
      }

      // Show toast for other errors
      handleError(error, "Failed to update product");
    },
  });
}
```

### Pattern 4: Error State di Component

```tsx
import { SectionErrorState } from "@/features/dashboard/data/components/section-error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";

function MaterialsSection() {
  const { data, error, isLoading, refetch } = useMaterials(storeId);
  const { getErrorMessage } = useErrorHandler();

  if (error) {
    return (
      <SectionErrorState
        title="Failed to load materials"
        message={getErrorMessage(error)}
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  // Render content...
}
```

## Best Practices

### ✅ DO

1. **Selalu gunakan `useErrorHandler` hook** untuk consistent error handling
2. **Show user-friendly messages** - jangan expose technical error details
3. **Handle validation errors separately** - set form field errors, bukan toast
4. **Show success messages** untuk user feedback yang jelas
5. **Log errors di development** - untuk debugging

### ❌ DON'T

1. **Jangan expose technical errors** ke user (stack traces, database errors, dll)
2. **Jangan duplicate error handling** - gunakan utility functions
3. **Jangan ignore errors** - selalu handle dengan proper error UI
4. **Jangan show generic "Error occurred"** - gunakan specific messages

## Error Message Mapping

Semua error codes memiliki mapping ke user-friendly messages:

| Error Code | User Message |
|------------|--------------|
| `UNAUTHORIZED` | "You need to sign in to continue" |
| `VALIDATION_ERROR` | "Please check your input and try again." |
| `NOT_FOUND` | "The requested resource was not found." |
| `SUBSCRIPTION_FEATURE_LOCKED` | "This feature is not available in your current plan. Please upgrade to access it." |
| `SKU_ALREADY_EXISTS` | "This SKU already exists. Please use a different SKU." |
| `INSUFFICIENT_STOCK` | "Insufficient stock available." |
| `INTERNAL_ERROR` | "Something went wrong. Please try again later." |

## Migration Guide

### Before (Old Pattern)

```tsx
// ❌ Old pattern - inconsistent error handling
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await fetch("/api/endpoint", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed");
    }
    return response.json();
  },
  onError: (error) => {
    toast.error(error.message || "An error occurred");
  },
});
```

### After (New Pattern)

```tsx
// ✅ New pattern - consistent error handling
const { handleError, showSuccess } = useErrorHandler();

const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await fetch("/api/endpoint", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw error;
    }
    return response.json();
  },
  onSuccess: () => {
    showSuccess("Operation completed successfully");
  },
  onError: (error) => {
    handleError(error, "Failed to complete operation");
  },
});
```

## Testing Error Handling

```tsx
// Test error handling
const { result } = renderHook(() => useCreateMaterial(storeId));

await act(async () => {
  result.current.mutate(invalidData);
});

await waitFor(() => {
  expect(screen.getByText(/please check your input/i)).toBeInTheDocument();
});
```

## Summary

- ✅ Gunakan `useErrorHandler` hook untuk semua error handling
- ✅ Show user-friendly messages, bukan technical errors
- ✅ Handle validation errors separately di forms
- ✅ Show success messages untuk feedback yang jelas
- ✅ Log errors di development untuk debugging

