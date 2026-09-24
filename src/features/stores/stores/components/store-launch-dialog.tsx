"use client";

import { useId, useRef, type CSSProperties, type Ref, type RefObject } from "react";
import Link, { useLinkStatus } from "next/link";
import { LayoutDashboard, Loader2, Lock, MonitorSmartphone, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLAN_LABELS, upgradeHrefFor } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";
import { StoreAvatar } from "./store-avatar";

export type StoreLaunchTarget = "pos" | "backOffice";

interface StoreLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string;
  logoUrl: string | null;
  initial: string;
  /** The card's --store-brand / --store-brand-ink: the dialog is portalled out of the card, so it doesn't inherit them. */
  brandStyle: CSSProperties;
  posHref: string;
  backOfficeHref: string;
  /** Below the POS plan the POS option is an upsell to /pricing instead. */
  posLocked: boolean;
  /** Which option gets the focus when the dialog opens (the user's default landing). */
  preferred: StoreLaunchTarget;
  /**
   * Where the focus goes back to on close: the card's link. There is no
   * DialogTrigger, so Radix's own return-focus target is null, and it would
   * leave the focus on <body>.
   */
  returnFocusRef: RefObject<HTMLElement | null>;
}

/**
 * The "open this store" chooser on /stores: POS System or Back Office.
 *
 * Rendered as a sibling of the card's link, never inside it. React events
 * bubble through portals, so from inside the link a click on an option would
 * reach the card's onClick, whose preventDefault would cancel it.
 */
export function StoreLaunchDialog({
  open,
  onOpenChange,
  storeName,
  logoUrl,
  initial,
  brandStyle,
  posHref,
  backOfficeHref,
  posLocked,
  preferred,
  returnFocusRef,
}: StoreLaunchDialogProps) {
  const { t } = useI18n();
  const posRef = useRef<HTMLAnchorElement>(null);
  const backOfficeRef = useRef<HTMLAnchorElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={brandStyle}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (preferred === "pos" && !posLocked ? posRef : backOfficeRef).current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          // Our preventDefault makes Radix skip its own handler (see returnFocusRef).
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        className="max-h-[calc(90dvh/var(--app-zoom,1))] gap-0 overflow-y-auto p-0 sm:max-w-lg [&>[data-slot=dialog-close]]:top-3 [&>[data-slot=dialog-close]]:right-3 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:size-10 [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-md"
      >
        <div aria-hidden="true" className="h-1.5 w-full shrink-0 bg-[var(--store-brand)]" />

        <DialogHeader className="flex-row items-center gap-3 px-5 pt-4 pr-14 pb-4 text-left sm:pt-5 sm:text-left">
          <StoreAvatar logoUrl={logoUrl} initial={initial} size="dialog" />
          <div className="min-w-0 flex-1 space-y-1">
            <DialogTitle className="line-clamp-2 text-base leading-tight break-words sm:text-lg">
              {storeName}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t("stores.launch.subtitle")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
          {posLocked ? (
            <LaunchOption
              ref={posRef}
              href={upgradeHrefFor("POS")}
              icon={MonitorSmartphone}
              title={t("nav.posSystem")}
              description={t("stores.launch.posLocked")}
              locked
            />
          ) : (
            <LaunchOption
              ref={posRef}
              href={posHref}
              icon={MonitorSmartphone}
              title={t("nav.posSystem")}
              description={t("stores.launch.posDesc")}
            />
          )}
          <LaunchOption
            ref={backOfficeRef}
            href={backOfficeHref}
            icon={LayoutDashboard}
            title={t("nav.backOffice")}
            description={t("stores.launch.backOfficeDesc")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LaunchOptionProps {
  ref: Ref<HTMLAnchorElement>;
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Shown as the sidebar shows a plan-locked item: dashed, muted, a Lock + plan chip. */
  locked?: boolean;
}

function LaunchOption({
  ref,
  href,
  icon: Icon,
  title,
  description,
  locked = false,
}: LaunchOptionProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Link
      ref={ref}
      href={href}
      // The options only mount once the dialog is open, so prefetching them
      // is on explicit intent: 2 routes of 1 store, not every card on load.
      prefetch={!locked}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-locked={locked ? "true" : undefined}
      className={cn(
        "group/option focus-visible:ring-ring focus-visible:ring-offset-background flex min-h-28 flex-col gap-3 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-44",
        locked
          ? "text-muted-foreground border-dashed hover:bg-amber-500/8"
          : "bg-card hover:bg-muted/40 hover:border-[var(--store-brand)]/60"
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            locked
              ? "bg-muted text-muted-foreground/60"
              : "bg-[var(--store-brand)] text-[var(--store-brand-ink)]"
          )}
        >
          <Icon className="size-5" />
        </span>
        {locked ? (
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium whitespace-nowrap text-amber-600 transition-colors group-hover/option:text-amber-500 dark:text-amber-500/70">
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            {PLAN_LABELS.POS}
          </span>
        ) : (
          <LinkPendingSpinner />
        )}
      </span>
      <span
        id={titleId}
        className={cn(
          "text-base leading-tight font-semibold",
          locked ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {title}
      </span>
      <span
        id={descriptionId}
        className="text-muted-foreground mt-auto border-t pt-3 text-xs leading-relaxed sm:text-sm"
      >
        {description}
      </span>
    </Link>
  );
}

/**
 * The dialog stays open while the chosen route loads (it closes when /stores
 * unmounts), so the option shows a spinner meanwhile. useLinkStatus reads the
 * nearest enclosing <Link>.
 */
function LinkPendingSpinner() {
  const { pending } = useLinkStatus();
  return (
    <Loader2
      aria-hidden="true"
      data-pending={pending ? "true" : undefined}
      className={cn(
        "text-muted-foreground size-4 shrink-0 animate-spin transition-opacity",
        pending ? "opacity-100" : "opacity-0"
      )}
    />
  );
}
