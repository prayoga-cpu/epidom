"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { responsive } from "@/lib/utils/responsive";
import { useI18n } from "@/components/lang/i18n-provider";

interface SectionErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * SectionErrorState Component
 *
 * Reusable error state for data sections.
 * Displays a consistent error UI with optional retry functionality.
 * Follows DRY principle by centralizing the error state pattern.
 */
export function SectionErrorState({
  title,
  message,
  error,
  onRetry,
  retryLabel,
  className,
}: SectionErrorStateProps) {
  const { t } = useI18n();
  const displayMessage = message || error?.message || t("common.validation.unexpectedError");

  return (
    <Card className={`${responsive.cardWrapper} ${className || ""}`}>
      <CardContent className="flex min-h-[400px] flex-col items-center justify-center py-12 text-center">
        <div className="bg-destructive/10 mb-4 rounded-full p-3">
          <AlertCircle className="text-destructive h-6 w-6" />
        </div>
        {title && <h3 className="mb-2 text-lg font-semibold">{title}</h3>}
        <p className="text-muted-foreground text-sm">{displayMessage}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
            {retryLabel ?? t("common.actions.retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
