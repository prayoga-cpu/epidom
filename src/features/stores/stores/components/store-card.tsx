"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { useDefaultLanding } from "@/features/dashboard/profile/hooks/use-default-landing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, ArrowRight, MoreVertical, Pencil, Trash2, Store, Lock } from "lucide-react";
import type { StoreOverview } from "@/types/api/store-overview";
import { cn } from "@/lib/utils";
import { planHasFeature, type PlanTier } from "@/lib/plans/entitlements";
import { Store as StoreType } from "../hooks/use-stores";
import { useStoreLaunchTargets } from "../hooks/use-store-launch-targets";
import { isBlobHostedImage, resolveStoreCardBranding } from "../lib/store-card-branding";
import { EditStoreDialog } from "./edit-store-dialog";
import { DeleteStoreDialog } from "./delete-store-dialog";
import { StoreAvatar } from "./store-avatar";
import { StoreCardSummary } from "./store-card-summary";
import { StoreLaunchDialog } from "./store-launch-dialog";

interface StoreCardProps {
  store: StoreType;
  isBlocked?: boolean; // True if subscription is not active
  /** Same subscription covers every store under one business. Decides whether
   * the chooser's POS option opens the till or is locked behind an upgrade. */
  currentPlan?: PlanTier;
  /** This store's GET /api/stores/overview row (branding + summary); null
   * while it loads, when it failed, or when there is none. */
  overview?: StoreOverview | null;
  overviewLoading?: boolean;
}

