"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { CREATE_STORE_FORM_ID, StoreForm } from "./store-form";
import { useCreateStore, useStores } from "../hooks/use-stores";
import { CreateStoreInput } from "@/lib/validation/business.schemas";
import { toast } from "sonner";

export interface CreateStoreDialogProps {
  /** The business's own country (free text), a default for the country picker. */
  businessCountry?: string | null;
  /** The business timezone, shown in the market summary (shared by every store). */
  businessTimezone?: string | null;
  /**
   * Each store's current currency by id (GET /api/stores/overview), so the
   * copy switch can warn when the store it copies uses another currency.
   */
  sourceCurrencyById?: Readonly<Record<string, string>>;
}

/**
 * "Create a store" on Your Stores. Asks the essentials first (name, country,
 * city, where the currency & payment settings come from) and tucks the image,
 * address, phone and email under "More details". On success it opens the new
 * store's Back Office dashboard, where the Getting-started checklist is.
 *
 * IMPORTANT: Includes debounce to prevent multiple clicks and race conditions
 */
export function CreateStoreDialog({
  businessCountry,
  businessTimezone,
  sourceCurrencyById,
}: CreateStoreDialogProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  // Same query as the page's list (shared cache): the copy sources and default country.
  const { data: stores } = useStores();
  const ownedStores = useMemo(
    () => (stores ?? []).filter((store) => store.accessRole !== "staff"),
    [stores]
  );
  const hasStores = ownedStores.length > 0;
  const { mutate: createStore, isPending } = useCreateStore();
  const isSubmittingRef = useRef(false);

  // Reset submitting flag when dialog closes
  useEffect(() => {
    if (!open) {
      isSubmittingRef.current = false;
      setIsImageUploading(false);
    }
  }, [open]);

  const handleSubmit = (data: CreateStoreInput) => {
    // Prevent multiple submissions (debounce)
    if (isSubmittingRef.current || isPending) {
      return;
    }

    isSubmittingRef.current = true;

    createStore(data, {
      onSuccess: (store) => {
        toast.success(t("stores.createSuccess"));
        setOpen(false);
        isSubmittingRef.current = false;
        // The new store's dashboard shows its Getting-started checklist.
        router.push(`/store/${store.id}/dashboard`);
      },
      onError: (error) => {
        // The server's reason (name taken, store limit…) when there is one.
        toast.error(error.message || t("stores.createError"));
        isSubmittingRef.current = false;
      },
    });
  };

  const busy = isPending || isSubmittingRef.current;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}
          className="w-full rounded-full px-4 py-2.5 text-xs font-semibold shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4 md:h-5 md:w-5" />
          {t("stores.createStore")}
        </Button>
      </DialogTrigger>
      {/* Fits its content (the essentials are short; "More details" grows it) up to 90dvh. */}
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden p-0 sm:max-w-[550px]">
        {/* Fixed Header */}
        <DialogHeader className="border-border shrink-0 border-b px-4 py-3 pr-10 sm:px-6 sm:py-4 sm:pr-6">
          <DialogTitle className="text-lg font-bold sm:text-xl md:text-2xl">
            {t("stores.createStore")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base">
            {hasStores ? t("stores.createSubtitleAnother") : t("stores.createSubtitleFirst")}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {open && (
            <StoreForm
              key="create-store-form"
              mode="create"
              formId={CREATE_STORE_FORM_ID}
              existingStores={ownedStores}
              businessCountry={businessCountry}
              businessTimezone={businessTimezone}
              sourceCurrencyById={sourceCurrencyById}
              onSubmit={handleSubmit}
              isLoading={isPending}
              onCancel={() => setOpen(false)}
              showActions={false}
              onUploadStateChange={setIsImageUploading}
            />
          )}
        </div>

        {/* Fixed Footer with Actions */}
        <div className="border-border shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex gap-2 sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="min-h-10 flex-1 sm:flex-none"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              form={CREATE_STORE_FORM_ID}
              disabled={busy || isImageUploading}
              className="min-h-10 flex-1 sm:flex-none"
            >
              {busy
                ? t("stores.form.creating")
                : isImageUploading
                  ? t("stores.form.uploadingImage")
                  : t("stores.form.submitCreate")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
