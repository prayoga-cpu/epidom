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
import { Sparkles, Upload, Check, AlertTriangle, X, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useAnalyzeImport, useExecuteImport, type AnalyzeResponse } from "./hooks/use-ai-import";
import type { EntityType } from "@/lib/ai/import/types";

import { useI18n } from "@/components/lang/i18n-provider";

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

export function SmartImportDialog({
  open,
  onOpenChange,
  storeId,
  defaultEntityType,
}: SmartImportDialogProps) {
  const { t } = useI18n();

  // Step configuration with i18n
  const STEPS = [
    { key: "upload", label: t("import.steps.upload"), icon: Upload },
    { key: "analyzing", label: t("import.steps.analysis"), icon: Sparkles },
    { key: "preview", label: t("import.steps.preview"), icon: FileSpreadsheet },
    { key: "results", label: t("import.steps.done"), icon: Check },
  ] as const;

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

  // Handle file upload - send file directly to AI (ChatGPT-style)
  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setStep("analyzing");

      try {
        // Send file directly to AI - no need to read as text first
        const result = await analyzeMutation.mutateAsync({
          storeId,
          file: selectedFile, // Pass File object directly
          entityType: selectedEntityType,
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
      // Debug: Log data being sent to backend (VISIBLE IN BROWSER CONSOLE)
      console.log("[SmartImport] Sending data to backend:", {
        rowCount: editedData.length,
        sampleRow: editedData[0],
        entityType: selectedEntityType || "material",
        firstSupplier: editedData.find(d => d.category === "Suppliers" || d.supplierName || d.contactPerson)
      });

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
        <DialogHeader className="px-6 pt-4 pb-10 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{t("import.title")}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {t("import.subtitle")}
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
          <div className="flex w-full items-center justify-center py-2 mt-2">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = getCurrentStepIndex() === idx;
              const isPast = getCurrentStepIndex() > idx;
              const isProcessing = (step === "analyzing" || step === "importing") && isCurrent;

              return (
                <div key={s.key} className="flex items-center">
                  {/* Connector Line */}
                  {idx > 0 && (
                    <div
                      className={cn(
                        "h-[3px] w-16 sm:w-24 transition-colors duration-300",
                        isPast || isCurrent ? "bg-primary" : "bg-gray-300 dark:bg-gray-700"
                      )}
                    />
                  )}

                  {/* Step Circle */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-[3px] transition-all duration-300 z-10 bg-background",
                        isCurrent && "border-primary bg-primary text-primary-foreground scale-110",
                        isPast && "border-primary bg-primary text-primary-foreground",
                        !isCurrent && !isPast && "border-muted text-muted-foreground"
                      )}
                    >
                      {isProcessing ? (
                        <LottieLoader size="sm" />
                      ) : isPast ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        "absolute top-11 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors duration-300",
                        isCurrent ? "text-primary font-semibold" : "text-muted-foreground",
                        !isCurrent && !isPast && "opacity-70"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
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
                  <LottieLoader size="xl" />
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
                ← {t("import.preview.startOver")}
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {t("import.preview.itemsReady")?.replace("{count}", editedData.length.toString())}
                </span>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  {t("import.preview.cancel")}
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={editedData.length === 0}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("import.preview.importAll")}
                </Button>
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>
                {t("import.results.close")}
              </Button>
            </div>
          )}

          {(step === "upload" || step === "analyzing") && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.actions.cancel")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
