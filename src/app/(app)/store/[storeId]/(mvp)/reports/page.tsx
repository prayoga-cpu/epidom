/**
 * MVP Reports Page
 *
 * Premium export page for Google Sheets
 */

import { getReportsSummary } from "@/features/mvp/reports/actions";
import { ReportsDashboard } from "@/features/mvp/reports/components";
import { FileSpreadsheet } from "lucide-react";

interface ReportsPageProps {
  params: Promise<{ storeId: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { storeId } = await params;

  // Fetch summary data server-side
  const summary = await getReportsSummary(storeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 p-3">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Export</h1>
          <p className="text-muted-foreground">
            Export your data to CSV for Google Sheets
          </p>
        </div>
      </div>

      {/* Reports Dashboard */}
      <ReportsDashboard summary={summary} />
    </div>
  );
}
