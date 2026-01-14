/**
 * Export Card Component
 *
 * Premium export card with button
 */

"use client";

import { useState } from "react";
import { Download, CheckCircle, FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arrayToCSV, downloadCSV } from "../csv-export";

interface ExportCardProps {
  title: string;
  description: string;
  filename: string;
  getData: () => Promise<Record<string, unknown>[]>;
  headers?: { key: string; label: string }[];
  icon?: React.ElementType;
}

export function ExportCard({
  title,
  description,
  filename,
  getData,
  headers,
  icon: Icon = FileSpreadsheet,
}: ExportCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [rowCount, setRowCount] = useState<number | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExported(false);

    try {
      const data = await getData();
      setRowCount(data.length);

      if (data.length === 0) {
        alert("No data to export");
        return;
      }

      const csv = arrayToCSV(
        data,
        headers as { key: keyof (typeof data)[0]; label: string }[] | undefined
      );

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `${filename}-${dateStr}`);

      setExported(true);
      setTimeout(() => {
        setExported(false);
        setRowCount(null);
      }, 4000);
    } catch (error) {
      alert("Export failed");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="group bg-card hover:bg-accent/5 rounded-lg border p-4 transition-colors">
      <div className="flex items-start gap-4">
        <div className="bg-muted rounded-lg p-2.5">
          <Icon className="text-muted-foreground h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>

          {exported && rowCount !== null && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              {rowCount} rows exported
            </p>
          )}
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          size="sm"
          variant={exported ? "outline" : "secondary"}
          className={`h-8 min-w-[90px] gap-2 ${
            exported
              ? "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
              : "hover:bg-accent"
          }`}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Export
            </>
          ) : exported ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Done
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Export
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
