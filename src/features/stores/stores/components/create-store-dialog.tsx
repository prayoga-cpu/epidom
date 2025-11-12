"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { StoreForm } from "./store-form";
import { useCreateStore } from "../hooks/use-stores";
import { CreateStoreInput } from "@/lib/validation/business.schemas";
import { toast } from "sonner";

/**
 * Dialog for creating a new store
 * Uses shared StoreForm component (DRY principle)
 * Refactored from CreateStoreButton with proper validation and API integration
 *
 * IMPORTANT: Includes debounce to prevent multiple clicks and race conditions
 */
export function CreateStoreDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { mutate: createStore, isPending } = useCreateStore();
  const isSubmittingRef = useRef(false);

  // Reset submitting flag when dialog closes
  useEffect(() => {
    if (!open) {
      isSubmittingRef.current = false;
    }
  }, [open]);

  const handleSubmit = (data: CreateStoreInput) => {
    // Prevent multiple submissions (debounce)
    if (isSubmittingRef.current || isPending) {
      return;
    }

    isSubmittingRef.current = true;

    createStore(data, {
      onSuccess: () => {
        toast.success(t("stores.createSuccess") || "Store created successfully");
        setOpen(false);
        isSubmittingRef.current = false;
        // Form will be reset when dialog closes and reopens
      },
      onError: (error) => {
        toast.error(error.message || t("stores.createError") || "Failed to create store");
        isSubmittingRef.current = false;
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="w-full rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4 md:h-5 md:w-5" />
          {t("stores.createStore")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[500px] sm:h-[90vh]">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-4 pr-10 py-3 sm:px-6 sm:pr-6 sm:py-4">
          <DialogTitle className="text-lg font-bold sm:text-xl md:text-2xl">
            {t("stores.createStore")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base">
            {t("stores.createFirst") || "Create your first store to start managing inventory"}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {open && (
            <StoreForm
              key="create-store-form"
              onSubmit={handleSubmit}
              isLoading={isPending}
              submitText={t("actions.save") || "Save"}
              onCancel={() => setOpen(false)}
              showActions={false}
            />
          )}
        </div>

        {/* Fixed Footer with Actions */}
        <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="create-store-form"
              disabled={isPending || isSubmittingRef.current}
              className="w-full sm:w-auto"
            >
              {isPending || isSubmittingRef.current
                ? t("actions.saving") || "Saving..."
                : t("actions.save") || "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
