"use client";

import { useId, useMemo, useState } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/shared/image-upload";
import { UpgradeGateProvider } from "@/features/billing/upgrade/upgrade-modal";
import { getCurrencyDecimals } from "@/features/pos/lib/currency-decimals";
import type { OnboardingState } from "@/lib/onboarding/contracts";
import { examplePrices } from "@/lib/onboarding/markets";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";
import { useSaveStorefrontStep } from "../hooks/use-onboarding-steps";
import { useStepErrorHandler } from "../hooks/use-step-error-handler";
import { trackStepCompleted } from "../lib/onboarding-analytics";
import {
  ONBOARDING_MENU_ROWS,
  TAGLINE_MAX_LENGTH,
  createStorefrontStepSchema,
  storefrontDraftDefaults,
  storefrontPayload,
  storefrontStepDefaults,
  type StorefrontDraft,
  type StorefrontStepFormInput,
  type StorefrontStepFormValues,
} from "../lib/storefront-step-schema";
import { CsvImportEntry } from "./csv-import-entry";
import { MenuPriceInput } from "./menu-price-input";
import { StorefrontPreview } from "./storefront-preview";
import { ThemeColorPicker } from "./theme-color-picker";
import {
  PRIMARY_BUTTON_CLASS,
  StepBody,
  StepHeading,
  WizardActions,
  WizardProgress,
} from "./wizard-frame";

export interface StorefrontStepProps {
  state: OnboardingState;
  onSaved: (next: OnboardingState) => void;
  /**
   * Back to step 1, with the unsaved input so it can come back. No Back
   * button when absent (setup already complete: step 1 can't be saved again).
   */
  onBack?: (draft: StorefrontDraft) => void;
  /** What the owner had typed here before going Back (see storefrontDraftDefaults). */
  draft?: StorefrontDraft | null;
  /** The server says step 1 isn't saved (e.g. the store was deleted meanwhile). */
  onStepOrder: () => void;
}

type PendingAction = "save" | "skip" | null;

/**
 * Step 2, "Your storefront": logo, theme colour, tagline and up to three
 * dishes priced in the store's currency, with a live preview (beside the form
 * on large screens, a compact card on phones). Everything is optional:
 * "Skip for now" still saves the step so the wizard moves on.
 */
