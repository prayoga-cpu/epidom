"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { SortIcon } from "@/features/dashboard/shared/components/sort-icon";

/**
 * Pieces shared by the two Finance reports — the single-outlet report
 * (FinanceClient) and the All outlets roll-up (AllOutletsReport) — so both
 * sort and fail the same way.
 */

export function SortableHead({
  active,
  dir,
  onClick,
  children,
  align,
}: {
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  children: ReactNode;
  align?: "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        className={`hover:text-foreground flex items-center font-semibold ${
          align === "right" ? "ml-auto" : ""
        }`}
        onClick={onClick}
      >
        {children}
        <SortIcon active={active} dir={dir} />
      </button>
    </TableHead>
  );
}

/**
 * A report tab/query must never go from "visible" to silently blank on
 * error — every `X.isLoading`/`X.isError` pair renders through one of these
 * instead of a bare `{data && ...}`/`isLoading ? "Loading..." : ...` that has
 * no failure branch.
 */
export function ReportStatus({
  isError,
  onRetry,
  loadingLabel,
  errorLabel,
  retryLabel,
}: {
  isError: boolean;
  onRetry: () => void;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
}) {
  if (!isError) return <>{loadingLabel}</>;
  return (
    <div className="flex flex-col items-center gap-2">
      <AlertCircle className="text-destructive h-5 w-5" />
      <p>{errorLabel}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

export function ReportStatusRow({
  isError,
  colSpan,
  onRetry,
  loadingLabel,
  errorLabel,
  retryLabel,
}: {
  isError: boolean;
  colSpan: number;
  onRetry: () => void;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground py-8 text-center">
        <ReportStatus
          isError={isError}
          onRetry={onRetry}
          loadingLabel={loadingLabel}
          errorLabel={errorLabel}
          retryLabel={retryLabel}
        />
      </TableCell>
    </TableRow>
  );
}

export interface TotalsLine {
  label: string;
  value: string;
  /** "total" for the bottom line, "subtotal" for an intermediate one. */
  emphasis?: "total" | "subtotal";
}

/**
 * The totals of a report tab on a phone, where the table is replaced by row
 * cards: one card closing the list, its lines aligned like a till receipt.
 */
export function TotalsCard({ title, lines }: { title: string; lines: TotalsLine[] }) {
  return (
    <div className="bg-card space-y-1.5 rounded-lg border p-4">
      <p className="font-medium">{title}</p>
      {lines.map((line) => (
        <div
          key={line.label}
          className={`flex items-baseline justify-between gap-3 text-sm ${
            line.emphasis === "total"
              ? "border-t pt-1.5 font-semibold"
              : line.emphasis === "subtotal"
                ? "font-medium"
                : "text-muted-foreground"
          }`}
        >
          <span>{line.label}</span>
          <span className="text-foreground tabular-nums">{line.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Says which of the page's active filters a tab does not apply — e.g. the
 * Category filter on By Channel — so a filtered view never silently shows
 * unfiltered figures.
 */
export function FilterScopeNote({ ignored, template }: { ignored: string[]; template: string }) {
  if (ignored.length === 0) return null;
  return (
    <p className="text-muted-foreground mb-3 text-xs">
      {template.replace("{filters}", ignored.join(", "))}
    </p>
  );
}
