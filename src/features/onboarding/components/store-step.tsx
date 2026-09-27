"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Instagram, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  STORE_NAME_MAX_LENGTH,
  StoreEssentialsFields,
  getBrowserTimezone,
  storeEssentialsDefaultValues,
  storeEssentialsPayload,
} from "@/features/stores/shared";
import type { OnboardingState, SlugCheckResult } from "@/lib/onboarding/contracts";
import { OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import { cn } from "@/lib/utils";
import { useSaveStoreStep } from "../hooks/use-onboarding-steps";
import { slugCheckKey } from "../hooks/use-slug-check";
import { useStepErrorHandler } from "../hooks/use-step-error-handler";
import { trackStepCompleted } from "../lib/onboarding-analytics";
import {
  ONBOARDING_CONFLICT,
  conflictReason,
  conflictSuggestion,
  type SaveStoreStepBody,
} from "../lib/onboarding-api";
import {
  extrasFromInstagram,
  slugFromInstagram,
  type InstagramPrefill,
} from "../lib/instagram-prefill";
import { slugifyStoreLink } from "../lib/store-link";
import {
  createStoreStepSchema,
  type StoreStepFormInput,
  type StoreStepFormValues,
} from "../lib/store-step-schema";
import { InstagramImportDialog } from "./instagram-import-dialog";
import { StoreLinkField } from "./store-link-field";
import {
  PRIMARY_BUTTON_CLASS,
  StepBody,
  StepHeading,
  WizardActions,
  WizardProgress,
} from "./wizard-frame";

/** Step 1's form values from what the server saved (a resumed or revisited step). */
export function storeStepDefaults(state: OnboardingState): StoreStepFormInput {
  const business = state.business;
  const savedSlug = state.storefront?.slug ?? null;
  const savedName = business?.name ?? state.storefront?.displayName ?? "";
  // A saved link that isn't simply the name's is one the owner (or a taken
  // name) chose: show it in the link input rather than hide it behind the preview.
  const customised = !!savedSlug && savedSlug !== slugifyStoreLink(savedName);

  return {
    ...storeEssentialsDefaultValues({
      name: savedName,
      countryCode: business?.countryCode ?? "",
      city: business?.city ?? "",
      businessType: business?.businessType ?? undefined,
      currency: business?.countryCode === OTHER_COUNTRY_CODE ? state.currency : undefined,
    }),
    editLink: customised,
    slug: customised && savedSlug ? savedSlug : "",
    useNameLink: false,
  };
}

export interface StoreStepProps {
  state: OnboardingState;
  /** Reached with Back rather than on arrival: focus the heading, not the name. */
  focusHeading: boolean;
  onSaved: (next: OnboardingState) => void;
}

/**
 * Step 1, "Your store": name (with the live store link under it), country
 * (which sets the currency, payment market, timezone and language), city and
 * type of place. "Fill from Instagram" is an optional shortcut that pre-fills
 * the form and adds the storefront details it found to the same save.
 */
export function StoreStep({ state, focusHeading, onSaved }: StoreStepProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const schema = useMemo(() => createStoreStepSchema(t), [t]);
  const form = useForm<StoreStepFormInput, unknown, StoreStepFormValues>({
    resolver: zodResolver(schema),
    defaultValues: storeStepDefaults(state),
  });
  const [prefill, setPrefill] = useState<InstagramPrefill | null>(null);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const mutation = useSaveStoreStep();
  const handleError = useStepErrorHandler();
  const pending = mutation.isPending;

  const savedSlug = state.storefront?.slug ?? null;
  const savedName = state.business?.name ?? state.storefront?.displayName ?? null;

  const applyPrefill = (next: InstagramPrefill) => {
    setPrefill(next);
    setInstagramOpen(false);
    const name = next.name.trim().slice(0, STORE_NAME_MAX_LENGTH);
    if (name) {
      form.setValue("name", name, {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
    }
    const slug = slugFromInstagram(next);
    if (slug) {
      form.setValue("slug", slug, { shouldDirty: true });
      form.setValue("editLink", true, { shouldDirty: true });
      form.setValue("useNameLink", false);
    }
    toast.success(t("onboarding.store.instagramApplied"));
  };

  const onSubmit = form.handleSubmit((values) => {
    const browserTimezone = getBrowserTimezone();
    const body: SaveStoreStepBody = {
      ...storeEssentialsPayload(values),
      ...(browserTimezone ? { browserTimezone } : {}),
      ...(values.editLink
        ? { slug: slugifyStoreLink(values.slug) }
        : values.useNameLink
          ? { slugFromName: true }
          : {}),
      ...extrasFromInstagram(prefill),
    };

    mutation.mutate(body, {
      onSuccess: (next) => {
        trackStepCompleted({ step: 1, method: prefill ? "instagram" : "manual" });
        onSaved(next);
      },
      onError: (error) => {
        if (conflictReason(error) === ONBOARDING_CONFLICT.slugTaken) {
          // Taken between the check and the save: show it as taken, with the
          // free link the server found, right where the link is edited.
          const slug = body.slug ?? slugifyStoreLink(values.name);
          const result: SlugCheckResult = {
            slug,
            available: false,
            suggestion: conflictSuggestion(error),
          };
          queryClient.setQueryData(slugCheckKey(slug), result);
          form.setValue("slug", slug);
          form.setValue("editLink", true);
          toast.error(t("onboarding.store.link.takenOnSave"));
          return;
        }
        handleError(error);
      },
    });
  });

  return (
    <>
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <WizardProgress step={1} />
          <StepBody>
            <StepHeading
              title={t("onboarding.store.title")}
              subtitle={t("onboarding.store.subtitle")}
              focusOnMount={focusHeading}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInstagramOpen(true)}
                  disabled={pending}
                  className="h-10 w-full rounded-xl sm:w-auto"
                >
                  <Instagram aria-hidden="true" />
                  {t("onboarding.store.instagramCta")}
                </Button>
              }
            />

            {prefill ? (
              <p
                role="status"
                className="rounded-lg border border-[var(--epi-gold-500)]/40 bg-[var(--epi-gold-500)]/10 px-3 py-2 text-sm"
              >
                {t("onboarding.store.instagramNote")}
              </p>
            ) : null}

            {/*
              The store link belongs right under the name it is built from.
              <StoreEssentialsFields> renders name → country → city → type as
              one block, so its wrapper is display:contents and the fields
              become items of this column: the first (name) keeps order 0, the
              link takes order 1, every later field order 2.
            */}
            <div className="flex flex-col gap-1 [&>.store-essentials>*]:order-2 [&>.store-essentials>*:first-child]:order-none">
              <StoreEssentialsFields
                className="store-essentials contents"
                autoFocusName={!focusHeading}
                disabled={pending}
              />
              <StoreLinkField
                className="order-1 mb-4"
                savedSlug={savedSlug}
                savedName={savedName}
                disabled={pending}
              />
            </div>
          </StepBody>
          <WizardActions>
            <Button
              type="submit"
              disabled={pending}
              className={cn(PRIMARY_BUTTON_CLASS, "min-w-0 flex-1 sm:min-w-40 sm:flex-none")}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {t("onboarding.actions.saving")}
                </>
              ) : (
                <>
                  {t("onboarding.actions.continue")}
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </WizardActions>
        </form>
      </Form>
      <InstagramImportDialog
        open={instagramOpen}
        onOpenChange={setInstagramOpen}
        onComplete={applyPrefill}
      />
    </>
  );
}
