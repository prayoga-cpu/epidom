"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/ai/import/types";
import { buildImportPrompt, IMPORT_PROMPT_TYPES } from "../lib/import-prompt";

/** Labels shared with the import preview's tabs, so the two never disagree. */
export const IMPORT_TYPE_LABEL: Record<EntityType, string> = {
  product: "pages.smartImportTabProducts",
  material: "pages.smartImportTabMaterials",
  recipe: "pages.smartImportTabRecipes",
  supplier: "pages.smartImportTabSuppliers",
};

interface ImportPromptHelperProps {
  entityType: EntityType;
  /** Omit to hide the "I am importing" selector (the caller already has one). */
  onEntityTypeChange?: (type: EntityType) => void;
  className?: string;
}

/**
 * "Copy prompt" for turning a photo or PDF into an importable CSV with any AI
 * assistant, plus a way to read the prompt first. The text is always reachable
 * on screen: clipboard access can be refused (an insecure origin, an embedded
 * browser), and then the merchant selects and copies it by hand.
 */
export function ImportPromptHelper({
  entityType,
  onEntityTypeChange,
  className,
}: ImportPromptHelperProps) {
  const { t } = useI18n();
  const promptId = useId();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => buildImportPrompt(entityType, t), [entityType, t]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success(t("import.quickStart.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard: put the text in front of them, already selected.
      setShowPrompt(true);
      toast.error(t("import.quickStart.copyFailed"));
      window.setTimeout(() => promptRef.current?.select(), 0);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Wraps instead of switching direction at a breakpoint: this sits in a
          full-width dialog and in one third of the quick start, and only the
          container knows which. */}
      <div className="flex flex-wrap items-center gap-2">
        {onEntityTypeChange && (
          <Select value={entityType} onValueChange={(v) => onEntityTypeChange(v as EntityType)}>
            <SelectTrigger
              className="h-11 w-44 max-w-full"
              aria-label={t("import.quickStart.typeLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_PROMPT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(IMPORT_TYPE_LABEL[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="button" variant="outline" className="h-11" onClick={handleCopy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {t("import.quickStart.copy")}
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2 h-10 px-2"
        aria-expanded={showPrompt}
        aria-controls={promptId}
        onClick={() => setShowPrompt((open) => !open)}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform", showPrompt && "rotate-180")}
        />
        {showPrompt ? t("import.quickStart.hidePrompt") : t("import.quickStart.showPrompt")}
      </Button>

      {showPrompt && (
        <textarea
          id={promptId}
          ref={promptRef}
          readOnly
          value={prompt}
          rows={10}
          aria-label={t("import.quickStart.promptLabel")}
          onFocus={(event) => event.currentTarget.select()}
          className="border-input bg-muted/40 text-foreground block w-full resize-y rounded-md border p-3 font-mono text-xs leading-relaxed"
        />
      )}
    </div>
  );
}
