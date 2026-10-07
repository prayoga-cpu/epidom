"use client";

import { useId } from "react";
import { ArrowRight, Layers, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { DataSetupPath } from "../lib/data-setup";

interface DataSetupChooserProps {
  onChoose: (path: DataSetupPath) => void;
  /** Leave the choice for this visit and show the usual lists. */
  onSkip: () => void;
  className?: string;
}

/**
 * The Data page of a store with nothing in it yet: the two ways to fill it,
 * each with how it works, what it gives and its catch, so the owner picks
 * knowingly. The menu import comes first (the POS can't sell without a menu);
 * the guided way builds up from raw materials for accurate stock and margins.
 */
export function DataSetupChooser({ onChoose, onSkip, className }: DataSetupChooserProps) {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn("bg-card rounded-lg border p-4 sm:p-6", className)}
    >
      <p className="text-primary text-xs font-semibold tracking-wider uppercase">
        {t("import.setup.chooser.eyebrow")}
      </p>
      <h2 id={titleId} className="mt-1 text-xl font-semibold sm:text-2xl">
        {t("import.setup.chooser.title")}
      </h2>
      <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
        {t("import.setup.chooser.subtitle")}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PathCard path="import" icon={Sparkles} recommended onChoose={onChoose} steps={null} />
        <PathCard
          path="guided"
          icon={Layers}
          onChoose={onChoose}
          steps={[
            t("import.setup.guide.materials.title"),
            t("import.setup.guide.recipes.title"),
            t("import.setup.guide.menu.title"),
          ]}
        />
      </div>

      <div className="mt-4 flex justify-center">
        <Button type="button" variant="ghost" className="h-11" onClick={onSkip}>
          {t("import.setup.chooser.skip")}
        </Button>
      </div>
    </section>
  );
}

interface PathCardProps {
  path: DataSetupPath;
  icon: LucideIcon;
  recommended?: boolean;
  /** The guided way's steps, in order; null for none. */
  steps: string[] | null;
  onChoose: (path: DataSetupPath) => void;
}

function PathCard({ path, icon: Icon, recommended = false, steps, onChoose }: PathCardProps) {
  const { t } = useI18n();
  const titleId = useId();
  const key = `import.setup.chooser.${path}`;

  const facts = [
    { label: t("import.setup.chooser.howLabel"), text: t(`${key}.how`) },
    { label: t("import.setup.chooser.getLabel"), text: t(`${key}.get`) },
    { label: t("import.setup.chooser.noteLabel"), text: t(`${key}.note`) },
  ];

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border p-4 sm:p-5",
        recommended && "border-primary/60 ring-primary/20 ring-1"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
              recommended ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            )}
          >
            {t(`${key}.badge`)}
          </span>
          <h3 id={titleId} className="mt-1 text-base leading-snug font-semibold">
            {t(`${key}.title`)}
          </h3>
        </div>
      </div>

      {steps && (
        <ol
          aria-label={t("import.setup.chooser.guided.stepsLabel")}
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium"
        >
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="bg-muted flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <span className="text-primary tabular-nums">{index + 1}</span>
                {step}
              </span>
              {index < steps.length - 1 && (
                <ArrowRight className="text-muted-foreground size-3.5" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      )}

      <dl className="mt-4 flex-1 space-y-3 text-sm">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="font-medium">{fact.label}</dt>
            <dd className="text-muted-foreground">{fact.text}</dd>
          </div>
        ))}
      </dl>

      <Button
        type="button"
        variant={recommended ? "default" : "outline"}
        className="mt-5 h-11 w-full sm:w-auto sm:self-start"
        onClick={() => onChoose(path)}
      >
        {t(`${key}.cta`)}
        <ArrowRight aria-hidden="true" />
      </Button>
    </article>
  );
}
