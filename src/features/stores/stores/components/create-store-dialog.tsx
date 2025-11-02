"use client";

import { useState } from "react";
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
 */
export function CreateStoreDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { mutate: createStore, isPending } = useCreateStore();

  const handleSubmit = (data: CreateStoreInput) => {
    createStore(data, {
      onSuccess: () => {
        toast.success(t("stores.createSuccess") || "Store created successfully");
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || t("stores.createError") || "Failed to create store");
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
      <DialogContent className="mx-4 max-h-[90vh] overflow-y-auto sm:mx-0 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold sm:text-2xl">
            {t("stores.createStore")}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t("stores.createFirst") || "Create your first store to start managing inventory"}
          </DialogDescription>
        </DialogHeader>
        <StoreForm
          onSubmit={handleSubmit}
          isLoading={isPending}
          submitText={t("actions.save") || "Save"}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
