/**
 * Smart Import Dialog
 *
 * AI-powered CSV import with multi-step wizard:
 * 1. Upload - Drag & drop file
 * 2. Analysis - AI processes the file
 * 3. Preview - Review mappings and data
 * 4. Results - Show import results
 */

"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Upload, Loader2, Check, AlertTriangle, X, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyzeImport, useExecuteImport, type AnalyzeResponse } from "./hooks/use-ai-import";
import type { EntityType } from "@/lib/ai/import/types";

// Sub-components
import { FileUploadStep } from "./components/file-upload-step";
import { AnalysisStep } from "./components/analysis-step";
import { PreviewStep } from "./components/preview-step";
import { ResultsStep } from "./components/results-step";

type ImportStep = "upload" | "analyzing" | "preview" | "importing" | "results";

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  defaultEntityType?: EntityType;
}

// Step configuration
const STEPS = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "analyzing", label: "Analysis", icon: Sparkles },
  { key: "preview", label: "Preview", icon: FileSpreadsheet },
  { key: "results", label: "Done", icon: Check },
] as const;

export function SmartImportDialog({
  open,
  onOpenChange,
  storeId,
  defaultEntityType,
}: SmartImportDialogProps) {
  // State
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | undefined>(
    defaultEntityType
  );
  const [editedData, setEditedData] = useState<Array<Record<string, string>>>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    summary?: {
      suppliers: { attempted: number; succeeded: number };
      materials: { attempted: number; succeeded: number };
      recipes: { attempted: number; succeeded: number };
      products: { attempted: number; succeeded: number };
      totalSucceeded: number;
    };
    error?: string;
  } | null>(null);

  // Mutations
  const analyzeMutation = useAnalyzeImport();
  const executeMutation = useExecuteImport();

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setStep("upload");
        setFile(null);
        setAnalysisResult(null);
        setEditedData([]);
        setImportResult(null);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  // Handle file upload
  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setStep("analyzing");

      try {
        const csvContent = await selectedFile.text();

        const result = await analyzeMutation.mutateAsync({
          storeId,
          csvContent,
          entityType: selectedEntityType,
          fileName: selectedFile.name,
        });

        setAnalysisResult(result);
        setEditedData(result.parsedData);

        // Determine entity type from analysis if not specified
        if (!selectedEntityType && result.analysis.structure.sections?.[0]?.entityType) {
          setSelectedEntityType(result.analysis.structure.sections[0].entityType);
        }

        setStep("preview");
      } catch (error) {
        console.error("Analysis failed:", error);
        setStep("upload");
      }
    },
    [storeId, selectedEntityType, analyzeMutation]
  );

  // Handle import execution
  const handleExecuteImport = useCallback(async () => {
    if (!analysisResult || editedData.length === 0) return;

    setStep("importing");

    try {
      const result = await executeMutation.mutateAsync({
        sessionId: analysisResult.sessionId,
        storeId,
        entityType: selectedEntityType || "material",
        data: editedData,
      });

      setImportResult(result);
      setStep("results");
    } catch (error) {
      console.error("Import failed:", error);
      setImportResult({
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      });
      setStep("results");
    }
  }, [analysisResult, editedData, storeId, selectedEntityType, executeMutation]);

  // Get current step index
  const getCurrentStepIndex = () => {
    switch (step) {
      case "upload": return 0;
      case "analyzing": return 1;
      case "preview": return 2;
      case "importing": return 2;
      case "results": return 3;
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-5xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Smart Import</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  AI-powered CSV import with intelligent field mapping
                </p>
              </div>
            </div>
            {file && (
              <Badge variant="secondary" className="gap-2">
                <FileSpreadsheet className="h-3 w-3" />
                {file.name}
              </Badge>
            )}
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = getCurrentStepIndex() === idx;
              const isPast = getCurrentStepIndex() > idx;
              const isProcessing = (step === "analyzing" || step === "importing") && isCurrent;

              return (
                <div key={s.key} className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                      isCurrent && "bg-primary text-primary-foreground",
                      isPast && "bg-primary/20 text-primary",
                      !isCurrent && !isPast && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPast ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "w-8 h-0.5 mx-1",
                        isPast ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === "upload" && (
            <FileUploadStep
              onFileSelect={handleFileSelect}
              selectedEntityType={selectedEntityType}
              onEntityTypeChange={setSelectedEntityType}
              isLoading={analyzeMutation.isPending}
            />
          )}

          {step === "analyzing" && (
            <AnalysisStep
              fileName={file?.name || "file.csv"}
              isLoading={analyzeMutation.isPending}
            />
          )}

          {step === "preview" && analysisResult && (
            <PreviewStep
              analysis={analysisResult.analysis}
              data={editedData}
              headers={analysisResult.headers}
              onDataChange={setEditedData}
              metrics={analysisResult.metrics}
            />
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative p-6 rounded-full bg-primary/10">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              </div>
              <h3 className="mt-6 text-lg font-semibold">Importing Data...</h3>
              <p className="text-muted-foreground mt-2">
                Processing {editedData.length} rows. Please wait.
              </p>
            </div>
          )}

          {step === "results" && importResult && (
            <ResultsStep result={importResult} onClose={() => handleOpenChange(false)} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30">
          {step === "preview" && (
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                ← Start Over
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {editedData.length} items ready to import
                </span>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={editedData.length === 0}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Import All
                </Button>
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          )}

          {(step === "upload" || step === "analyzing") && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
