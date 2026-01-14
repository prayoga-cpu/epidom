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
        headers as { key: keyof typeof data[0]; label: string }[] | undefined
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
    <div className={`group rounded-xl border p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/30 ${
      exported ? "border-green-500/30 bg-green-500/5" : "bg-card"
    }`}>
      <div className="flex items-start gap-4">
        <div className={`rounded-xl p-3 transition-colors ${
          exported
            ? "bg-green-500/10"
            : "bg-muted group-hover:bg-primary/10"
        }`}>
          <Icon className={`h-5 w-5 ${
            exported
              ? "text-green-600"
              : "text-muted-foreground group-hover:text-primary"
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>

          {exported && rowCount !== null && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" />
              {rowCount} rows exported
            </p>
          )}
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          size="sm"
          variant={exported ? "outline" : "default"}
          className={`gap-2 min-w-[100px] ${
            exported ? "border-green-500 text-green-600 hover:bg-green-500/10" : ""
          }`}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting
            </>
          ) : exported ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Done
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
