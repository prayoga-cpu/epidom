/**
 * MVP Import Store
 *
 * React Context-based state for managing import flow
 * (Alternative to Zustand to avoid dependency issues)
 */

"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ParsedData, ColumnMapping, ImportPreviewProduct, ImportValidationError } from "./types";

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

interface ImportState {
  // Current step
  step: ImportStep;
  setStep: (step: ImportStep) => void;

  // File data
  fileName: string | null;
  parsedData: ParsedData | null;
  setFileData: (fileName: string, data: ParsedData) => void;

  // Column mappings
  mappings: ColumnMapping;
  setMapping: (field: keyof ColumnMapping, column: string | null) => void;
  setMappings: (mappings: ColumnMapping) => void;

  // Preview data
  previewProducts: ImportPreviewProduct[];
  validationErrors: ImportValidationError[];
  setPreviewData: (products: ImportPreviewProduct[], errors: ImportValidationError[]) => void;

  // Import result
  importedCount: number;
  skippedCount: number;
  setImportResult: (imported: number, skipped: number) => void;

  // Reset
  reset: () => void;
}

const initialMappings: ColumnMapping = {
  sku: null,
  name: null,
  costPrice: null,
  sellingPrice: null,
  currentStock: null,
  category: null,
  unit: null,
};

const ImportContext = createContext<ImportState | null>(null);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [mappings, setMappingsState] = useState<ColumnMapping>(initialMappings);
  const [previewProducts, setPreviewProducts] = useState<ImportPreviewProduct[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportValidationError[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const setFileData = useCallback((name: string, data: ParsedData) => {
    setFileName(name);
    setParsedData(data);
    setStep("mapping");
  }, []);

  const setMapping = useCallback((field: keyof ColumnMapping, column: string | null) => {
    setMappingsState((prev) => ({ ...prev, [field]: column }));
  }, []);

  const setMappings = useCallback((newMappings: ColumnMapping) => {
    setMappingsState(newMappings);
  }, []);

  const setPreviewData = useCallback(
    (products: ImportPreviewProduct[], errors: ImportValidationError[]) => {
      setPreviewProducts(products);
      setValidationErrors(errors);
      setStep("preview");
    },
    []
  );

  const setImportResult = useCallback((imported: number, skipped: number) => {
    setImportedCount(imported);
    setSkippedCount(skipped);
    setStep("complete");
  }, []);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName(null);
    setParsedData(null);
    setMappingsState(initialMappings);
    setPreviewProducts([]);
    setValidationErrors([]);
    setImportedCount(0);
    setSkippedCount(0);
  }, []);

  return (
    <ImportContext.Provider
      value={{
        step,
        setStep,
        fileName,
        parsedData,
        setFileData,
        mappings,
        setMapping,
        setMappings,
        previewProducts,
        validationErrors,
        setPreviewData,
        importedCount,
        skippedCount,
        setImportResult,
        reset,
      }}
    >
      {children}
    </ImportContext.Provider>
  );
}

export function useImportStore(): ImportState {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error("useImportStore must be used within an ImportProvider");
  }
  return context;
}
