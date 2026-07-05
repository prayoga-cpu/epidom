import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  className?: string;
}

/**
 * Presentational KPI tile. Currency/i18n-agnostic — callers pass an
 * already-formatted `value` and `subtext`. Mirrors the finance dashboard cards.
 */
export function StatCard({ label, value, subtext, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subtext != null && <p className="text-muted-foreground text-xs">{subtext}</p>}
      </CardContent>
    </Card>
  );
}
