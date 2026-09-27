"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FinanceClient } from "./finance-client";
import { AllOutletsReport } from "./all-outlets-report";
import { FinanceScopeSwitch, type FinanceScope } from "./finance-scope-switch";

interface FinanceReportProps {
  storeId: string;
  staff: Array<{ id: string; name: string; role: string; isActive: boolean }>;
  categories: Array<{ id: string; name: string }>;
  /** The business has more than one outlet AND the viewer is its owner (not
   * a staff persona) — decided server-side by the page. */
  canViewAllOutlets: boolean;
}

/**
 * Finance page root. `?scope=all` shows every outlet side by side; anything
 * else is this outlet's full report. The two are separate components rather
 * than one with a mode flag because they share no queries: mounting the
 * single-outlet report fires a dozen store-scoped requests that the roll-up
 * would only have to disable one by one.
 */
export function FinanceReport({
  storeId,
  staff,
  categories,
  canViewAllOutlets,
}: FinanceReportProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // A stale ?scope=all link opened by someone who can't see the roll-up (a
  // single-outlet business, a manager persona) just gets this outlet's report.
  const scope: FinanceScope =
    canViewAllOutlets && searchParams.get("scope") === "all" ? "all" : "store";

  const setScope = (next: FinanceScope) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.set("scope", "all");
    else params.delete("scope");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const scopeSwitch = canViewAllOutlets ? (
    <FinanceScopeSwitch scope={scope} onChange={setScope} />
  ) : null;

  if (scope === "all") {
    return <AllOutletsReport scopeSwitch={scopeSwitch} />;
  }
  return (
    <FinanceClient
      storeId={storeId}
      staff={staff}
      categories={categories}
      scopeSwitch={scopeSwitch}
    />
  );
}
