"use client";

import { useId } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { guidedSteps, isDataEmpty, type DataSetupCounts, type GuidedStep } from "../lib/data-setup";

type DataTabTarget = GuidedStep["tab"];

interface DataSetupGuideProps {
  storeId: string;
  counts: DataSetupCounts;
  /** Opens a step's tab, where its items are added. */
  onGoToTab: (tab: DataTabTarget) => void;
  onHide: () => void;
  /** Switch to the menu import (offered only while every list is still empty). */
  onSwitchToImport: () => void;
  className?: string;
}

/**
 * The guided way in, above the lists: raw materials, recipes, then the menu,
 * each ticking itself off from the live totals, the next one highlighted.
 * The menu step carries "Needed for the POS". With all three done it says so
 * and offers the POS, until hidden.
 */
export function DataSetupGuide({
  storeId,
  counts,
  onGoToTab,
  onHide,
  onSwitchToImport,
  className,
}: DataSetupGuideProps) {
  const { t } = useI18n();
  const titleId = useId();
  const steps = guidedSteps(counts);
  const allDone = steps.every((step) => step.done);

  return (
    <section
      aria-labelledby={titleId}
      className={cn("bg-card rounded-lg border p-4 sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {allDone ? (
            <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          ) : (
            <ListChecks className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {allDone ? t("import.setup.guide.allDoneTitle") : t("import.setup.guide.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {allDone ? t("import.setup.guide.allDoneBody") : t("import.setup.guide.subtitle")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t("import.setup.guide.hide")}
          onClick={onHide}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      {allDone ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="h-11">
            <Link href={`/store/${storeId}/pos`}>{t("import.setup.guide.openPos")}</Link>
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={onHide}>
            {t("import.setup.guide.hide")}
          </Button>
        </div>
      ) : (
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <GuidedStepItem key={step.id} step={step} number={index + 1} onGoToTab={onGoToTab} />
          ))}
        </ol>
      )}

      {isDataEmpty(counts) && (
        <div className="mt-3 border-t pt-2">
          <Button
            type="button"
            variant="link"
            className="h-11 px-0 whitespace-normal"
            onClick={onSwitchToImport}
          >
            {t("import.setup.guide.switchToImport")}
          </Button>
        </div>
      )}
    </section>
  );
}

function GuidedStepItem({
  step,
  number,
  onGoToTab,
}: {
  step: GuidedStep;
  number: number;
  onGoToTab: (tab: DataTabTarget) => void;
}) {
  const { t } = useI18n();
  const key = `import.setup.guide.${step.id}`;

  return (
    <li
      aria-current={step.current ? "step" : undefined}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border p-3",
        step.current && "border-primary bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            step.done
              ? "bg-primary text-primary-foreground"
              : step.current
                ? "border-primary text-primary border-2"
                : "bg-muted text-muted-foreground"
          )}
        >
          {step.done ? <Check className="size-4" /> : number}
        </span>
        <h3 className="text-sm font-semibold">
          <span className="sr-only">
            {t("import.setup.guide.stepLabel").replace("{n}", String(number))}:{" "}
          </span>
          {t(`${key}.title`)}
        </h3>
        {step.id === "menu" && (
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {t("import.setup.guide.posBadge")}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-2 flex-1 text-sm">{t(`${key}.body`)}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {step.done
            ? `${t("import.setup.guide.done")} · ${t("import.setup.guide.count").replace("{count}", String(step.count))}`
            : null}
        </span>
        <Button
          type="button"
          variant={step.current ? "default" : "outline"}
          className="h-10"
          onClick={() => onGoToTab(step.tab)}
        >
          {t(`${key}.cta`)}
        </Button>
      </div>
    </li>
  );
}

interface DataSetupMenuReadyProps {
  storeId: string;
  /** Carry on the guided way: raw materials and recipes behind the menu. */
  onContinueGuided: () => void;
  onHide: () => void;
  className?: string;
}

/**
 * After the menu import: the menu is on the POS and the storefront; what's
 * left for accurate stock and margins is the raw materials and recipes behind
 * it, one tap away on the guided way.
 */
export function DataSetupMenuReady({
  storeId,
  onContinueGuided,
  onHide,
  className,
}: DataSetupMenuReadyProps) {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn("border-primary/40 bg-primary/5 rounded-lg border p-4 sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {t("import.setup.menuReady.title")}
            </h2>
            <p className="text-muted-foreground max-w-3xl text-sm">
              {t("import.setup.menuReady.body")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t("import.setup.menuReady.hide")}
          onClick={onHide}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="h-11">
          <Link href={`/store/${storeId}/pos`}>{t("import.setup.menuReady.openPos")}</Link>
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onContinueGuided}>
          {t("import.setup.menuReady.next")}
        </Button>
      </div>
    </section>
  );
}
