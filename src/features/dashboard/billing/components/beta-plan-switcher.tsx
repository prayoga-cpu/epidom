"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { useI18n } from "@/components/lang/i18n-provider";

const PLANS = ["FREE", "POS", "OPERATIONS", "ENTERPRISE"] as const;

/**
 * Freestyle plan switcher for admin-granted (BETA) accounts — no payment method,
 * so the user can move to any plan instantly. Posts to /api/subscriptions/beta-plan.
 */
export function BetaPlanSwitcher({ currentPlan }: { currentPlan: string }) {
  const { t } = useI18n();
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    if (plan === currentPlan || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/beta-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to switch plan"));
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch plan");
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Sparkles className="h-3.5 w-3.5" />
        {t("billing.betaFreestyle")}
      </div>
      <div className="flex gap-2">
        <Select value={plan} onValueChange={setPlan} disabled={loading}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLANS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={apply} disabled={loading || plan === currentPlan} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("billing.switchPlan")}
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
