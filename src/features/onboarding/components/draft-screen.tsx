"use client";

import { useMemo, useState } from "react";
import { Check, CircleAlert, Link2, Loader2, Pencil, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrencyDecimals } from "@/features/pos/lib/currency-decimals";
import { CountrySelect, MarketSummary, getBrowserTimezone } from "@/features/stores/shared";
import type { OnboardingCompleteResult, OnboardingState } from "@/lib/onboarding/contracts";
import { OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import {
  useCompleteOnboarding,
  useSaveStoreStep,
  useSaveStorefrontStep,
} from "../hooks/use-onboarding-steps";
import { useSlugCheck } from "../hooks/use-slug-check";
import { useStepErrorHandler } from "../hooks/use-step-error-handler";
import { ONBOARDING_CONFLICT, conflictReason, conflictSuggestion } from "../lib/onboarding-api";
import { trackOnboardingCompleted, trackStepCompleted } from "../lib/onboarding-analytics";
import { pickRandomThemeColor, sampleMenuItems } from "../lib/onboarding-flow";
import {
  ONBOARDING_MENU_ROWS,
  menuItemsPayload,
  normalizeThemeColor,
  removedItemIds,
} from "../lib/storefront-step-schema";
import {
  isValidStoreSlug,
  normalizeSlugInput,
  slugifyStoreLink,
  storeLinkLabel,
} from "../lib/store-link";
import { MenuPriceInput } from "./menu-price-input";
import { QuestionShell } from "./question-shell";
import { StorefrontPreview } from "./storefront-preview";
import { ThemeColorPicker } from "./theme-color-picker";

interface MenuRow {
  id?: string;
  name: string;
  price?: number;
}

/**
 * The draft's unsaved edits (colour and dishes), kept by the flow rather than
 * this screen, so they survive a trip back to the plan questions.
 */
export interface DraftValues {
  storeId: string | null;
  themeColor: string;
  rows: MenuRow[];
  /** The dishes were edited; until then they are our examples, re-made when the market changes. */
  menuTouched: boolean;
}

export function draftFromState(state: OnboardingState, samples: boolean): DraftValues {
  return {
    storeId: state.storeId,
    themeColor: normalizeThemeColor(state.storefront?.themeColor),
    rows: Array.from({ length: ONBOARDING_MENU_ROWS }, (_, index) => {
      const saved = state.menuItems[index];
      return saved ? { id: saved.id, name: saved.name, price: saved.price } : { name: "" };
    }),
    menuTouched: !samples,
  };
}

export interface DraftScreenProps {
  state: OnboardingState;
  onStateChange: (next: OnboardingState) => void;
  /** The plan the store launches on, as a line of text ("POS, 14-day free trial (no card)"); null hides it. */
  planLabel: string | null;
  onChangePlan?: () => void;
  /** The partner code claimed on the plan screen, credited when publishing. */
  referralCode?: string;
  draft: DraftValues;
  onDraftChange: (update: (current: DraftValues) => DraftValues) => void;
  onBack?: () => void;
  onPublished: (result: OnboardingCompleteResult) => void;
  onStepOrder: () => void;
  direction?: "forward" | "back";
}

/**
 * The last screen: the store as we set it up from the answers, all on one
 * page so a single press launches it. The store link at the top, the
 * storefront preview with a pencil to edit the example dishes, the colour,
 * then the details (market and plan). Each part can be changed in place;
 * "Looks good, launch my store" saves the draft and publishes.
 */
export function DraftScreen({
  state,
  onStateChange,
  planLabel,
  onChangePlan,
  referralCode,
  draft,
  onDraftChange,
  onBack,
  onPublished,
  onStepOrder,
  direction,
}: DraftScreenProps) {
  const { t } = useI18n();
  const saveStore = useSaveStoreStep();
  const saveStorefront = useSaveStorefrontStep();
  const completion = useCompleteOnboarding();
  const handleError = useStepErrorHandler({ onStepOrder });

  const { themeColor, rows, menuTouched } = draft;
  const setThemeColor = (hex: string) => onDraftChange((d) => ({ ...d, themeColor: hex }));
  const [editingMenu, setEditingMenu] = useState(false);
  const [changingCountry, setChangingCountry] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const business = state.business;
  const [country, setCountry] = useState(business?.countryCode ?? "");
  const savedSlug = state.storefront?.slug ?? "";
  const [slug, setSlug] = useState(savedSlug);

  const cleanSlug = slugifyStoreLink(slug);
  const slugChanged = editingLink && cleanSlug !== savedSlug;
  const slugCheck = useSlugCheck(cleanSlug, { enabled: slugChanged && cleanSlug !== "" });
  const slugOk =
    !slugChanged ||
    (isValidStoreSlug(cleanSlug) &&
      slugCheck.status !== "taken" &&
      slugCheck.status !== "checking");

  const currency = state.currency;
  const decimals = getCurrencyDecimals(currency);
  const displayName = business?.name ?? state.storefront?.displayName ?? "";
  const previewItems = useMemo(
    () =>
      rows.filter((row) => row.name.trim()).map((row) => ({ name: row.name, price: row.price })),
    [rows]
  );
  const busy = saveStore.isPending || saveStorefront.isPending || completion.isPending;

  // Step 1 again, with what changed here (the country, or the link).
  const saveStoreWith = (
    over: { countryCode?: string; slug?: string },
    onSaved: (next: OnboardingState) => void
  ) => {
    if (!business) return;
    const browserTimezone = getBrowserTimezone();
    const countryCode = over.countryCode ?? business.countryCode ?? OTHER_COUNTRY_CODE;
    saveStore.mutate(
      {
        name: business.name,
        countryCode,
        ...(business.businessType ? { businessType: business.businessType } : {}),
        ...(countryCode === OTHER_COUNTRY_CODE ? { currency } : {}),
        ...(browserTimezone ? { browserTimezone } : {}),
        ...(over.slug ? { slug: over.slug } : {}),
      },
      {
        onSuccess: (next) => {
          onStateChange(next);
          onSaved(next);
        },
        onError: (error) => {
          if (conflictReason(error) === ONBOARDING_CONFLICT.slugTaken) {
            const suggestion = conflictSuggestion(error);
            toast.error(
              suggestion
                ? t("onboarding.flow.draft.linkTaken").replace("{slug}", suggestion)
                : t("onboarding.store.link.takenOnSave")
            );
            return;
          }
          handleError(error);
        },
      }
    );
  };

  const saveCountry = () => {
    if (!country || country === business?.countryCode) {
      setChangingCountry(false);
      return;
    }
    saveStoreWith({ countryCode: country }, (next) => {
      // Untouched examples are re-priced for the new currency.
      if (!menuTouched) {
        const samples = sampleMenuItems(next.business?.businessType, next.currency, t);
        onDraftChange((d) => ({
          ...d,
          rows: samples.map((sample, index) => ({
            ...(next.menuItems[index] ? { id: next.menuItems[index].id } : {}),
            ...sample,
          })),
        }));
      }
      setChangingCountry(false);
      toast.success(t("onboarding.flow.draft.marketChanged"));
    });
  };

  const saveLink = () => {
    if (!slugChanged) {
      setEditingLink(false);
      return;
    }
    if (!slugOk) return;
    saveStoreWith({ slug: cleanSlug }, () => setEditingLink(false));
  };

  const updateRow = (index: number, patch: Partial<MenuRow>) => {
    onDraftChange((d) => ({
      ...d,
      menuTouched: true,
      rows: d.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const publish = () => {
    const values = rows.map((row) => ({ id: row.id, name: row.name, price: row.price }));
    const removed = removedItemIds(values);
    const items = menuItemsPayload(values);
    saveStorefront.mutate(
      { themeColor, menuItems: items, ...(removed.length > 0 ? { removedItemIds: removed } : {}) },
      {
        onSuccess: () => {
          trackStepCompleted({ step: 2, method: "saved", itemsCount: items.length });
          completion.mutate(referralCode || undefined, {
            onSuccess: (result) => {
              trackOnboardingCompleted();
              onPublished(result);
            },
            onError: (error) => handleError(error, "onboarding.errors.publishFailed"),
          });
        },
        onError: (error) => handleError(error),
      }
    );
  };

  // A link typed but not saved yet goes with the launch.
  const confirm = () => {
    if (slugChanged) saveStoreWith({ slug: cleanSlug }, publish);
    else publish();
  };

  return (
    <QuestionShell
      direction={direction}
      title={t("onboarding.flow.draft.title")}
      subtitle={t("onboarding.flow.draft.subtitle")}
      onSubmit={confirm}
      submitLabel={t("onboarding.flow.draft.confirm")}
      submitIcon="none"
      submitDisabled={changingCountry || !slugOk}
      pending={busy}
      pendingLabel={t("onboarding.flow.draft.publishing")}
      onBack={onBack}
      enterToSubmit={false}
    >
      {/* The store link, prefilled from the name. */}
      <section aria-labelledby="draft-link-label" className="rounded-2xl border p-3">
        <p id="draft-link-label" className="text-muted-foreground px-1 text-xs">
          {t("onboarding.flow.draft.linkTitle")}
        </p>
        {editingLink ? (
          <div className="mt-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                id="draft-slug"
                value={slug}
                onChange={(event) => setSlug(normalizeSlugInput(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveLink();
                  }
                }}
                aria-label={t("onboarding.store.link.inputLabel")}
                className="h-11 min-w-0 flex-1 font-mono"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
              <Button
                type="button"
                onClick={saveLink}
                disabled={busy || !slugOk}
                aria-label={t("onboarding.flow.draft.done")}
                className="size-11 shrink-0 rounded-lg"
              >
                {saveStore.isPending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Check aria-hidden="true" />
                )}
              </Button>
            </div>
            <p
              className="text-muted-foreground flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-xs"
              aria-live="polite"
            >
              {!slugChanged || slugCheck.status === "idle" ? (
                t("onboarding.store.link.hint")
              ) : slugCheck.status === "checking" ? (
                <>
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                  {t("onboarding.store.link.checking")}
                </>
              ) : slugCheck.status === "available" ? (
                <>
                  <Check aria-hidden="true" className="size-3 text-green-600" />
                  {t("onboarding.flow.draft.linkOk")}
                </>
              ) : slugCheck.status === "taken" ? (
                <span className="text-destructive flex flex-wrap items-center gap-1.5">
                  <CircleAlert aria-hidden="true" className="size-3" />
                  {t("onboarding.store.link.taken")}
                  {slugCheck.suggestion ? (
                    <button
                      type="button"
                      className="min-h-10 underline"
                      onClick={() => setSlug(slugCheck.suggestion ?? "")}
                    >
                      {t("onboarding.store.link.useSuggestion").replace(
                        "{slug}",
                        slugCheck.suggestion
                      )}
                    </button>
                  ) : null}
                </span>
              ) : (
                <span className="text-destructive">{t("onboarding.store.link.invalid")}</span>
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="text-muted-foreground ml-1 size-4 shrink-0" />
            <p
              data-testid="draft-link"
              className="min-w-0 flex-1 font-mono text-base font-medium break-all"
            >
              {storeLinkLabel(savedSlug)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setSlug(savedSlug);
                setEditingLink(true);
              }}
              disabled={busy}
              aria-label={t("onboarding.flow.draft.editLink")}
              className="size-10 shrink-0 rounded-lg"
            >
              <Pencil aria-hidden="true" />
            </Button>
          </div>
        )}
      </section>

      {/* The storefront preview; its pencil edits the example dishes. */}
      <div className="relative">
        <StorefrontPreview
          name={displayName}
          tagline={state.storefront?.tagline ?? ""}
          logoUrl={state.storefront?.logoUrl ?? undefined}
          themeColor={themeColor}
          items={previewItems}
          currency={currency}
          variant="compact"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => setEditingMenu((open) => !open)}
          disabled={busy}
          aria-expanded={editingMenu}
          aria-controls="draft-menu-editor"
          aria-label={
            editingMenu ? t("onboarding.flow.draft.done") : t("onboarding.flow.draft.editMenu")
          }
          className="bg-background/90 hover:bg-background absolute top-2 right-2 size-10 rounded-full shadow-sm"
        >
          {editingMenu ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
        </Button>
      </div>

      {editingMenu ? (
        <section id="draft-menu-editor" aria-label={t("onboarding.flow.draft.menu")}>
          <p className="text-muted-foreground mb-2 text-xs">
            {t("onboarding.flow.draft.menuHint")}
          </p>
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="flex items-center gap-2">
                <Input
                  value={row.name}
                  onChange={(event) => updateRow(index, { name: event.target.value })}
                  aria-label={`${t("onboarding.flow.draft.itemName")} ${index + 1}`}
                  maxLength={100}
                  className="h-11 min-w-0 flex-1"
                />
                <MenuPriceInput
                  value={row.price}
                  onChange={(price) => updateRow(index, { price })}
                  decimals={decimals}
                  aria-label={`${t("onboarding.flow.draft.itemPrice")} ${index + 1}`}
                  className="h-11 w-28 shrink-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateRow(index, { name: "", price: undefined })}
                  aria-label={t("onboarding.flow.draft.clear")}
                  className="size-11 shrink-0"
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="draft-color-label" className="space-y-2">
        <p id="draft-color-label" className="text-sm font-semibold">
          {t("onboarding.flow.draft.color")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeColorPicker
            value={themeColor}
            onChange={setThemeColor}
            disabled={busy}
            aria-labelledby="draft-color-label"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setThemeColor(pickRandomThemeColor())}
            disabled={busy}
            aria-label={t("onboarding.flow.shuffle")}
            className="size-11 rounded-full"
          >
            <Shuffle aria-hidden="true" />
          </Button>
        </div>
      </section>

      {/* The details: market and plan. */}
      <section aria-labelledby="draft-details-label" className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="draft-details-label" className="text-sm font-semibold">
            {t("onboarding.flow.draft.market")}
          </h2>
          {changingCountry ? null : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setChangingCountry(true)}
              disabled={busy}
              className="h-10 rounded-lg px-3"
            >
              {t("onboarding.flow.change")}
            </Button>
          )}
        </div>
        {changingCountry ? (
          <div className="space-y-2">
            <label htmlFor="draft-country" className="text-sm font-medium">
              {t("onboarding.flow.draft.country")}
            </label>
            <CountrySelect id="draft-country" value={country} onChange={setCountry} />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={saveCountry}
                disabled={busy || !country}
                className="h-10 rounded-lg"
              >
                {saveStore.isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin" />
                    {t("onboarding.flow.draft.saving")}
                  </>
                ) : (
                  t("onboarding.flow.draft.saveDetails")
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCountry(business?.countryCode ?? "");
                  setChangingCountry(false);
                }}
                disabled={busy}
                className="h-10 rounded-lg"
              >
                {t("onboarding.flow.draft.cancel")}
              </Button>
            </div>
          </div>
        ) : business?.countryCode ? (
          <MarketSummary
            countryCode={business.countryCode}
            currency={currency}
            timezone={business.timezone}
            shortNote
          />
        ) : null}

        {planLabel ? (
          <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{t("onboarding.flow.draft.plan")}</p>
              <p data-testid="draft-plan" className="font-medium">
                {planLabel}
              </p>
            </div>
            {onChangePlan ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onChangePlan}
                disabled={busy}
                className="h-10 shrink-0 rounded-lg px-3"
              >
                {t("onboarding.flow.change")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </QuestionShell>
  );
}
