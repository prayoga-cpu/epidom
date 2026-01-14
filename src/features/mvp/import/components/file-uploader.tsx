/**
 * File Upload Component
 *
 * Premium drag & drop file uploader for CSV/XLSX
 */

"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseFile, autoDetectMappings } from "../file-parser";
import { useImportStore } from "../import-store";

export function FileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setFileData, setMappings } = useImportStore();

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsProcessing(true);

    try {
      // Parse the file
      const parsedData = await parseFile(file);

      if (parsedData.rows.length === 0) {
        throw new Error("File contains no data rows");
      }

      // Auto-detect column mappings
      const detectedMappings = autoDetectMappings(parsedData.headers);

      // Set file data and go to mapping step
      setFileData(file.name, parsedData);
      setMappings(detectedMappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsProcessing(false);
    }
  }, [setFileData, setMappings]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div className="space-y-6">
      {/* Drop Zone - Premium Design */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-300",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
            : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30",
          isProcessing && "pointer-events-none opacity-60"
        )}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileInput}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
              <FileSpreadsheet className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Processing file...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Parsing and analyzing columns
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className={cn(
              "rounded-2xl p-5 transition-all duration-300",
              isDragging
                ? "bg-primary/10 scale-110"
                : "bg-gradient-to-br from-primary/10 to-primary/5"
            )}>
              <Upload className={cn(
                "h-10 w-10 transition-all duration-300",
                isDragging ? "text-primary scale-110" : "text-primary/70"
              )} />
            </div>
            <div className="mt-6 text-center">
              <p className="text-xl font-semibold">
                {isDragging ? "Drop your file here" : "Drag & drop your file"}
              </p>
              <p className="text-muted-foreground mt-2">
                or <span className="text-primary font-medium">click to browse</span>
              </p>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-full bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>CSV, Excel (.xlsx, .xls)</span>
            </div>
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 animate-in slide-in-from-top-2">
          <div className="rounded-full bg-destructive/10 p-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-destructive">Upload Failed</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 hover:bg-destructive/10"
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}

      {/* Requirements Card */}
      <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileCheck className="h-5 w-5 text-primary" />
          </div>
          <h4 className="font-semibold">File Requirements</h4>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-muted-foreground">Required Columns</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                SKU / Product Code
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Product Name
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Cost Price / HPP
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Selling Price
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Stock Quantity
              </li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-muted-foreground">Optional Columns</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                Category
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                Unit
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Max 10,000 rows per import
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
