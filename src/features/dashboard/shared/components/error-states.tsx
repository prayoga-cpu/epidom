"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";

interface SectionErrorStateProps {
  error: Error | unknown;
  onRetry?: () => void;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * SectionErrorState Component
 *
 * Standardized error state for sections.
 * Displays error icon, title, description, and optional retry button.
 * Follows DRY principle by centralizing error handling UI.
 */
export function SectionErrorState({
  error,
  onRetry,
  title,
  description,
  className,
}: SectionErrorStateProps) {
  const { t } = useI18n();

  // Extract error message
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : t("common.error") || "An error occurred";

  return (
    <Card className={cn("min-h-[calc(100vh-150px)] overflow-hidden shadow-md", className)}>
      <CardContent className="flex min-h-[400px] flex-col items-center justify-center py-12 text-center">
        <div className="bg-destructive/10 mb-4 rounded-full p-3">
          <AlertCircle className="text-destructive h-6 w-6" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">
          {title || t("common.error") || "Error"}
        </h3>
        <p className="text-muted-foreground mb-4 text-sm">
          {description || errorMessage}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {t("common.actions.retry") || "Try Again"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface InlineErrorStateProps {
  error: Error | unknown;
  onRetry?: () => void;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * InlineErrorState Component
 *
 * Compact error state for inline use (tables, cards, etc.).
 * Smaller footprint than SectionErrorState.
 */
export function InlineErrorState({
  error,
  onRetry,
  title,
  description,
  className,
}: InlineErrorStateProps) {
  const { t } = useI18n();

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : t("common.error") || "An error occurred";

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-destructive/10 mb-4 rounded-full p-3">
          <AlertCircle className="text-destructive h-6 w-6" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">
          {title || t("common.error") || "Error"}
        </h3>
        <p className="text-muted-foreground text-sm mb-4">
          {description || errorMessage}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common.actions.retry") || "Try Again"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

