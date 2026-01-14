/**
 * File Upload Component
 *
 * Premium drag & drop file uploader for CSV/XLSX
 */

"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle, FileCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseFile, autoDetectMappings } from "../file-parser";
import { useImportStore } from "../import-store";

export function FileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setFileData, setMappings } = useImportStore();

  const handleFile = useCallback(
    async (file: File) => {
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
    },
    [setFileData, setMappings]
  );

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
          "bg-card relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 transition-colors",
          isDragging
            ? "border-primary bg-accent"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50",
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
            <Loader2 className="text-primary h-10 w-10 animate-spin" />
            <div className="text-center">
              <p className="font-medium">Processing file...</p>
              <p className="text-muted-foreground text-sm">Analyzing columns</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-muted rounded-full p-4">
              <Upload className="text-muted-foreground h-8 w-8" />
            </div>
            <div className="mt-4 text-center">
              <p className="font-medium">{isDragging ? "Drop file here" : "Drag & drop file"}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                or <span className="text-primary hover:underline">browse computer</span>
              </p>
            </div>
            <div className="bg-background text-muted-foreground mt-4 flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>CSV, Excel</span>
            </div>
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-3 rounded-lg border p-4">
          <AlertCircle className="h-5 w-5" />
          <div className="flex-1 text-sm font-medium">{error}</div>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-destructive/20 h-8 w-8"
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Requirements Card */}
      <div className="bg-card rounded-lg border p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileCheck className="text-muted-foreground h-5 w-5" />
          <h4 className="font-semibold">File Requirements</h4>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 text-sm">
            <p className="font-medium">Required Columns</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1">
              <li>SKU / Product Code</li>
              <li>Product Name</li>
              <li>Cost Price / HPP</li>
              <li>Selling Price</li>
              <li>Stock Quantity</li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Optional Columns</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1">
              <li>Category</li>
              <li>Unit (default: Pcs)</li>
            </ul>
            <p className="text-muted-foreground mt-4 border-t pt-2 text-xs">
              Max 10,000 rows per import
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
