"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod, PaymentMarket } from "@prisma/client";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/lang/i18n-provider";
import { toast } from "sonner";
import {
  useUpdateFinanceSettings,
  useUpdateBusinessFinanceSettings,
  type FinanceSettingsFields,
} from "../hooks/use-finance-settings";
import {
  PAYMENT_FEE_DEFAULTS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS_BY_MARKET,
  inferMarket,
} from "@/config/payment-fees.config";
import { CURRENCIES } from "@/lib/constants/currencies";

interface EditFeesAndTaxesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Whether this store currently follows the shared business-wide config. */
  syncedWithBusiness: boolean;
  /** Effective values — already resolved from the business config when synced. */
  settings: FinanceSettingsFields;
  /** Owner-only Pay Later toggle — always store-specific, never resolved from the business config. */
  payLaterEnabled: boolean;
  /** Signals for the "Detect automatically" market suggestion only — never written anywhere. */
  storeCountry?: string | null;
  businessLocale?: string;
}

// Every method except PAY_LATER, which keeps its own dedicated toggle above
// the fee table and is never part of the enable/disable list below.
const PAYMENT_METHODS = (Object.keys(PAYMENT_FEE_DEFAULTS) as PaymentMethod[]).filter(
  (m) => m !== "PAY_LATER"
);

