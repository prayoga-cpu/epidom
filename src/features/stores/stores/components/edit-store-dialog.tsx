"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EDIT_STORE_FORM_ID, StoreForm } from "./store-form";
import { Store, useUpdateStore } from "../hooks/use-stores";
import { CreateStoreInput } from "@/lib/validation/business.schemas";
import { useI18n } from "@/components/lang/i18n-provider";
import { toast } from "sonner";

interface EditStoreDialogProps {
  store: Store;
  /**
   * Custom trigger element (optional)
   * If not provided, uses default Edit button with icon
   */
  trigger?: React.ReactNode;
}

/**
 * Dialog for editing an existing store: the same StoreForm in edit mode.
 * The country picker is pre-filled from the stored country; text the list
 * doesn't recognise is kept (and shown) until the owner picks a country.
 * Currency and payments are not edited here (Profile → Fees & Taxes).
 */
export function EditStoreDialog({ store, trigger }: EditStoreDialogProps) {
  const [open, setOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const { t } = useI18n();
  const { mutate: updateStore, isPending } = useUpdateStore(store.id);
  // One dialog per store card: keep the form id unique on the page.
  const formId = `${EDIT_STORE_FORM_ID}-${store.id}`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setIsImageUploading(false);
  };

  const handleSubmit = (data: CreateStoreInput) => {
    updateStore(data, {
      onSuccess: () => {
        toast.success(t("stores.editSuccess"));
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || t("stores.editError"));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            {t("actions.edit")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden p-0 sm:max-w-[550px]">
        {/* Fixed Header */}
        <DialogHeader className="border-border shrink-0 border-b px-4 py-3 pr-10 sm:px-6 sm:py-4 sm:pr-6">
          <DialogTitle className="text-lg font-bold sm:text-xl md:text-2xl">
            {t("stores.editStore")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base">
            {t("stores.editDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          <StoreForm
            mode="edit"
            formId={formId}
            defaultValues={store}
            onSubmit={handleSubmit}
            isLoading={isPending}
            onCancel={() => handleOpenChange(false)}
            showActions={false}
            onUploadStateChange={setIsImageUploading}
          />
        </div>

        {/* Fixed Footer with Actions */}
        <div className="border-border shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex gap-2 sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="min-h-10 flex-1 sm:flex-none"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={isPending || isImageUploading}
              className="min-h-10 flex-1 sm:flex-none"
            >
              {isPending
                ? t("actions.saving")
                : isImageUploading
                  ? t("stores.form.uploadingImage")
                  : t("stores.updateStore")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
