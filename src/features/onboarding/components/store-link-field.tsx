"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CircleAlert, CircleCheck, Link2, Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSlugCheck, type SlugCheck } from "../hooks/use-slug-check";
import type { StoreStepFormInput } from "../lib/store-step-schema";
import {
  STORE_SLUG_MAX_LENGTH,
  isValidStoreSlug,
  normalizeSlugInput,
  slugifyStoreLink,
  storeLinkHost,
  storeLinkLabel,
} from "../lib/store-link";

export interface StoreLinkFieldProps {
  /** The link saved on the draft storefront (resume), and the store name it was saved with. */
  savedSlug: string | null;
  savedName: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * The store link under the name: a live preview ("epidom.fr/@le-petit-four")
 * that follows the name as it is typed, and an "Edit link" toggle that swaps
 * it for an input checked against the server as the owner types.
 *
 * In preview mode the link shown is the one the server will derive: the
 * name's slug, or the saved link while the name is unchanged, or the free
 * alternative when the name's slug is already taken.
 */
export function StoreLinkField({ savedSlug, savedName, disabled, className }: StoreLinkFieldProps) {
  const { t } = useI18n();
  const { control, setValue, clearErrors, setFocus } = useFormContext<StoreStepFormInput>();
  const name = useWatch({ control, name: "name" }) ?? "";
  const editLink = useWatch({ control, name: "editLink" });
  const slugInput = useWatch({ control, name: "slug" }) ?? "";
  const useNameLink = useWatch({ control, name: "useNameLink" });
  const labelId = React.useId();
  const statusId = React.useId();
  const focusInputRef = React.useRef(false);

  // An unchanged name keeps the saved link, unless the owner asked for the
  // name's link back ("Use my store name").
  const keepsSavedLink =
    !!savedSlug && !useNameLink && name.trim() === (savedName ?? "").trim();
  const nameSlug = keepsSavedLink ? savedSlug : slugifyStoreLink(name);
  const customSlug = slugifyStoreLink(slugInput);
  const checkedSlug = editLink ? customSlug : nameSlug;
  // The saved link is the owner's own: always available, no need to ask.
  const isOwnLink = !!savedSlug && checkedSlug === savedSlug;
  const serverCheck = useSlugCheck(checkedSlug, { enabled: !isOwnLink });
  const check: SlugCheck = isOwnLink ? { status: "available", suggestion: null } : serverCheck;

  const previewSlug =
    !editLink && check.status === "taken" && check.suggestion ? check.suggestion : nameSlug;
  const hasPreview = isValidStoreSlug(previewSlug);

  React.useEffect(() => {
    if (editLink && focusInputRef.current) {
      focusInputRef.current = false;
      setFocus("slug");
    }
  }, [editLink, setFocus]);

  const startEditing = () => {
    focusInputRef.current = true;
    setValue("slug", hasPreview ? previewSlug : "", { shouldDirty: true });
    setValue("editLink", true, { shouldDirty: true });
    setValue("useNameLink", false);
  };

  const stopEditing = () => {
    clearErrors("slug");
    setValue("editLink", false, { shouldDirty: true });
    // "Use my store name" over a saved link that isn't the name's (a custom
    // or Instagram one): ask for the name's link, or the preview would keep
    // showing, and the server keep, the saved one.
    setValue("useNameLink", !!savedSlug && savedSlug !== slugifyStoreLink(name), {
      shouldDirty: true,
    });
  };

  const applySuggestion = (suggestion: string) => {
    setValue("slug", suggestion, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div
      data-testid="store-link"
      className={cn("bg-muted/30 rounded-lg border p-3 text-sm", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Link2 aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p id={labelId} className="text-muted-foreground text-xs">
              {t("onboarding.store.link.label")}
            </p>
            {editLink ? null : hasPreview ? (
              <p
                aria-labelledby={labelId}
                className="text-foreground font-mono text-sm font-medium break-all"
              >
                {storeLinkLabel(previewSlug)}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">{t("onboarding.store.link.pending")}</p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={editLink ? stopEditing : startEditing}
          aria-expanded={editLink}
          className="h-10 shrink-0 px-3 text-[var(--epi-gold-600)] hover:text-[var(--epi-gold-600)]"
        >
          {editLink ? t("onboarding.store.link.reset") : t("onboarding.store.link.edit")}
        </Button>
      </div>

      {editLink ? (
        <FormField
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <FormItem className="mt-2 gap-1.5">
              <FormLabel className="sr-only">{t("onboarding.store.link.inputLabel")}</FormLabel>
              <div
                className={cn(
                  "bg-background focus-within:border-ring focus-within:ring-ring/50 flex h-11 min-w-0 items-center rounded-md border shadow-xs focus-within:ring-[3px]",
                  fieldState.invalid && "border-destructive"
                )}
              >
                <span
                  aria-hidden="true"
                  className="text-muted-foreground shrink-0 pl-3 font-mono text-sm"
                >
                  {storeLinkHost()}/@
                </span>
                <FormControl>
                  <Input
                    ref={field.ref}
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(normalizeSlugInput(event.target.value))}
                    onBlur={() => {
                      field.onChange(slugifyStoreLink(field.value ?? ""));
                      field.onBlur();
                    }}
                    disabled={disabled}
                    maxLength={STORE_SLUG_MAX_LENGTH}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={statusId}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent pl-0.5 font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                </FormControl>
              </div>
              <div id={statusId} aria-live="polite" className="min-h-5">
                {fieldState.invalid ? null : (
                  <SlugStatus check={check} onUseSuggestion={applySuggestion} disabled={disabled} />
                )}
              </div>
              <FormMessage className="min-h-0" />
            </FormItem>
          )}
        />
      ) : null}
    </div>
  );
}

function SlugStatus({
  check,
  onUseSuggestion,
  disabled,
}: {
  check: SlugCheck;
  onUseSuggestion: (slug: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  switch (check.status) {
    case "checking":
      return (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          {t("onboarding.store.link.checking")}
        </p>
      );
    case "available":
      return (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          {t("onboarding.store.link.available")}
        </p>
      );
    case "taken":
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-destructive flex items-center gap-1.5 text-xs">
            <CircleAlert aria-hidden="true" className="size-3.5" />
            {t("onboarding.store.link.taken")}
          </p>
          {check.suggestion ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onUseSuggestion(check.suggestion!)}
              className="h-10 max-w-full font-mono text-xs"
            >
              <span className="truncate">
                {t("onboarding.store.link.useSuggestion").replace("{slug}", check.suggestion)}
              </span>
            </Button>
          ) : null}
        </div>
      );
    case "invalid":
      return <p className="text-destructive text-xs">{t("onboarding.store.link.invalid")}</p>;
    case "error":
      return (
        <p className="text-muted-foreground text-xs">{t("onboarding.store.link.checkFailed")}</p>
      );
    default:
      return <p className="text-muted-foreground text-xs">{t("onboarding.store.link.hint")}</p>;
  }
}