const CURRENCY_OPTIONS: ComboboxOption[] = CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.name}`,
}));

interface FeeRow {
  percent: string; // displayed as whole-number percent, e.g. "0.7"
  flat: string;
}

interface FormValues {
  currency: string;
  market: PaymentMarket;
  syncFinanceWithBusiness: boolean;
  payLaterEnabled: boolean;
  taxEnabled: boolean;
  taxRate: string; // whole-number percent, e.g. "11"
  taxLabel: string;
  taxInclusive: "inclusive" | "exclusive";
  serviceChargeEnabled: boolean;
  serviceChargeRate: string;
  processingFeeEnabled: boolean;
  feeRows: Record<PaymentMethod, FeeRow>;
  /** Which methods POS checkout offers — everything in PAYMENT_METHODS, minus PAY_LATER. */
  enabledMethods: Record<PaymentMethod, boolean>;
}

// Rates are stored server-side with up to 4 decimal places, so as a whole-number
// percent they need at most 2 — .toFixed(4) + Number() rounds away binary-float
// noise (0.007 * 100 === 0.7000000000000001) instead of displaying/round-tripping it.
function rateToPercentString(rate: number): string {
  return String(Number((rate * 100).toFixed(4)));
}

// Inverse of rateToPercentString: rounds to the schema's 4-decimal-place grain so
// the value we send back is an exact multiple of 0.0001, not a float with drift.
function percentStringToRate(percent: string): number {
  return Number(((parseFloat(percent) || 0) / 100).toFixed(4));
}

function buildFeeRows(overrides?: (method: PaymentMethod) => { percent: number; flat: number }) {
  const feeRows = {} as Record<PaymentMethod, FeeRow>;
  for (const method of Object.keys(PAYMENT_FEE_DEFAULTS) as PaymentMethod[]) {
    const rate = overrides?.(method) ?? PAYMENT_FEE_DEFAULTS[method];
    feeRows[method] = { percent: rateToPercentString(rate.percent), flat: String(rate.flat) };
  }
  return feeRows;
}

function buildEnabledMethods(enabled: PaymentMethod[]): Record<PaymentMethod, boolean> {
  const enabledSet = new Set(enabled);
  return Object.fromEntries(PAYMENT_METHODS.map((m) => [m, enabledSet.has(m)])) as Record<
    PaymentMethod,
    boolean
  >;
}

function toFormValues(
  settings: FinanceSettingsFields,
  syncedWithBusiness: boolean,
  payLaterEnabled: boolean
): FormValues {
  return {
    currency: settings.currency,
    market: settings.market,
    syncFinanceWithBusiness: syncedWithBusiness,
    payLaterEnabled,
    taxEnabled: settings.taxEnabled,
    taxRate: rateToPercentString(settings.taxRate),
    taxLabel: settings.taxLabel ?? "",
    taxInclusive: settings.taxInclusive ? "inclusive" : "exclusive",
    serviceChargeEnabled: settings.serviceChargeEnabled,
    serviceChargeRate: rateToPercentString(settings.serviceChargeRate),
    processingFeeEnabled: settings.processingFeeEnabled,
    feeRows: buildFeeRows((method) => settings.feeRates[method] ?? PAYMENT_FEE_DEFAULTS[method]),
    enabledMethods: buildEnabledMethods(settings.enabledPaymentMethods),
  };
}

export function EditFeesAndTaxesDialog({
  open,
  onOpenChange,
  storeId,
  syncedWithBusiness,
  settings,
  payLaterEnabled,
  storeCountry,
  businessLocale,
}: EditFeesAndTaxesDialogProps) {
  const { t } = useI18n();
  const updateStoreSettings = useUpdateFinanceSettings(storeId);
  const updateBusinessSettings = useUpdateBusinessFinanceSettings();
  const isPending = updateStoreSettings.isPending || updateBusinessSettings.isPending;

  const form = useForm<FormValues>({
    defaultValues: toFormValues(settings, syncedWithBusiness, payLaterEnabled),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(settings, syncedWithBusiness, payLaterEnabled));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings, syncedWithBusiness, payLaterEnabled]);

  async function onSubmit(data: FormValues) {
    try {
      const processingFeeOverrides = PAYMENT_METHODS.reduce(
        (acc, method) => {
          const row = data.feeRows[method];
          acc[method] = {
            percent: percentStringToRate(row.percent),
            flat: parseFloat(row.flat) || 0,
          };
          return acc;
        },
        {} as Record<PaymentMethod, { percent: number; flat: number }>
      );
      // PAY_LATER's rate is fixed at zero (see PAYMENT_FEE_DEFAULTS) and isn't
      // editable in this form, but the overrides map is still keyed by every
      // PaymentMethod — carry the shipped default through untouched.
      processingFeeOverrides.PAY_LATER = PAYMENT_FEE_DEFAULTS.PAY_LATER;

      const enabledPaymentMethods = PAYMENT_METHODS.filter((m) => data.enabledMethods[m]);

      const fields = {
        currency: data.currency,
        market: data.market,
        enabledPaymentMethods,
        taxEnabled: data.taxEnabled,
        taxRate: percentStringToRate(data.taxRate),
        taxLabel: data.taxLabel || undefined,
        taxInclusive: data.taxInclusive === "inclusive",
        serviceChargeEnabled: data.serviceChargeEnabled,
        serviceChargeRate: percentStringToRate(data.serviceChargeRate),
        processingFeeEnabled: data.processingFeeEnabled,
        processingFeeOverrides,
      };

      if (data.syncFinanceWithBusiness) {
        // Integrated mode: this store just follows the shared config, and the
        // values entered here are the shared config — write both. Pay Later
        // isn't part of the shared config, so it always goes to the store.
        await updateStoreSettings.mutateAsync({
          syncFinanceWithBusiness: true,
          payLaterEnabled: data.payLaterEnabled,
        });
        await updateBusinessSettings.mutateAsync(fields);
      } else {
        await updateStoreSettings.mutateAsync({
          ...fields,
          syncFinanceWithBusiness: false,
          payLaterEnabled: data.payLaterEnabled,
        });
      }

      toast.success(t("profile.toasts.feesAndTaxesUpdated.title"), {
        description: t("profile.toasts.feesAndTaxesUpdated.description"),
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(t("common.error"), {
        description:
          error instanceof Error ? error.message : t("profile.errors.feesAndTaxesUpdateFailed"),
      });
    }
  }

  const syncFinanceWithBusiness = form.watch("syncFinanceWithBusiness");
  const payLaterEnabledValue = form.watch("payLaterEnabled");
  const taxEnabled = form.watch("taxEnabled");
  const serviceChargeEnabled = form.watch("serviceChargeEnabled");
  const processingFeeEnabled = form.watch("processingFeeEnabled");
  const currency = form.watch("currency");
  const market = form.watch("market");
  const enabledMethods = form.watch("enabledMethods");
  const feeRows = form.watch("feeRows");

  function resetProcessingFeeDefaults() {
    form.setValue("feeRows", buildFeeRows());
    form.setValue("enabledMethods", buildEnabledMethods(PAYMENT_METHODS_BY_MARKET[market]));
  }

  function detectMarket() {
    form.setValue("market", inferMarket({ currency, locale: businessLocale, country: storeCountry }));
  }

  // Always show this market's recommended methods, plus anything the
  // merchant already enabled or customized for a different market — so
  // switching market never silently hides an already-configured method.
  const marketMethods = PAYMENT_METHODS_BY_MARKET[market];
  const extraMethods = PAYMENT_METHODS.filter((method) => {
    if (marketMethods.includes(method)) return false;
    if (enabledMethods[method]) return true;
    const row = feeRows[method];
    const def = PAYMENT_FEE_DEFAULTS[method];
    return row.percent !== rateToPercentString(def.percent) || row.flat !== String(def.flat);
  });
  const visibleMethods = [...marketMethods, ...extraMethods];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("profile.forms.editFeesAndTaxes")}
        description={t("profile.forms.editFeesAndTaxesDescription")}
        maxWidth="2xl"
        footer={
          <FormDialogFooter
            formId="edit-fees-and-taxes-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("profile.actions.save")}
            isPending={isPending}
            variant="full-width"
          />
        }
      >
        <form
          id="edit-fees-and-taxes-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <p className="text-muted-foreground text-xs">
            {t("profile.feesAndTaxes.appliesToNewOrdersOnly")}
          </p>

          <section className="bg-muted/30 space-y-1 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="syncFinanceWithBusiness" className="text-base font-semibold">
                  {t("profile.feesAndTaxes.sync.title")}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t("profile.feesAndTaxes.sync.description")}
                </p>
              </div>
              <Switch
                id="syncFinanceWithBusiness"
                checked={syncFinanceWithBusiness}
                onCheckedChange={(checked) => form.setValue("syncFinanceWithBusiness", checked)}
              />
            </div>
            {syncFinanceWithBusiness && (
              <p className="text-muted-foreground pt-1 text-xs">
                {t("profile.feesAndTaxes.sync.activeNote")}
              </p>
            )}
          </section>

          <Separator />

          {/* Currency + Market */}
          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("profile.feesAndTaxes.currency")}</Label>
                <Combobox
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={(value) => form.setValue("currency", value)}
                  searchPlaceholder={t("profile.feesAndTaxes.currencySearchPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("profile.feesAndTaxes.market.title")}</Label>
                <Select
                  value={market}
                  onValueChange={(value) => form.setValue("market", value as PaymentMarket)}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDONESIA">
                      {t("profile.feesAndTaxes.market.indonesia")}
                    </SelectItem>
                    <SelectItem value="FRANCE">{t("profile.feesAndTaxes.market.france")}</SelectItem>
                    <SelectItem value="INTERNATIONAL">
                      {t("profile.feesAndTaxes.market.international")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-xs">
                {t("profile.feesAndTaxes.market.description")}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={detectMarket}>
                {t("profile.feesAndTaxes.market.detect")}
              </Button>
            </div>
          </section>

          <Separator />

          {/* Pay Later */}
          <section className="space-y-1">
            <div className="flex items-center justify-between gap-4 py-1">
              <div>
                <Label htmlFor="payLaterEnabled" className="text-base font-semibold">
                  {t("profile.feesAndTaxes.payLater.enabled")}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t("profile.feesAndTaxes.payLater.description")}
                </p>
              </div>
              <Switch
                id="payLaterEnabled"
                checked={payLaterEnabledValue}
                onCheckedChange={(checked) => form.setValue("payLaterEnabled", checked)}
              />
            </div>
          </section>

          <Separator />

          {/* Tax */}
          <section className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <Label htmlFor="taxEnabled" className="text-base font-semibold">
                {t("profile.feesAndTaxes.tax.enabled")}
              </Label>
              <Switch
                id="taxEnabled"
                checked={taxEnabled}
                onCheckedChange={(checked) => form.setValue("taxEnabled", checked)}
              />
            </div>
            {taxEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="taxRate">{t("profile.feesAndTaxes.tax.rate")} (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="h-11"
                    {...form.register("taxRate")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="taxLabel">{t("profile.feesAndTaxes.tax.label")}</Label>
                  <Input
                    id="taxLabel"
                    placeholder="PPN 11%"
                    className="h-11"
                    {...form.register("taxLabel")}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>{t("profile.feesAndTaxes.tax.mode")}</Label>
                  <Select
                    value={form.watch("taxInclusive")}
                    onValueChange={(value) =>
                      form.setValue("taxInclusive", value as "inclusive" | "exclusive")
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">
                        {t("profile.feesAndTaxes.tax.inclusive")}
                      </SelectItem>
                      <SelectItem value="exclusive">
                        {t("profile.feesAndTaxes.tax.exclusive")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Service charge */}
          <section className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <Label htmlFor="serviceChargeEnabled" className="text-base font-semibold">
                {t("profile.feesAndTaxes.serviceCharge.enabled")}
              </Label>
              <Switch
                id="serviceChargeEnabled"
                checked={serviceChargeEnabled}
                onCheckedChange={(checked) => form.setValue("serviceChargeEnabled", checked)}
              />
            </div>
            {serviceChargeEnabled && (
              <div className="space-y-1 sm:max-w-[200px]">
                <Label htmlFor="serviceChargeRate">
                  {t("profile.feesAndTaxes.serviceCharge.rate")} (%)
                </Label>
                <Input
                  id="serviceChargeRate"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-11"
                  {...form.register("serviceChargeRate")}
                />
              </div>
            )}
          </section>

          <Separator />

          {/* Processing fees */}
          <section className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <Label htmlFor="processingFeeEnabled" className="text-base font-semibold">
                {t("profile.feesAndTaxes.processingFee.enabled")}
              </Label>
              <Switch
                id="processingFeeEnabled"
                checked={processingFeeEnabled}
                onCheckedChange={(checked) => form.setValue("processingFeeEnabled", checked)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {t("profile.feesAndTaxes.processingFee.estimateDisclaimer")}
            </p>
            {processingFeeEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {t("profile.feesAndTaxes.processingFee.enableHint")}
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={resetProcessingFeeDefaults}>
                    {t("profile.feesAndTaxes.processingFee.resetDefaults")}
                  </Button>
                </div>
                <div className="-mx-4 overflow-x-auto sm:mx-0">
                  <div className="min-w-[480px] space-y-2 px-4 sm:px-0">
                    <div className="text-muted-foreground grid grid-cols-[40px_1fr_100px_120px] gap-2 text-xs font-medium">
                      <span />
                      <span>{t("common.method") ?? "Method"}</span>
                      <span>{t("profile.feesAndTaxes.processingFee.percent")}</span>
                      <span>{t("profile.feesAndTaxes.processingFee.flat")}</span>
                    </div>
                    {visibleMethods.map((method) => (
                      <div
                        key={method}
                        className="grid grid-cols-[40px_1fr_100px_120px] items-center gap-2"
                      >
                        <Switch
                          checked={enabledMethods[method]}
                          onCheckedChange={(checked) =>
                            form.setValue(`enabledMethods.${method}`, checked)
                          }
                        />
                        <span className="text-sm">{PAYMENT_METHOD_LABELS[method]}</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-10"
                          {...form.register(`feeRows.${method}.percent`)}
                        />
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          className="h-10"
                          {...form.register(`feeRows.${method}.flat`)}
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-[40px_1fr_100px_120px] items-center gap-2 opacity-70">
                      <span />
                      <span className="text-sm">{PAYMENT_METHOD_LABELS.PAY_LATER}</span>
                      <Input type="number" value="0" disabled className="h-10" />
                      <Input type="number" value="0" disabled className="h-10" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
