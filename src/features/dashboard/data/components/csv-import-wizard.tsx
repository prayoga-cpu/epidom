"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  UploadCloud,
  Loader2,
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  FileText,
  Wand2,
  Eye,
  AlertCircle,
  Database,
  ArrowRight,
  Package,
  Trash2,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ImportAnalysis,
  MaterialFields,
  ProductFields,
  SupplierFields,
  RecipeFields,
} from "@/lib/ai/import-schema";
import { bulkImportData } from "@/features/dashboard/data/actions";
import { parseNumber, parseInteger, parseBoolean } from "@/lib/utils/number-parser";
import { cn } from "@/lib/utils";

interface CsvImportWizardProps {
  storeId: string;
  type: "material" | "product" | "supplier" | "recipe";
}

type StepPhase = "UPLOAD" | "ANALYZING" | "MAPPING" | "PREVIEW" | "IMPORTING" | "SUCCESS";

interface ValidationError {
  rowIndex: number;
  field: string;
  value: string;
  message: string;
}

const NUMERIC_FIELDS = [
  "unitCost",
  "costPrice",
  "sellingPrice",
  "currentStock",
  "minStock",
  "maxStock",
  "yieldQuantity",
  "productionTimeMinutes",
  "costPerBatch",
  "productionTime",
  "supplierPrice",
];

const REQUIRED_FIELDS: Record<string, string[]> = {
  material: ["name"],
  product: ["name"],
  supplier: ["name"],
  recipe: ["name"],
};

