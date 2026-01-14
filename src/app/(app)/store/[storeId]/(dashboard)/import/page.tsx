/**
 * MVP Import Page
 *
 * Step 1: Upload CSV/XLSX → Parse → Store Products, Stock, COGS
 */

"use client";

import { ImportProvider, useImportStore } from "@/features/mvp/import/import-store";
import {
  FileUploader,
  ColumnMapper,
  ImportPreview,
  ImportComplete,
} from "@/features/mvp/import/components";
import { Upload, GitCompare, Eye, CheckCircle } from "lucide-react";

function ImportContent() {
  const { step } = useImportStore();

  const steps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "mapping", label: "Map Columns", icon: GitCompare },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "complete", label: "Complete", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(
    (s) => s.id === step || (step === "importing" && s.id === "preview")
  );

  return (
    <div className="space-y-8">
      {/* Header with Step Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Products</h1>
          <p className="text-muted-foreground mt-1">
            {step === "upload" && "Upload your product catalog from CSV or Excel file"}
            {step === "mapping" && "Map your file columns to product fields"}
            {step === "preview" && "Review the data before importing"}
            {step === "importing" && "Importing your products..."}
            {step === "complete" && "Import complete!"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : isCompleted
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">{s.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 w-4 mx-1 rounded transition-colors ${
                      index < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {step === "upload" && <FileUploader />}
        {step === "mapping" && <ColumnMapper />}
        {(step === "preview" || step === "importing") && <ImportPreview />}
        {step === "complete" && <ImportComplete />}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <ImportProvider>
      <ImportContent />
    </ImportProvider>
  );
}
