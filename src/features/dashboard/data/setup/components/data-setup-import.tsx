"use client";

import { useId, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/ai/import/types";
import { ImportSteps } from "../../import/components/data-quick-start";
import { SmartImportDialog } from "../../import/smart-import-dialog";

interface DataSetupImportProps {
  storeId: string;
  /** Back to the two ways in. */
  onBack: () => void;
  /** Type the menu in instead: the usual lists, on Products. */
  onAddManually: () => void;
  className?: string;
}

/**
 * The menu import, on its own: the quick start's three steps with the prompt
 * set to products (the menu) — the type can still be changed. Once the import
 * saves anything the store is no longer empty and the page moves on by itself
 * (see resolveDataSetupView).
 */
export function DataSetupImport({
  storeId,
  onBack,
  onAddManually,
  className,
}: DataSetupImportProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [entityType, setEntityType] = useState<EntityType>("product");
  const [importOpen, setImportOpen] = useState(false);

  return (
    <section
      aria-labelledby={titleId}
      className={cn("bg-card rounded-lg border p-4 sm:p-6", className)}
    >
      <Button type="button" variant="ghost" className="-ml-2 h-11" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        {t("import.setup.importView.back")}
      </Button>

      <div className="mt-2 flex min-w-0 items-start gap-3">
        <Sparkles className="text-primary mt-1 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold">
            {t("import.setup.importView.title")}
          </h2>
          <p className="text-muted-foreground max-w-3xl text-sm">
            {t("import.setup.importView.subtitle")}
          </p>
        </div>
      </div>

      <ImportSteps
        entityType={entityType}
        onEntityTypeChange={setEntityType}
        onImport={() => setImportOpen(true)}
        className="mt-5 border-t pt-5"
      />

      <div className="mt-5 border-t pt-3">
        <Button
          type="button"
          variant="link"
          className="h-11 px-0 whitespace-normal"
          onClick={onAddManually}
        >
          {t("import.setup.importView.manual")}
        </Button>
      </div>

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
