"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { SetupItem, SetupPlan, SetupSection } from "@/lib/guide/contracts";
import { GuidePlanBadge } from "./guide-plan-badge";

/** Sections that can be locked, and so have an upsell row. Storefront is on every plan. */
type LockableSection = Exclude<SetupSection, "storefront">;

const isLockableSection = (section: SetupSection): section is LockableSection =>
  section !== "storefront";

interface SetupChecklistSectionProps {
  section: SetupSection;
  /** This section's items, in the order the server sent them. */
  items: SetupItem[];
}

/**
 * One checklist section: a header, the steps still to do, then the done ones
 * folded behind "Show N done". Items the store's plan doesn't cover are never
 * listed one by one: a section that has any gets a single upsell row framed by
 * the business event that earns the plan (STRATEGY.md §5), linking to the
 * locked items' upgrade path.
 */
export function SetupChecklistSection({ section, items }: SetupChecklistSectionProps) {
  const { t } = useI18n();
  const headingId = useId();
  const doneListId = useId();
  const [showDone, setShowDone] = useState(false);

  const unlocked = items.filter((item) => !item.locked);
  const locked = items.filter((item) => item.locked);
  const pending = unlocked.filter((item) => !item.done);
  const done = unlocked.filter((item) => item.done);
  const upsell = locked[0];

  return (
    <section aria-labelledby={headingId} data-section={section} className="space-y-1.5">
      <div className="flex min-h-6 flex-wrap items-center gap-2 px-1">
        <h3
          id={headingId}
          className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
          {t(`setupGuide.checklist.sections.${section}`)}
        </h3>
        {upsell && unlocked.length === 0 && <GuidePlanBadge plan={upsell.requiredPlan} />}
      </div>

      {pending.length > 0 && (
        <ul className="space-y-0.5">
          {pending.map((item) => (
            <SetupChecklistItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 px-1">
            {pending.length === 0 && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Check className="text-epi-gold-600 size-4" aria-hidden />
                {t("setupGuide.checklist.sectionComplete")}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground h-10 px-2 text-xs"
              aria-expanded={showDone}
              aria-controls={doneListId}
              onClick={() => setShowDone((open) => !open)}
            >
              <ChevronDown
                className={cn("size-4 transition-transform", showDone && "rotate-180")}
                aria-hidden
              />
              {showDone
                ? t("setupGuide.checklist.hideDone")
                : t("setupGuide.checklist.showDone").replace("{count}", String(done.length))}
            </Button>
          </div>
          {showDone && (
            <ul id={doneListId} className="space-y-0.5">
              {done.map((item) => (
                <SetupChecklistItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}

      {upsell && isLockableSection(section) && (
        <SetupChecklistUpsellRow section={section} href={upsell.href} plan={upsell.requiredPlan} />
      )}
    </section>
  );
}

/** One step: status circle, title, why it matters, progress for counted steps, and the link to do it. */
function SetupChecklistItemRow({ item }: { item: SetupItem }) {
  const { t } = useI18n();
  const base = `setupGuide.checklist.items.${item.id}`;
  const showProgress = !item.done && item.progress;

  return (
    <li data-item={item.id} data-done={item.done ? "true" : "false"}>
      <Link
        href={item.href}
        onClick={() => trackEvent("checklist_item_clicked", { item_id: item.id })}
        className={cn(
          "group/item focus-visible:ring-ring hover:bg-muted/60 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none focus-visible:ring-2",
          item.done && "text-muted-foreground"
        )}
      >
        <StatusCircle done={item.done} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm leading-snug font-medium",
              item.done ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {t(`${base}.title`)}
          </span>
          <span className="text-muted-foreground block text-xs leading-snug">
            {t(`${base}.why`)}
          </span>
        </span>
        {showProgress && item.progress && (
          <span className="bg-muted text-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {t("setupGuide.checklist.itemProgress")
              .replace("{current}", String(item.progress.current))
              .replace("{target}", String(item.progress.target))}
          </span>
        )}
        {!item.done && (
          <span className="text-epi-gold-700 dark:text-epi-gold-300 hidden shrink-0 text-xs font-semibold sm:inline">
            {t(`${base}.action`)}
          </span>
        )}
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}

function StatusCircle({ done }: { done: boolean }) {
  const { t } = useI18n();
  return done ? (
    <span className="bg-epi-gold-500 text-epi-navy-900 flex size-6 shrink-0 items-center justify-center rounded-full">
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
      <span className="sr-only">{t("setupGuide.checklist.statusDone")}</span>
    </span>
  ) : (
    <span className="border-muted-foreground/40 flex size-6 shrink-0 rounded-full border-2">
      <span className="sr-only">{t("setupGuide.checklist.statusTodo")}</span>
    </span>
  );
}

interface SetupChecklistUpsellRowProps {
  section: LockableSection;
  href: string;
  plan: SetupPlan;
}

function SetupChecklistUpsellRow({ section, href, plan }: SetupChecklistUpsellRowProps) {
  const { t } = useI18n();
  return (
    <div
      data-upsell={section}
      className="border-epi-gold-500/40 bg-epi-gold-500/5 flex flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="bg-epi-gold-500/15 text-epi-gold-700 dark:text-epi-gold-300 flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">
          {t(`setupGuide.checklist.upsell.${section}.body`)}
        </p>
      </div>
      <Button asChild variant="outline" className="h-10 shrink-0 sm:self-center">
        <Link href={href} onClick={() => trackEvent("checklist_upsell_clicked", { section, plan })}>
          {t(`setupGuide.checklist.upsell.${section}.cta`)}
        </Link>
      </Button>
    </div>
  );
}
