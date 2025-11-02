"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportData } from "@/lib/utils/export";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  filename: string;
  columns?: Array<{ key: keyof T; header: string }>;
  title?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton<T extends Record<string, any>>({
  data,
  filename,
  columns,
  title,
  disabled = false,
  variant = "outline",
  size = "sm",
}: ExportButtonProps<T>) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    if (data.length === 0) {
      toast({
        title: t("messages.noDataToExport") || "No data to export",
        description: t("messages.noDataToExportDesc") || "There is no data available to export.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await exportData(data, format, filename, columns, title);
      toast({
        title: t("messages.exportSuccessful") || "Export successful",
        description: `${t("common.actions.export") || "Export"} ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: t("messages.exportFailed") || "Export failed",
        description: t("messages.exportFailedDesc") || "An error occurred while exporting the data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.actions.exporting") || "Exporting..."}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {t("common.actions.export") || "Export"}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="mr-2 h-4 w-4" />
          {t("common.actions.exportAsCsv") || "Export as CSV"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t("common.actions.exportAsExcel") || "Export as Excel"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="mr-2 h-4 w-4" />
          {t("common.actions.exportAsPdf") || "Export as PDF"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}