export function StorefrontStep({
  state,
  onSaved,
  onBack,
  draft,
  onStepOrder,
}: StorefrontStepProps) {
  const { t } = useI18n();
  const schema = useMemo(() => createStorefrontStepSchema(t), [t]);
  // What the server had when the step opened: a draft is compared with it
  // to tell the fields the owner changed from the ones they didn't.
  const [serverDefaults] = useState(() => storefrontStepDefaults(state));
  const [initialValues] = useState(() => storefrontDraftDefaults(state, draft));
  const form = useForm<StorefrontStepFormInput, unknown, StorefrontStepFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });
  const mutation = useSaveStorefrontStep();
  const handleError = useStepErrorHandler({ onStepOrder });
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isUploading, setIsUploading] = useState(false);
  const themeLabelId = useId();
  const busy = mutation.isPending || isUploading;

  const onSaveSuccess = (next: OnboardingState) => onSaved(next);

  const onSubmit = form.handleSubmit((values) => {
    const body = storefrontPayload(values);
    setPendingAction("save");
    mutation.mutate(body, {
      onSuccess: (next) => {
        trackStepCompleted({ step: 2, method: "saved", itemsCount: body.menuItems.length });
        onSaveSuccess(next);
      },
      onError: (error) => handleError(error),
      onSettled: () => setPendingAction(null),
    });
  });

  const skip = () => {
    setPendingAction("skip");
    mutation.mutate(
      {},
      {
        onSuccess: (next) => {
          trackStepCompleted({ step: 2, method: "skipped", itemsCount: 0 });
          onSaveSuccess(next);
        },
        onError: (error) => handleError(error),
        onSettled: () => setPendingAction(null),
      }
    );
  };

  const storeName = state.business?.name ?? state.storefront?.displayName ?? "";

  return (
    <UpgradeGateProvider>
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <WizardProgress step={2} />
          <StepBody>
            <StepHeading
              title={t("onboarding.storefront.title")}
              subtitle={t("onboarding.storefront.subtitle")}
              focusOnMount
            />

            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
              <div className="min-w-0 space-y-6">
                <div className="grid gap-6 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem className="content-start">
                        <FormLabel>
                          {t("onboarding.storefront.logo.label")}{" "}
                          <span className="text-muted-foreground font-normal">
                            {t("storeEssentials.optionalSuffix")}
                          </span>
                        </FormLabel>
                        <div className="w-28 sm:w-32">
                          {/* deletePrevious off: the saved logo stays in storage
                              until a save replaces it (Skip and Back save
                              nothing); the server deletes the old file then. */}
                          <ImageUpload
                            value={field.value}
                            onChange={(url) => field.onChange(url)}
                            onUploadStateChange={setIsUploading}
                            aspectRatio="1/1"
                            compact
                            deletePrevious={false}
                            disabled={mutation.isPending}
                          />
                        </div>
                        <FormDescription className="text-xs">
                          {t("onboarding.storefront.logo.hint")}
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="min-w-0 space-y-6">
                    <FormField
                      control={form.control}
                      name="themeColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel id={themeLabelId}>
                            {t("onboarding.storefront.theme.label")}
                          </FormLabel>
                          <ThemeColorPicker
                            aria-labelledby={themeLabelId}
                            value={field.value}
                            onChange={field.onChange}
                            disabled={mutation.isPending}
                          />
                          <FormMessage className="min-h-0" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tagline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("onboarding.storefront.tagline.label")}{" "}
                            <span className="text-muted-foreground font-normal">
                              {t("storeEssentials.optionalSuffix")}
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              maxLength={TAGLINE_MAX_LENGTH}
                              placeholder={t("onboarding.storefront.tagline.placeholder")}
                              disabled={mutation.isPending}
                              className="h-11"
                            />
                          </FormControl>
                          <div className="flex items-start justify-between gap-2">
                            <FormMessage className="min-h-0" />
                            <span
                              aria-hidden="true"
                              className="text-muted-foreground ml-auto text-xs tabular-nums"
                            >
                              {`${(field.value ?? "").length}/${TAGLINE_MAX_LENGTH}`}
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <MenuRows
                  control={form.control}
                  currency={state.currency}
                  disabled={mutation.isPending}
                />

                {state.storeId ? (
                  <div className="flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">
                      {t("onboarding.storefront.menu.importPrompt")}
                    </p>
                    <CsvImportEntry storeId={state.storeId} disabled={mutation.isPending} />
                  </div>
                ) : null}
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-6">
                  <LivePreview
                    control={form.control}
                    state={state}
                    storeName={storeName}
                    variant="phone"
                  />
                </div>
              </aside>
            </div>

            <LivePreview
              control={form.control}
              state={state}
              storeName={storeName}
              variant="compact"
              className="lg:hidden"
            />
          </StepBody>

          <WizardActions
            onBack={
              onBack
                ? () =>
                    onBack({
                      base: serverDefaults,
                      values: form.getValues(),
                      currency: state.currency,
                    })
                : undefined
            }
            // Not while a logo uploads either: its URL would be lost.
            backDisabled={busy}
            secondary={
              <Button
                type="button"
                variant="ghost"
                onClick={skip}
                disabled={busy}
                className="h-11 min-w-0 shrink rounded-xl px-3"
              >
                {pendingAction === "skip" ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : null}
                <span className="truncate">{t("onboarding.actions.skip")}</span>
              </Button>
            }
          >
            <Button
              type="submit"
              disabled={busy}
              className={cn(PRIMARY_BUTTON_CLASS, "min-w-0 flex-1 sm:min-w-40 sm:flex-none")}
            >
              {pendingAction === "save" ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  <span className="truncate">{t("onboarding.actions.saving")}</span>
                </>
              ) : (
                <>
                  <span className="truncate">{t("onboarding.actions.continue")}</span>
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </WizardActions>
        </form>
      </Form>
    </UpgradeGateProvider>
  );
}