export function StoreCard({
  store,
  isBlocked = false,
  currentPlan = "FREE",
  overview = null,
  overviewLoading = false,
}: StoreCardProps) {
  const { t } = useI18n();
  const defaultLanding = useDefaultLanding();
  const nameId = useId();
  const blockedTitleId = useId();
  const [launchOpen, setLaunchOpen] = useState(false);
  const chooserLinkRef = useRef<HTMLAnchorElement>(null);
  // Keyed by URL, so the storefront cover arriving after a failed Store Image
  // (or the other way round) still gets its chance to load.
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);

  // A store this account WORKS AT (linked staff login), not one it owns: no
  // edit/delete, no Back Office, and the card opens the POS page they can reach.
  // A back-office-only role has no such page — the card stays visible but says so
  // instead of linking somewhere that would only bounce them back here.
  const isStaffStore = store.accessRole === "staff";
  const staffNoAccess = isStaffStore && !store.staffHomePath;
  const showBlockedView = isBlocked || staffNoAccess;
  // Only an owner's card opens the chooser: Back Office always sends linked
  // staff back to POS, and a blocked card goes to pricing.
  const isChooserCard = !showBlockedView && !isStaffStore;

  const branding = resolveStoreCardBranding(store, overview);
  const coverUrl =
    branding.coverUrl && branding.coverUrl !== failedCoverUrl ? branding.coverUrl : null;

  const { posHref, backOfficeHref } = useStoreLaunchTargets(store.id, defaultLanding);
  const posLocked = !planHasFeature(currentPlan, "posAccess");
  const preferred = defaultLanding === "pos" && !posLocked ? "pos" : "backOffice";

  // Let the browser have modified and non-primary clicks (new tab, new window,
  // download), as Next's Link does; those open the preferred destination. A
  // plain click opens the chooser instead of navigating.
  const handleChooserClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setLaunchOpen(true);
  };

  const body = (
    <>
      {/* Cover — 16:9, the storefront cover's own upload ratio */}
      <div className="relative aspect-video w-full overflow-hidden bg-[color-mix(in_srgb,var(--store-brand)_14%,var(--color-card))]">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            data-testid="store-cover"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={!isBlobHostedImage(coverUrl)}
            onError={() => setFailedCoverUrl(coverUrl)}
          />
        ) : (
          <div
            data-testid="store-cover-placeholder"
            className="absolute inset-0 flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full text-[var(--store-brand)] opacity-15"
              fill="none"
            >
              <defs>
                <pattern
                  id={`grid-${store.id}`}
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${store.id})`} />
            </svg>
            <div className="relative flex size-14 items-center justify-center rounded-full bg-[var(--store-brand)] shadow-sm sm:size-16">
              <Store
                aria-hidden="true"
                className="size-7 text-[var(--store-brand-ink)] sm:size-8"
              />
            </div>
          </div>
        )}
        {/* Subtle brand tint on hover */}
        <div className="absolute inset-0 bg-[var(--store-brand)]/0 transition-colors duration-300 group-hover:bg-[var(--store-brand)]/5" />
      </div>

      <CardContent className="bg-card flex flex-1 flex-col gap-2.5 px-4 pb-4 sm:gap-3 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
        <StoreAvatar
          logoUrl={branding.logoUrl}
          initial={branding.initial}
          className="-mt-8 sm:-mt-9"
        />

        {/* Store Name */}
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <h3
            id={nameId}
            className="text-foreground group-hover:text-foreground/80 line-clamp-2 flex-1 text-base leading-tight font-semibold break-words transition-colors sm:text-lg md:text-xl"
          >
            {store.name}
          </h3>
          {!staffNoAccess && (
            <ArrowRight
              className="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 flex-shrink-0 transition-all duration-300 group-hover:translate-x-1 sm:mt-1 sm:h-5 sm:w-5"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Location */}
        {store.city && (
          <div className="flex items-start gap-2 sm:gap-2.5">
            <MapPin
              className="text-muted-foreground mt-0.5 h-3.5 w-3.5 flex-shrink-0 sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-0.5 text-xs font-medium tracking-wide uppercase">
                {t("stores.city")}
              </p>
              <p className="text-foreground truncate text-xs font-medium sm:text-sm md:text-base">
                {store.city}
              </p>
            </div>
          </div>
        )}

        {/* Slogan + figures. Never on a blocked card: the overlay only hides it
            visually, and a screen reader would still read the figures. */}
        {!showBlockedView && (
          <StoreCardSummary
            summary={overview}
            loading={overviewLoading}
            showTotals={!isStaffStore}
          />
        )}
      </CardContent>
    </>
  );

  const bodyClassName = "flex h-full flex-col focus-visible:outline-none";

  return (
    <Card
      style={branding.brandStyle}
      className={cn(
        "group border-border bg-card relative flex h-full flex-col overflow-hidden border p-0 shadow-sm transition-all duration-300 sm:gap-0 sm:py-0",
        // The ring sits on the card, not the link, so overflow-hidden can't clip it.
        // Theme tokens: --ring and --background both change in dark mode.
        "has-[>a:focus-visible]:ring-ring has-[>a:focus-visible]:ring-offset-background has-[>a:focus-visible]:ring-2 has-[>a:focus-visible]:ring-offset-2",
        staffNoAccess
          ? "cursor-not-allowed opacity-75"
          : isBlocked
            ? "opacity-75"
            : "hover:-translate-y-1 hover:border-[var(--store-brand)]/40 hover:shadow-xl"
      )}
    >
      {/* Brand accent across the top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-[var(--store-brand)]"
      />

      {isStaffStore && (
        <div className="absolute top-3 left-3 z-10">
          <span className="bg-card/95 text-foreground inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium shadow-md backdrop-blur-sm">
            {t("stores.staffBadge")}
          </span>
        </div>
      )}

      {/* Actions Dropdown - Positioned absolutely */}
      {/* Hidden when the store is blocked, and for a staff card: edit/delete are the owner's */}
      {!showBlockedView && !isStaffStore && (
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="bg-card/95 hover:bg-card p-0 shadow-md backdrop-blur-sm transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <EditStoreDialog
                store={store}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              <DeleteStoreDialog
                store={store}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Blocked Overlay - Branded Design. pointer-events-none: a blocked
          card's click belongs to the pricing link underneath. */}
      {showBlockedView && (
        <div className="from-card/95 via-card/90 to-muted/95 pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg border-2 border-[var(--color-brand-primary)]/20 bg-gradient-to-br shadow-lg backdrop-blur-md">
          {/* Decorative Pattern Background */}
          <div className="absolute inset-0 overflow-hidden rounded-lg opacity-[0.03]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, var(--color-brand-primary) 0px, var(--color-brand-primary) 1px, transparent 1px, transparent 20px)`,
              }}
            />
          </div>

          <div className="relative px-4 py-6 text-center">
            {/* Icon with Brand Color */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--color-brand-primary)]/30 bg-gradient-to-br from-[var(--color-brand-primary)]/10 via-[var(--color-brand-primary)]/15 to-[var(--color-brand-primary)]/20 shadow-sm">
              <Lock className="h-7 w-7 text-[var(--color-brand-primary)]" strokeWidth={2.5} />
            </div>

            {/* Title */}
            <p
              id={blockedTitleId}
              className="mb-2 text-base font-bold tracking-tight text-[var(--color-brand-primary)] sm:text-lg"
            >
              {staffNoAccess
                ? t("stores.staffNoAccessTitle")
                : t("stores.subscriptionRequired") || "Subscription Required"}
            </p>

            {/* Description */}
            <p className="text-muted-foreground mx-auto max-w-[200px] text-xs leading-relaxed sm:text-sm">
              {staffNoAccess
                ? t("stores.staffNoAccessDesc")
                : t("stores.renewSubscription") || "Renew your subscription to access this store"}
            </p>

            {/* Subtle CTA Hint — only when there is something to click through to */}
            {!staffNoAccess && (
              <div className="mt-4 border-t border-[var(--color-brand-primary)]/10 pt-3">
                <p className="text-[10px] font-medium tracking-wider text-[var(--color-brand-primary)]/70 uppercase">
                  {t("stores.clickToSubscribe") || "Click to Subscribe"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card body: what it is depends on who is looking and the plan. */}
      {staffNoAccess ? (
        <div className="flex h-full flex-col">{body}</div>
      ) : isBlocked ? (
        <Link
          href="/pricing?reason=subscription_required"
          prefetch={false}
          aria-labelledby={nameId}
          aria-describedby={blockedTitleId}
          className={bodyClassName}
        >
          {body}
        </Link>
      ) : isStaffStore ? (
        <Link
          href={store.staffHomePath ?? "/stores"}
          aria-labelledby={nameId}
          className={bodyClassName}
        >
          {body}
        </Link>
      ) : (
        <Link
          ref={chooserLinkRef}
          href={preferred === "pos" ? posHref : backOfficeHref}
          prefetch={false}
          aria-labelledby={nameId}
          aria-haspopup="dialog"
          aria-expanded={launchOpen}
          onClick={handleChooserClick}
          className={bodyClassName}
        >
          {body}
        </Link>
      )}

      {/* A sibling of the link, never inside it (see StoreLaunchDialog). */}
      {isChooserCard && (
        <StoreLaunchDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          storeName={store.name}
          logoUrl={branding.logoUrl}
          initial={branding.initial}
          brandStyle={branding.brandStyle}
          posHref={posHref}
          backOfficeHref={backOfficeHref}
          posLocked={posLocked}
          preferred={preferred}
          returnFocusRef={chooserLinkRef}
        />
      )}
    </Card>
  );
}
