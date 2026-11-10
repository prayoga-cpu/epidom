"use client";

import { useState } from "react";
import { Instagram } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORE_NAME_MAX_LENGTH } from "@/features/stores/shared";
import { BUSINESS_TYPE_ICONS } from "@/features/stores/shared/business-type-picker";
import {
  BUSINESS_TYPES,
  OTHER_COUNTRY_CODE,
  countryDisplayName,
  countryFlag,
  isBusinessType,
  resolveMarketDefaults,
  type BusinessType,
} from "@/lib/onboarding/markets";
import { cn } from "@/lib/utils";
import { firstNameOf } from "../lib/onboarding-flow";
import type { InstagramPrefill } from "../lib/instagram-prefill";
import { InstagramImportDialog } from "./instagram-import-dialog";
import { QuestionShell, QuietButton } from "./question-shell";

interface CommonProps {
  skipping?: boolean;
  /** Setup can still be skipped from here (nothing is saved yet). */
  onSkip?: () => void;
  direction?: "forward" | "back";
}

/**
 * Question 1: "Welcome, Sam! Registered as sam@…" and what the store is
 * called. "Fill from Instagram" is a quiet shortcut under the answer.
 */
export function NameStep({
  user,
  greet = true,
  value,
  onChange,
  onPrefill,
  countryCode,
  onSubmit,
  onBack,
  onSkip,
  skipping = false,
  direction,
}: CommonProps & {
  user: { name: string | null; email: string };
  /** First screen of the flow: "Welcome, Sam!" above the question. Off when the plan screen already greeted. */
  greet?: boolean;
  /** Back to the plan screen (absent when this is the first screen). */
  onBack?: () => void;
  value: string;
  onChange: (name: string) => void;
  onPrefill: (prefill: InstagramPrefill) => void;
  /** The country we guessed from the device (or the saved store's). */
  countryCode: string | undefined;
  onSubmit: () => void;
}) {
  const { t, locale } = useI18n();
  const [touched, setTouched] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const invalid = value.trim().length < 2;
  const market =
    countryCode && countryCode !== OTHER_COUNTRY_CODE
      ? resolveMarketDefaults({ countryCode })
      : null;

  return (
    <>
      <QuestionShell
        direction={direction}
        eyebrow={
          greet ? t("onboarding.flow.welcome.registered").replace("{email}", user.email) : undefined
        }
        title={
          greet
            ? t("onboarding.flow.welcome.greeting").replace(
                "{name}",
                firstNameOf(user.name, user.email)
              )
            : t("onboarding.flow.welcome.question")
        }
        onBack={onBack}
        onSubmit={() => {
          setTouched(true);
          if (!invalid) onSubmit();
        }}
        submitLabel={t("onboarding.actions.continue")}
        submitIcon="arrow"
        submitDisabled={skipping}
        focusTitle={false}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <QuietButton onClick={() => setInstagramOpen(true)} disabled={skipping}>
              <Instagram aria-hidden="true" />
              {t("onboarding.store.instagramCta")}
            </QuietButton>
            {onSkip ? (
              <QuietButton onClick={onSkip} disabled={skipping} busy={skipping}>
                {t("onboarding.actions.skipSetup")}
              </QuietButton>
            ) : null}
          </div>
        }
      >
        {greet ? (
          <label htmlFor="store-name" className="text-foreground block text-lg font-medium">
            {t("onboarding.flow.welcome.question")}
          </label>
        ) : null}
        <Input
          id="store-name"
          aria-label={greet ? undefined : t("onboarding.flow.welcome.question")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("onboarding.flow.welcome.placeholder")}
          maxLength={STORE_NAME_MAX_LENGTH}
          autoComplete="organization"
          autoFocus
          disabled={skipping}
          aria-invalid={touched && invalid ? true : undefined}
          className={cn(
            "h-14 rounded-none border-0 border-b-2 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 sm:text-3xl dark:bg-transparent",
            touched && invalid ? "border-destructive" : "focus-visible:border-[var(--epi-gold-500)]"
          )}
        />
        {touched && invalid ? (
          <p role="alert" className="text-destructive text-sm">
            {t("storeEssentials.validation.nameRequired")}
          </p>
        ) : null}
        {prefilled ? (
          <p role="status" className="text-muted-foreground text-xs">
            {t("onboarding.store.instagramNote")}
          </p>
        ) : null}
        {market ? (
          <p className="text-muted-foreground text-sm" data-testid="detected-market">
            {t("onboarding.flow.welcome.detected")
              .replace("{flag}", countryFlag(market.countryCode))
              .replace("{country}", countryDisplayName(market.countryCode, locale))
              .replace("{currency}", market.currency)}
          </p>
        ) : null}
      </QuestionShell>

      <InstagramImportDialog
        open={instagramOpen}
        onOpenChange={setInstagramOpen}
        onComplete={(next) => {
          setInstagramOpen(false);
          setPrefilled(true);
          onPrefill(next);
          if (next.name.trim()) onChange(next.name.trim().slice(0, STORE_NAME_MAX_LENGTH));
        }}
      />
    </>
  );
}

/** Question 2: the kind of place: a plain dropdown (short list, so no search box and no phone keyboard). */
export function TypeStep({
  value,
  onChange,
  storeName,
  onSubmit,
  onBack,
  onSkip,
  skipping = false,
  pending = false,
  direction,
}: CommonProps & {
  value: BusinessType | null;
  onChange: (type: BusinessType | null) => void;
  storeName: string;
  onSubmit: () => void;
  onBack: () => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  return (
    <QuestionShell
      direction={direction}
      title={t("onboarding.flow.welcome.type")}
      eyebrow={storeName}
      onSubmit={onSubmit}
      submitLabel={t("onboarding.actions.continue")}
      submitIcon="arrow"
      submitDisabled={skipping}
      pending={pending}
      pendingLabel={t("onboarding.flow.draft.settingUp")}
      onBack={onBack}
      footer={
        onSkip ? (
          <QuietButton onClick={onSkip} disabled={skipping || pending} busy={skipping}>
            {t("onboarding.actions.skipSetup")}
          </QuietButton>
        ) : null
      }
    >
      <Select
        value={value ?? undefined}
        onValueChange={(next) => onChange(isBusinessType(next) ? next : null)}
        disabled={skipping || pending}
      >
        <SelectTrigger
          id="store-type"
          aria-label={t("onboarding.flow.welcome.type")}
          className="h-14 w-full rounded-xl text-lg"
        >
          <SelectValue placeholder={t("onboarding.flow.welcome.typePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {BUSINESS_TYPES.map((type) => {
            const Icon = BUSINESS_TYPE_ICONS[type];
            return (
              <SelectItem key={type} value={type} className="min-h-11 text-base">
                <Icon aria-hidden="true" className="text-muted-foreground" />
                {t(`storeEssentials.businessTypes.${type}`)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </QuestionShell>
  );
}