function LivePreview({
  control,
  state,
  storeName,
  variant,
  className,
}: {
  control: Control<StorefrontStepFormInput, unknown, StorefrontStepFormValues>;
  state: OnboardingState;
  storeName: string;
  variant: "phone" | "compact";
  className?: string;
}) {
  const [logoUrl, themeColor, tagline, menuItems] = useWatch({
    control,
    name: ["logoUrl", "themeColor", "tagline", "menuItems"],
  });
  return (
    <StorefrontPreview
      variant={variant}
      className={className}
      name={storeName}
      tagline={tagline ?? ""}
      logoUrl={logoUrl}
      themeColor={themeColor}
      currency={state.currency}
      items={(menuItems ?? []).map((item) => ({ name: item?.name ?? "", price: item?.price }))}
    />
  );
}

const DISH_EXAMPLE_KEYS = [
  "onboarding.storefront.menu.examples.item1",
  "onboarding.storefront.menu.examples.item2",
  "onboarding.storefront.menu.examples.item3",
] as const;

/** Three rows of dish name + price, the price in the store's currency with its decimals. */
function MenuRows({
  control,
  currency,
  disabled,
}: {
  control: Control<StorefrontStepFormInput, unknown, StorefrontStepFormValues>;
  currency: string;
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const legendId = useId();
  const decimals = getCurrencyDecimals(currency);
  const symbol = getCurrencySymbol(currency);
  const examples = examplePrices(currency);
  const numberFormat = new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return (
    <fieldset aria-labelledby={legendId} className="min-w-0 space-y-3">
      <div className="space-y-1">
        <p id={legendId} className="text-sm leading-none font-medium">
          {t("onboarding.storefront.menu.label")}{" "}
          <span className="text-muted-foreground font-normal">
            {t("storeEssentials.optionalSuffix")}
          </span>
        </p>
        <p className="text-muted-foreground text-xs">{t("onboarding.storefront.menu.hint")}</p>
      </div>

      <div
        aria-hidden="true"
        className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_10rem]"
      >
        <span>{t("onboarding.storefront.menu.nameColumn")}</span>
        <span>{t("onboarding.storefront.menu.priceColumn").replace("{currency}", currency)}</span>
      </div>

      {Array.from({ length: ONBOARDING_MENU_ROWS }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]"
        >
          <FormField
            control={control}
            name={`menuItems.${index}.name`}
            render={({ field, fieldState }) => (
              <FormItem className="min-w-0 gap-1">
                <FormLabel className="sr-only">
                  {t("onboarding.storefront.menu.itemName").replace("{n}", String(index + 1))}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={t(DISH_EXAMPLE_KEYS[index])}
                    maxLength={100}
                    disabled={disabled}
                    className="h-11"
                  />
                </FormControl>
                {fieldState.error ? <FormMessage className="min-h-0 text-xs" /> : null}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`menuItems.${index}.price`}
            render={({ field, fieldState }) => (
              <FormItem className="min-w-0 gap-1">
                <FormLabel className="sr-only">
                  {t("onboarding.storefront.menu.itemPrice").replace("{n}", String(index + 1))}
                </FormLabel>
                <div
                  className={cn(
                    "bg-background focus-within:border-ring focus-within:ring-ring/50 flex h-11 min-w-0 items-center rounded-md border shadow-xs focus-within:ring-[3px] dark:bg-transparent",
                    fieldState.invalid && "border-destructive"
                  )}
                >
                  <span aria-hidden="true" className="text-muted-foreground shrink-0 pl-3 text-sm">
                    {symbol}
                  </span>
                  <FormControl>
                    <MenuPriceInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      decimals={decimals}
                      min={0}
                      placeholder={numberFormat.format(examples[index])}
                      disabled={disabled}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-right tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent"
                    />
                  </FormControl>
                </div>
                {fieldState.error ? <FormMessage className="min-h-0 text-xs" /> : null}
              </FormItem>
            )}
          />
        </div>
      ))}
    </fieldset>
  );
}
