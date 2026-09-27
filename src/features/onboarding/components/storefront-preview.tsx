"use client";

import type * as React from "react";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { getContrastingInk, getPremiumTheme } from "@/lib/utils/color";
import { formatCurrency } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";

export interface StorefrontPreviewItem {
  name: string;
  price?: number;
}

export interface StorefrontPreviewProps {
  name: string;
  tagline: string;
  logoUrl?: string;
  themeColor: string;
  items: StorefrontPreviewItem[];
  currency: string;
  /** "phone": the framed preview beside the form (large screens); "compact": a card for phones. */
  variant: "phone" | "compact";
  className?: string;
}

/**
 * A live sketch of the public storefront as step 2 is filled in: header in
 * the theme colour (softened the way the storefront softens it), logo circle,
 * name, tagline and the menu items priced in the store's currency.
 */
export function StorefrontPreview({
  name,
  tagline,
  logoUrl,
  themeColor,
  items,
  currency,
  variant,
  className,
}: StorefrontPreviewProps) {
  const { t, locale } = useI18n();
  const brand = getPremiumTheme(themeColor);
  const brandStyle = {
    "--preview-brand": brand,
    "--preview-ink": getContrastingInk(brand),
  } as React.CSSProperties;
  const displayName = name.trim() || t("onboarding.storefront.preview.yourStore");
  const named = items.filter((item) => item.name.trim());
  const price = (value?: number) =>
    value === undefined ? "" : formatCurrency(value, currency, INTL_LOCALES[locale]);
  const initial = displayName.charAt(0).toUpperCase();

  const logo = (size: string) =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(size, "border-background bg-background rounded-full border-4 object-cover")}
      />
    ) : (
      <span
        aria-hidden="true"
        className={cn(
          size,
          "border-background flex items-center justify-center rounded-full border-4 bg-[var(--preview-brand)] text-lg font-bold text-[var(--preview-ink)]"
        )}
      >
        {initial}
      </span>
    );

  const menu = (
    <ul className="divide-y">
      {named.length > 0 ? (
        named.map((item, index) => (
          <li key={index} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="text-foreground min-w-0 truncate">{item.name.trim()}</span>
            <span className="text-foreground shrink-0 font-medium tabular-nums">
              {price(item.price)}
            </span>
          </li>
        ))
      ) : (
        <li className="text-muted-foreground py-2 text-sm">
          {t("onboarding.storefront.preview.emptyMenu")}
        </li>
      )}
    </ul>
  );

  if (variant === "compact") {
    return (
      <section
        aria-label={t("onboarding.storefront.preview.title")}
        style={brandStyle}
        data-testid="storefront-preview-compact"
        className={cn("bg-card overflow-hidden rounded-xl border", className)}
      >
        <div className="h-10 bg-[var(--preview-brand)]" />
        <div className="px-4 pb-3">
          <div className="-mt-6 flex items-end gap-3">
            {logo("size-14 shrink-0")}
            <div className="min-w-0 pb-1">
              <p className="text-foreground truncate font-semibold">{displayName}</p>
              {tagline.trim() ? (
                <p className="text-muted-foreground truncate text-xs">{tagline.trim()}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-2">{menu}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={t("onboarding.storefront.preview.title")}
      style={brandStyle}
      data-testid="storefront-preview-phone"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("onboarding.storefront.preview.title")}
      </p>
      <div className="border-foreground/85 bg-background w-full max-w-[17rem] overflow-hidden rounded-[2.25rem] border-[7px] shadow-xl">
        <div className="bg-foreground/85 mx-auto h-4 w-20 rounded-b-xl" aria-hidden="true" />
        <div className="h-20 bg-[var(--preview-brand)]" />
        <div className="flex min-h-[20rem] flex-col items-center px-4 pb-5 text-center">
          <div className="-mt-10">{logo("size-20")}</div>
          <p className="text-foreground mt-2 line-clamp-2 text-base font-bold break-words">
            {displayName}
          </p>
          {tagline.trim() ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs break-words">
              {tagline.trim()}
            </p>
          ) : null}
          <div className="mt-4 w-full text-left">{menu}</div>
          <span
            aria-hidden="true"
            className="mt-auto flex h-9 w-full items-center justify-center rounded-full bg-[var(--preview-brand)] text-xs font-semibold text-[var(--preview-ink)]"
          >
            {t("onboarding.storefront.preview.order")}
          </span>
        </div>
      </div>
    </section>
  );
}
