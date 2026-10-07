"use client";

import { useId, useState } from "react";
import { ChevronDown, FileUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/ai/import/types";
import { IMPORT_PROMPT_TYPES } from "../lib/import-prompt";
import { SmartImportDialog } from "../smart-import-dialog";
import { ImportPromptHelper } from "./import-prompt-helper";

interface QuickStartState {
  /** null until the viewer opens or closes it themselves: follow `startOpen`. */
  open: boolean | null;
}

const DEFAULTS: QuickStartState = { open: null };

function sanitize(raw: unknown, defaults: QuickStartState): QuickStartState {
  if (!raw || typeof raw !== "object") return defaults;
  const open = (raw as Partial<QuickStartState>).open;
  return { open: typeof open === "boolean" ? open : null };
}

interface DataQuickStartProps {
  storeId: string;
  /** Open by default: a store with nothing in its lists yet. */
  startOpen: boolean;
  /** The record type the page is showing, preselected in the prompt. */
  defaultEntityType?: EntityType;
  className?: string;
}

/**
 * The fastest way to fill the Data page: get a CSV out of a menu photo or a
 * PDF with any AI assistant, then import it. Three steps, the first and last
 * of which are a button right here.
 *
 * It never leaves the page: closed, it is one row that still carries the
 * Import button; open, it shows the steps. Which of the two is remembered per
 * store on this device.
 */
export function DataQuickStart({
  storeId,
  startOpen,
  defaultEntityType,
  className,
}: DataQuickStartProps) {
  const { t } = useI18n();
  const stepsId = useId();
  const [state, setState] = usePersistedState<QuickStartState>(
    `epidom-data-quickstart-${storeId}`,
    DEFAULTS,
    sanitize
  );
  const [entityType, setEntityType] = useState<EntityType>(
    defaultEntityType && IMPORT_PROMPT_TYPES.includes(defaultEntityType)
      ? defaultEntityType
      : "product"
  );
  const [importOpen, setImportOpen] = useState(false);

  const open = state.open ?? startOpen;

  return (
    <section
      aria-label={t("import.quickStart.title")}
      className={cn("bg-card rounded-lg border p-4", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Sparkles className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t("import.quickStart.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("import.quickStart.subtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!open && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setImportOpen(true)}
            >
              <FileUp aria-hidden="true" />
              {t("import.quickStart.importCta")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            aria-expanded={open}
            aria-controls={stepsId}
            onClick={() => setState({ open: !open })}
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("transition-transform", open && "rotate-180")}
            />
            {open ? t("import.quickStart.hideSteps") : t("import.quickStart.showSteps")}
          </Button>
        </div>
      </div>

      {open && (
        <ImportSteps
          id={stepsId}
          entityType={entityType}
          onEntityTypeChange={setEntityType}
          onImport={() => setImportOpen(true)}
          className="mt-4 border-t pt-4"
        />
      )}

      <SmartImportDialog
        // Remount per type: the dialog reads defaultEntityType once.
        key={entityType}
        open={importOpen}
        onOpenChange={setImportOpen}
        storeId={storeId}
        defaultEntityType={entityType}
      />
    </section>
  );
}

interface ImportStepsProps {
  entityType: EntityType;
  onEntityTypeChange: (type: EntityType) => void;
  /** Step 3's button: open Smart Import (the caller owns the dialog). */
  onImport: () => void;
  id?: string;
  className?: string;
}

/**
 * The three steps themselves: copy the prompt (for the chosen record type),
 * ask any AI assistant, import the file. Shared by the quick start card and
 * the Data page's first-run menu import.
 */
export function ImportSteps({
  entityType,
  onEntityTypeChange,
  onImport,
  id,
  className,
}: ImportStepsProps) {
  const { t } = useI18n();

  const steps = [
    {
      title: t("import.quickStart.step1Title"),
      body: t("import.quickStart.step1Body"),
      action: (
        <ImportPromptHelper entityType={entityType} onEntityTypeChange={onEntityTypeChange} />
      ),
    },
    {
      title: t("import.quickStart.step2Title"),
      body: t("import.quickStart.step2Body"),
      action: null,
    },
    {
      title: t("import.quickStart.step3Title"),
      body: t("import.quickStart.step3Body"),
      action: (
        <Button type="button" className="h-11" onClick={onImport}>
          <FileUp aria-hidden="true" />
          {t("import.quickStart.importCta")}
        </Button>
      ),
    },
  ];

  return (
    <ol id={id} className={cn("grid gap-4 lg:grid-cols-3", className)}>
      {steps.map((step, index) => (
        <li key={step.title} className="flex min-w-0 gap-3">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.body}</p>
            </div>
            {step.action}
          </div>
        </li>
      ))}
    </ol>
  );
}