export function CsvImportWizard({ storeId, type }: CsvImportWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<StepPhase>("UPLOAD");
  const [currentStepIndex, setCurrentStepIndex] = useState(1);

  const [file, setFile] = useState<File | null>(null);
  const [csvRaw, setCsvRaw] = useState<string>("");
  const [fullCsvText, setFullCsvText] = useState<string>("");
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [mappings, setMappings] = useState<ImportAnalysis["mappings"]>([]);

  // Data State
  const [allTransformedData, setAllTransformedData] = useState<Record<string, any>[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importStats, setImportStats] = useState({
    total: 0,
    count: 0,
    errors: 0,
    skippedValidation: 0, // Rows skipped due to validation errors (user chose partial import)
    skippedDuplicate: 0, // Rows skipped due to duplicate detection in DB
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Pagination for Preview
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Computed: Get indices of rows with errors
  const invalidRowIndices = useMemo(() => {
    const indices = new Set<number>();
    validationErrors.forEach((e) => indices.add(e.rowIndex - 1)); // Convert to 0-based
    return indices;
  }, [validationErrors]);

  // Computed: Valid rows only (rows without any errors)
  const validRows = useMemo(() => {
    return allTransformedData.filter((_, idx) => !invalidRowIndices.has(idx));
  }, [allTransformedData, invalidRowIndices]);

  const invalidRowCount = invalidRowIndices.size;
  const validRowCount = allTransformedData.length - invalidRowCount;

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    switch (step) {
      case "UPLOAD":
        setCurrentStepIndex(1);
        break;
      case "ANALYZING":
        setCurrentStepIndex(2);
        break;
      case "MAPPING":
        setCurrentStepIndex(2);
        break;
      case "PREVIEW":
        setCurrentStepIndex(3);
        break;
      case "IMPORTING":
        setCurrentStepIndex(4);
        break;
      case "SUCCESS":
        setCurrentStepIndex(4);
        break;
    }
  }, [step]);

  const STEPS = [
    { id: 1, name: "Upload", icon: UploadCloud },
    { id: 2, name: "Map Columns", icon: Database },
    { id: 3, name: "Review & Edit", icon: Edit2 },
    { id: 4, name: "Import", icon: Package },
  ];

  const targetOptions = useMemo(() => {
    switch (type) {
      case "material":
        return MaterialFields.options;
      case "product":
        return ProductFields.options;
      case "supplier":
        return SupplierFields.options;
      case "recipe":
        return RecipeFields.options;
      default:
        return MaterialFields.options;
    }
  }, [type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Show loading for large files (>500KB)
      const isLargeFile = selectedFile.size > 500 * 1024;
      if (isLargeFile) setIsReadingFile(true);

      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target?.result as string;
        setFullCsvText(text);
        const preview = text.split("\n").slice(0, 50).join("\n");
        setCsvRaw(preview);
        setIsReadingFile(false);
      };

      reader.onerror = () => {
        toast({
          title: "File Read Error",
          description: "Could not read the file. Please try again or use a different file.",
          variant: "destructive",
        });
        setFile(null);
        setIsReadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      reader.readAsText(selectedFile);
    }
  };

  const resetWizard = () => {
    setStep("UPLOAD");
    setFile(null);
    setCsvRaw("");
    setFullCsvText("");
    setAnalysis(null);
    setMappings([]);
    setAllTransformedData([]);
    setValidationErrors([]);
    setCurrentPage(1);
    setShowConfirmation(false);
    setIsReadingFile(false);
    setImportStats({ total: 0, count: 0, errors: 0, skippedValidation: 0, skippedDuplicate: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(resetWizard, 300);
    }
  };

  const startAnalysis = async () => {
    if (!csvRaw) return;
    setStep("ANALYZING");

    try {
      const response = await fetch("/api/ai/analyze-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvPreview: csvRaw, type }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const result: ImportAnalysis = await response.json();
      setAnalysis(result);
      setMappings(result.mappings);
      setStep("MAPPING");
    } catch (error) {
      toast({
        title: "Analysis Failure",
        description: "Could not analyze the CSV. Please try again or check the file format.",
        variant: "destructive",
      });
      setStep("UPLOAD");
    }
  };

  const updateMapping = (index: number, newTarget: string) => {
    const updated = [...mappings];
    // @ts-ignore
    updated[index].targetField = newTarget;
    setMappings(updated);
  };

  // --- VALIDATION AND TRANSFORMATION LOGIC ---

  /**
   * Validate a single object. Returns array of errors for this object.
   */
  const validateItem = (item: Record<string, any>, rowIndex: number): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Check required fields
    const requiredFields = REQUIRED_FIELDS[type] || [];
    requiredFields.forEach((field) => {
      if (!item[field] || (typeof item[field] === "string" && !item[field].trim())) {
        errors.push({
          rowIndex,
          field,
          value: "",
          message: `Required`,
        });
      }
    });

    // Check numeric validity
    NUMERIC_FIELDS.forEach((field) => {
      if (item[field] !== undefined) {
        const val = item[field];
        // If it's a number 0, it's fine. If it's NaN, it's an error.
        if (typeof val === "number" && isNaN(val)) {
          errors.push({
            rowIndex,
            field,
            value: String(val),
            message: "Invalid Number",
          });
        }
      }
    });

    return errors;
  };

  /**
   * Run validation on all data and update validationErrors state
   */
  const revalidateAll = (data: Record<string, any>[]) => {
    const allErrors: ValidationError[] = [];
    data.forEach((item, idx) => {
      // idx + 1 for user-friendly 1-based indexing
      const itemErrors = validateItem(item, idx + 1);
      allErrors.push(...itemErrors);
    });
    setValidationErrors(allErrors);
  };

  const transformRow = (row: string[]): Record<string, any> => {
    const item: Record<string, any> = {};

    mappings.forEach((map) => {
      if ((map.targetField as string) === "SKIP" || row[map.csvIndex] === undefined) {
        return;
      }

      const rawValue = row[map.csvIndex]?.trim() || "";
      const field = map.targetField;

      try {
        if (NUMERIC_FIELDS.includes(field)) {
          const parsed = parseNumber(rawValue);
          item[field] = parsed; // We store 0 even if parsing fails, validation will catch logic errors if needed
        } else if (map.transform === "BOOLEAN_Y_N") {
          item[field] = parseBoolean(rawValue);
        } else if (map.transform === "EXTRACT_NUMBER") {
          item[field] = parseNumber(rawValue);
        } else if (map.transform === "EXTRACT_INT") {
          item[field] = parseInteger(rawValue);
        } else if (map.transform === "UPPERCASE") {
          item[field] = rawValue.toUpperCase();
        } else if (map.transform === "LOWERCASE") {
          item[field] = rawValue.toLowerCase();
        } else if (map.transform === "TITLECASE") {
          item[field] = rawValue.replace(
            /\w\S*/g,
            (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
        } else {
          item[field] = rawValue;
        }
      } catch (e) {
        item[field] = rawValue;
      }
    });
    return item;
  };

  const generatePreview = () => {
    if (!analysis || !fullCsvText) return;

    let startIndex = analysis.structure.dataStartIndex;
    if (startIndex === analysis.structure.headerRowIndex) {
      startIndex = startIndex + 1;
    }

    const lines = fullCsvText.split(/\r?\n/);
    const potentialHeaderLine = lines[startIndex]?.toLowerCase() || "";
    const headerSignatures = mappings
      .map((m) => m.csvHeader.toLowerCase())
      .filter((h) => h.length > 2);
    const isHeader = headerSignatures.some((sig) => potentialHeaderLine.includes(sig));
    if (isHeader) startIndex++;

    const validLines = lines.slice(startIndex).join("\n");

    Papa.parse(validLines, {
      header: false,
      skipEmptyLines: true,
      complete: (results: { data: string[][] }) => {
        const rawRows = results.data;
        const transformed = rawRows.map((row) => transformRow(row));

        const validData = transformed.filter((item) =>
          Object.values(item).some((v) => v !== "" && v !== 0 && v !== null && v !== undefined)
        );

        setAllTransformedData(validData);
        revalidateAll(validData); // Initial validation
        setStep("PREVIEW");
      },
    });
  };

  // --- EDITING LOGIC ---

  const handleCellChange = (rowIndex: number, field: string, value: string) => {
    const newData = [...allTransformedData];
    const item = { ...newData[rowIndex] };

    // Parse input value based on field type
    if (NUMERIC_FIELDS.includes(field)) {
      // Smart parse: allow user to type "Rp 5000" and get 5000
      item[field] = parseNumber(value);
    } else {
      item[field] = value;
    }

    newData[rowIndex] = item;
    setAllTransformedData(newData);

    // Revalidate just this one doesn't ensure global error index is correct if rows shifted (deleted)
    // But for performance, full revalidate is safe for <1000 rows.
    revalidateAll(newData);
  };

  const deleteRow = (rowIndex: number) => {
    const newData = allTransformedData.filter((_, idx) => idx !== rowIndex);
    setAllTransformedData(newData);
    revalidateAll(newData);
  };

  const handleImportClick = () => {
    if (validRowCount === 0) {
      toast({
        title: "No Valid Data",
        description: "All rows have errors. Please fix them before importing.",
        variant: "destructive",
      });
      return;
    }

    // If there are errors, show confirmation
    if (invalidRowCount > 0) {
      setShowConfirmation(true);
    } else {
      // No errors, proceed directly
      executeImport();
    }
  };

  const executeImport = async () => {
    setShowConfirmation(false);
    if (validRows.length === 0) return;
    setStep("IMPORTING");

    try {
      // Import only valid rows
      const res = await bulkImportData({
        storeId,
        type,
        data: validRows,
      });

      if (res.success) {
        const dbSkipped = validRows.length - (res.count || 0); // Rows that passed validation but DB skipped (duplicates)
        setImportStats({
          total: allTransformedData.length,
          count: res.count || 0,
          errors: invalidRowCount + dbSkipped,
          skippedValidation: invalidRowCount,
          skippedDuplicate: dbSkipped,
        });
        setStep("SUCCESS");
      } else {
        toast({
          title: "Import Error",
          description: res.error,
          variant: "destructive",
        });
        setStep("PREVIEW");
      }
    } catch (error) {
      toast({
        title: "Server Error",
        description: "An unexpected error occurred during import.",
        variant: "destructive",
      });
      setStep("PREVIEW");
    }
  };

  const typeLabels: Record<string, string> = {
    material: "Ingredients",
    product: "Products",
    supplier: "Suppliers",
    recipe: "Recipes",
  };

  const previewColumns = useMemo(() => {
    const mapped = mappings
      .filter((m) => (m.targetField as string) !== "SKIP")
      .map((m) => m.targetField);
    return [...new Set(mapped)];
  }, [mappings]);

  // Pagination Logic
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return allTransformedData.slice(start, start + rowsPerPage);
  }, [allTransformedData, currentPage]);

  const totalPages = Math.ceil(allTransformedData.length / rowsPerPage);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wand2 className="h-4 w-4" />
          AI Smart Import
        </Button>
      </DialogTrigger>

      <FormDialogLayout
        title={`Smart Import: ${typeLabels[type]}`}
        description="Review and correct data before importing to specific entity."
        maxWidth="2xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (step === "MAPPING") setStep("UPLOAD");
                else if (step === "PREVIEW") setStep("MAPPING");
                else if (step === "SUCCESS") setIsOpen(false);
                else setIsOpen(false);
              }}
              disabled={step === "ANALYZING" || step === "IMPORTING"}
            >
              {step === "UPLOAD" || step === "SUCCESS" ? (
                "Close"
              ) : (
                <>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </>
              )}
            </Button>

            {step === "UPLOAD" && (
              <Button onClick={startAnalysis} disabled={!file || isReadingFile}>
                {isReadingFile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reading...
                  </>
                ) : (
                  <>
                    Analyze File
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
            {step === "ANALYZING" && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </Button>
            )}
            {step === "MAPPING" && (
              <Button onClick={generatePreview}>
                Review Data
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === "PREVIEW" && (
              <Button
                onClick={handleImportClick}
                disabled={validRowCount === 0}
                variant={invalidRowCount > 0 ? "outline" : "default"}
                className={
                  invalidRowCount > 0
                    ? "border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                    : ""
                }
              >
                {invalidRowCount > 0 ? (
                  <>Import {validRowCount} Valid Rows</>
                ) : (
                  <>Import {allTransformedData.length} Items</>
                )}
                <Package className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === "IMPORTING" && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </Button>
            )}
            {step === "SUCCESS" && <Button onClick={() => setIsOpen(false)}>Done</Button>}
          </div>
        }
      >
        {/* STEPPER */}
        <div className="border-border mb-6 flex w-full items-center justify-between border-b px-2 pb-4">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = currentStepIndex === s.id;
            const isCompleted = currentStepIndex > s.id;

            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                          ? "border-primary bg-background text-primary"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-[10px] font-medium tracking-wider uppercase",
                      isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </span>
                </div>

                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 mb-4 h-[2px] flex-1 rounded-full",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* VIEW 1: UPLOAD */}
        {step === "UPLOAD" && (
          <div className="flex flex-col items-center justify-center py-10">
            <div
              className="border-muted-foreground/25 bg-muted/5 hover:bg-muted/20 flex w-full max-w-sm cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-accent mb-4 rounded-full p-4">
                <UploadCloud className="text-primary h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Upload CSV</h3>
              <p className="text-muted-foreground mt-1 text-sm">Drag & drop or click to browse</p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <Card className="border-primary/20 bg-primary/5 mt-6 w-full max-w-sm">
                <CardContent className="flex items-center gap-3 p-3">
                  {isReadingFile ? (
                    <Loader2 className="text-primary h-8 w-8 animate-spin" />
                  ) : (
                    <FileText className="text-primary h-8 w-8" />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {isReadingFile ? "Reading file..." : `${(file.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetWizard}
                    className="h-8 w-8"
                    disabled={isReadingFile}
                  >
                    <X className="text-muted-foreground hover:text-destructive h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* VIEW 2: ANALYZING */}
        {step === "ANALYZING" && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-4 h-16 w-16">
              <Loader2 className="text-primary/30 absolute inset-0 h-full w-full animate-spin" />
              <Wand2 className="text-primary absolute inset-0 m-auto h-8 w-8 animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold">AI Analysis in Progress</h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-xs">
              Detecting schema, format, and content...
            </p>
          </div>
        )}

        {/* VIEW 3: MAPPING */}
        {step === "MAPPING" && analysis && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <Alert variant="default" className="bg-accent/50 border-accent text-foreground">
              <Wand2 className="text-primary h-4 w-4" />
              <AlertTitle className="text-primary font-medium">Analysis Complete</AlertTitle>
              <AlertDescription className="text-muted-foreground mt-1 text-xs">
                {analysis.summary}
              </AlertDescription>
            </Alert>

            <div className="bg-card rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40%]">CSV Column</TableHead>
                    <TableHead className="w-[20%]">Confidence</TableHead>
                    <TableHead className="w-[40%]">Map To Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((map, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {map.csvHeader || (
                          <span className="text-muted-foreground italic">
                            Column {map.csvIndex + 1}
                          </span>
                        )}
                        <p className="text-muted-foreground max-w-[150px] truncate text-[10px]">
                          {map.reasoning}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            map.confidence === "HIGH"
                              ? "default"
                              : map.confidence === "MEDIUM"
                                ? "secondary"
                                : "outline"
                          }
                          className={cn(
                            "text-[10px]",
                            map.confidence === "HIGH" && "bg-primary hover:bg-primary/90"
                          )}
                        >
                          {map.confidence}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={map.targetField}
                          onValueChange={(val) => updateMapping(idx, val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SKIP" className="text-muted-foreground">
                              Don't Import (Skip)
                            </SelectItem>
                            {targetOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {map.transform !== "NONE" && (
                          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                            <Wand2 className="h-3 w-3" /> {map.transform}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* VIEW 4: REVIEW & EDIT */}
        {step === "PREVIEW" && (
          <div className="animate-in fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  Page {currentPage} of {totalPages}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {allTransformedData.length} total rows
                </span>
              </div>

              {validationErrors.length > 0 ? (
                <Badge variant="destructive" className="animate-pulse">
                  {invalidRowCount} Rows with Issues
                </Badge>
              ) : (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  <Check className="mr-1 h-3 w-3" /> All Valid
                </Badge>
              )}
            </div>

            {/* CONFIRMATION ALERT */}
            {showConfirmation && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400">
                  Confirm Partial Import
                </AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-300">
                  <p className="mb-3">
                    <strong>{invalidRowCount} rows</strong> have errors and will be skipped. Only{" "}
                    <strong>{validRowCount} valid rows</strong> will be imported.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
                      onClick={() => setShowConfirmation(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-600 text-white hover:bg-amber-700"
                      onClick={executeImport}
                    >
                      Import {validRowCount} Valid Rows
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* TABLE WITH EDITING */}
            <div className="bg-card overflow-hidden rounded-md border">
              <ScrollArea className="h-[400px] w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 sticky top-0 z-10">
                      <TableHead className="w-10 text-center">#</TableHead>
                      {previewColumns.map((col) => (
                        <TableHead key={col} className="min-w-[120px]">
                          {col}
                        </TableHead>
                      ))}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row, idx) => {
                      // Calculate actual index based on pagination
                      const actualIndex = (currentPage - 1) * rowsPerPage + idx;
                      // Find errors for this specific row
                      const rowErrors = validationErrors.filter(
                        (e) => e.rowIndex === actualIndex + 1
                      );

                      return (
                        <TableRow
                          key={actualIndex}
                          className={cn(
                            rowErrors.length > 0 && "bg-destructive/5 hover:bg-destructive/10"
                          )}
                        >
                          <TableCell className="text-muted-foreground text-center font-mono text-xs">
                            {actualIndex + 1}
                          </TableCell>
                          {previewColumns.map((col) => {
                            const error = rowErrors.find((e) => e.field === col);
                            return (
                              <TableCell key={col} className="p-1">
                                <div className="relative">
                                  <Input
                                    className={cn(
                                      "hover:bg-muted focus:bg-background focus:border-input h-8 border-transparent bg-transparent text-xs transition-colors",
                                      error &&
                                        "border-destructive/50 bg-destructive/5 text-destructive pr-8"
                                    )}
                                    value={row[col] === undefined ? "" : String(row[col])}
                                    // If number, we might want to format, but for edit keep it raw-ish
                                    onChange={(e) =>
                                      handleCellChange(actualIndex, col, e.target.value)
                                    }
                                  />
                                  {error && (
                                    <div
                                      className="text-destructive absolute top-1/2 right-2 -translate-y-1/2"
                                      title={error.message}
                                    >
                                      <AlertCircle className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-8 w-8"
                              onClick={() => deleteRow(actualIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* IMPORTING VIEW */}
        {step === "IMPORTING" && (
          <div className="animate-in fade-in flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6 h-20 w-20">
              <div className="border-muted absolute inset-0 rounded-full border-4"></div>
              <div className="border-primary absolute inset-0 animate-spin rounded-full border-4 border-t-transparent"></div>
              <Database className="text-primary absolute inset-0 m-auto h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold">Importing Data...</h3>
            <p className="text-muted-foreground mt-2">Writing to database...</p>
          </div>
        )}

        {/* SUCCESS VIEW */}
        {step === "SUCCESS" && (
          <div className="animate-in zoom-in-50 flex flex-col items-center justify-center py-10 text-center duration-300">
            <div className="mb-6 rounded-full bg-green-100 p-6 dark:bg-green-900/20">
              <Check className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Import Successful</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Your data has been successfully imported into the system.
            </p>

            {/* Main Stats */}
            <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-4">
              <div className="bg-card flex flex-col items-center rounded-lg border p-4 shadow-sm">
                <span className="text-2xl font-bold">{importStats.total}</span>
                <span className="text-muted-foreground mt-1 text-[10px] tracking-wider uppercase">
                  Found
                </span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800 dark:bg-green-900/10">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {importStats.count}
                </span>
                <span className="mt-1 text-[10px] tracking-wider text-green-600/80 uppercase dark:text-green-400/80">
                  Added
                </span>
              </div>
              <div className="bg-card flex flex-col items-center rounded-lg border p-4 shadow-sm">
                <span className="text-muted-foreground text-2xl font-bold">
                  {importStats.errors}
                </span>
                <span className="text-muted-foreground mt-1 text-[10px] tracking-wider uppercase">
                  Skipped
                </span>
              </div>
            </div>

            {/* Detailed Breakdown (only show if there were skips) */}
            {importStats.errors > 0 && (
              <div className="bg-muted/30 mt-4 w-full max-w-md rounded-lg border p-3 text-xs">
                <h4 className="text-muted-foreground mb-2 font-medium">Skip Breakdown:</h4>
                <div className="text-muted-foreground flex justify-center gap-6">
                  {importStats.skippedValidation > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span>{importStats.skippedValidation} validation errors</span>
                    </div>
                  )}
                  {importStats.skippedDuplicate > 0 && (
                    <div className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-blue-500" />
                      <span>{importStats.skippedDuplicate} duplicates</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </FormDialogLayout>
    </Dialog>
  );
}
