"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";

interface SubscriptionLockedStateProps {
  title?: string;
  message?: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * SubscriptionLockedState Component
 *
 * Reusable component for displaying subscription-locked features.
 * Provides consistent UI and behavior across all locked features.
 * Follows DRY principle by centralizing the subscription-locked pattern.
 */
export function SubscriptionLockedState({
  title,
  message,
  className,
  showIcon = true,
}: SubscriptionLockedStateProps) {
  const { t } = useI18n();
  const router = useRouter();

  const displayTitle = title || t("data.suppliers.locked");
  const displayMessage = message || t("data.suppliers.locked");

  return (
    <Card className={className}>
      <CardContent className="flex min-h-[400px] flex-col items-center justify-center py-12 text-center">
        {showIcon && (
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <AlertCircle className="text-primary h-6 w-6" />
          </div>
        )}
        <h3 className="mb-2 text-lg font-semibold">{displayTitle}</h3>
        {message && <p className="text-muted-foreground text-sm mb-4">{displayMessage}</p>}
        <Button
          onClick={() => router.push("/pricing#plans")}
          className="mt-4 bg-[var(--color-brand-primary)] hover:opacity-90"
          size="sm"
        >
          {t("billing.upgradeToPro")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

