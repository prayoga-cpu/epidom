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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ImportAnalysis,
  MaterialFields,
  ProductFields,
  SupplierFields,
  RecipeFields,
  VISUAL_GROUPING_FIELDS,
  COMMON_FIELDS,
} from "@/lib/ai/import-schema";
import { bulkImportData, bulkImportMultiEntity } from "@/features/dashboard/data/actions";
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
  "supplierPrice",
];

const REQUIRED_FIELDS: Record<string, string[]> = {
  material: ["name"],
  product: ["name"],
  supplier: ["name"],
  recipe: ["name"],
};

const FIELD_LABELS: Record<string, string> = {
  // Common
  name: "Name",
  category: "Category",
  description: "Description",

  // Material
  unit: "Unit (kg/pcs)",
  unitCost: "Cost per Unit",
  currentStock: "Current Stock",
  minStock: "Minimum Stock",
  maxStock: "Maximum Stock",
  sku: "SKU / Code",
  supplierName: "Supplier Name",
  supplierPrice: "Supplier Price",

  // Product
  costPrice: "Cost Price (HPP)",

  // Supplier
  contactPerson: "Contact Person",
  phone: "Phone Number",
  email: "Email Address",
  address: "Address",
  city: "City",
  country: "Country",
  notes: "Notes",

  // Recipe
  yieldQuantity: "Yield Quantity (Result)",
  yieldUnit: "Yield Unit (Result Unit)",
  productionTimeMinutes: "Production Time (Minutes)",
  costPerBatch: "Cost per Batch",
  instructions: "Instructions",
  ingredients_text: "Ingredients (Text)",
  ingredient_name: "Ingredient Name",
  ingredient_qty: "Ingredient Quantity",
  ingredient_unit: "Ingredient Unit",
  ingredient_sku: "Ingredient SKU",
  ingredient_supplier: "Ingredient Supplier",
  ingredient_price: "Ingredient Price/Cost",
  ingredient_stock: "Ingredient Stock",
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

  // Smart Tabbed Preview State (Default to available tab after analysis, handled in useEffect)
  const [activeEntityTab, setActiveEntityTab] = useState<string>("supplier");

  // Multi-entity import summary (for Smart All-in-One Import)
  const [multiEntitySummary, setMultiEntitySummary] = useState<{
    suppliers: { attempted: number; succeeded: number };
    materials: { attempted: number; succeeded: number };
    recipes: { attempted: number; succeeded: number };
    products: { attempted: number; succeeded: number };
    totalSucceeded: number;
  } | null>(null);

  // Pagination for Preview
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Computed: Get indices of rows with errors (Filtered by Active Tab)
  const invalidRowIndices = useMemo(() => {
    const indices = new Set<number>();

    // Filter validation errors to only those relevant to current view
    const relevantErrors = validationErrors.filter((e) => {
      // e.rowIndex is 1-based index from original full dataset
      const originalIndex = e.rowIndex - 1;
      const row = allTransformedData[originalIndex];

      // Re-use filter logic (DRY violation but necessary unless refactored)
      const hasValue = (field: string) =>
        row[field] !== undefined && row[field] !== "" && row[field] !== null && row[field] !== 0;

      if (activeEntityTab === "supplier") {
        return (VISUAL_GROUPING_FIELDS.supplier as readonly string[]).some(hasValue);
      }
      if (activeEntityTab === "material") {
        return (VISUAL_GROUPING_FIELDS.material as readonly string[]).some(hasValue);
      }
      if (activeEntityTab === "recipe") {
        return (
          (VISUAL_GROUPING_FIELDS.recipe as readonly string[]).some(hasValue) ||
          (VISUAL_GROUPING_FIELDS.ingredient as readonly string[]).some(hasValue) ||
          Object.keys(row).some((k) => k.startsWith("ingredient_") && hasValue(k))
        );
      }
      if (activeEntityTab === "product") {
        return (VISUAL_GROUPING_FIELDS.product as readonly string[]).some(hasValue);
      }
      return true;
    });

    relevantErrors.forEach((e) => indices.add(e.rowIndex - 1)); // Convert to 0-based
    return indices;
  }, [validationErrors, activeEntityTab, allTransformedData]);

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

  // ALL possible fields grouped for display (Smart All-in-One)
  const groupedTargetOptions = useMemo(() => {
    const groups = [
      { label: "Materials & Common", fields: MaterialFields.options },
      { label: "Products", fields: ProductFields.options },
      { label: "Suppliers", fields: SupplierFields.options },
      { label: "Recipes", fields: RecipeFields.options },
    ];

    const seen = new Set<string>();
    const result: { label: string; options: string[] }[] = [];

    for (const g of groups) {
      const uniqueFields = g.fields.filter((f) => !seen.has(f));
      uniqueFields.forEach((f) => seen.add(f));
      if (uniqueFields.length > 0) {
        result.push({ label: g.label, options: uniqueFields });
      }
    }
    return result;
  }, []);

  // Restore flat list for validation logic
  const allTargetOptions = useMemo(() => {
    return groupedTargetOptions.flatMap((g) => g.options);
  }, [groupedTargetOptions]);

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
        body: JSON.stringify({ csvPreview: csvRaw, type, storeId }),
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
      // SMART ALL-IN-ONE IMPORT: Use multi-entity import
      const res = await bulkImportMultiEntity({
        storeId,
        data: validRows,
      });

      if (res.success) {
        // Store multi-entity summary for detailed success display
        setMultiEntitySummary(res.summary);
        setImportStats({
          total: allTransformedData.length,
          count: res.summary.totalSucceeded,
          errors: allTransformedData.length - res.summary.totalSucceeded,
          skippedValidation: invalidRowCount,
          skippedDuplicate: 0,
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
    // SMART ALL-IN-ONE IMPORT:
    // Accept ALL valid mapped columns from CSV, regardless of current tab type.
    // This allows importing mixed-entity CSV files from any tab.
    const allAllowedFields = new Set<string>(allTargetOptions);

    const mapped = mappings
      .filter(
        (m) => (m.targetField as string) !== "SKIP" && allAllowedFields.has(m.targetField as string)
      )
      .map((m) => m.targetField as string);

    // Only show columns that are actually mapped (no empty columns for mixed import)
    const combined = [...new Set(mapped)];

    // UNIVERSAL PRIORITY ORDER for Smart Import (Visual Hierarchy)
    // Order: Identity -> Classification -> Metrics -> Details -> Contact Info
    const universalPriorityOrder = [
      // === IDENTITY (First) ===
      "name",
      "sku",
      "category",
      "description",

      // === CORE METRICS (Money & Stock) ===
      "sellingPrice",
      "costPrice",
      "unitCost",
      "currentStock",
      "unit",

      // === RECIPE SPECIFICS ===
      "yieldQuantity",
      "yieldUnit",
      "productionTimeMinutes",
      "costPerBatch",
      "instructions",
      "ingredient_name",
      "ingredient_qty",
      "ingredient_unit",

      // === SUPPLIER / CONTACT INFO (Last) ===
      "supplierName",
      "contactPerson",
      "phone",
      "email",
      "address",
      "city",
      "country",
      "notes",
      "minStock",
      "maxStock",
      "supplierPrice",
    ];

    let filteredColumns = combined;

    // Filter columns based on Active Tab
    if (activeEntityTab !== "all") {
      filteredColumns = combined.filter((col) => {
        if (activeEntityTab === "supplier")
          return (VISUAL_GROUPING_FIELDS.supplier as readonly string[]).includes(col);
        if (activeEntityTab === "material")
          return (VISUAL_GROUPING_FIELDS.material as readonly string[]).includes(col);
        if (activeEntityTab === "recipe")
          return (
            (VISUAL_GROUPING_FIELDS.recipe as readonly string[]).includes(col) ||
            (VISUAL_GROUPING_FIELDS.ingredient as readonly string[]).includes(col) ||
            col.startsWith("ingredient_")
          );
        if (activeEntityTab === "product")
          return (VISUAL_GROUPING_FIELDS.product as readonly string[]).includes(col);
        return false;
      });
    }

    // Always include common fields in relevant tabs if mapped
    if (activeEntityTab !== "all") {
      const commonMapped = combined.filter((col) =>
        (COMMON_FIELDS as readonly string[]).includes(col)
      );
      filteredColumns = [...new Set([...filteredColumns, ...commonMapped])];
    }

    return filteredColumns.sort((a, b) => {
      const indexA = universalPriorityOrder.indexOf(a);
      const indexB = universalPriorityOrder.indexOf(b);
      // If found in priority list, use that index. Otherwise push to end logic.
      const valA = indexA === -1 ? 999 : indexA;
      const valB = indexB === -1 ? 999 : indexB;
      return valA - valB;
    });
  }, [mappings, allTargetOptions, activeEntityTab]);

  // Determine available tabs based on mapped columns
  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    const mappedFields = new Set(mappings.map((m) => m.targetField as string));

    if ((VISUAL_GROUPING_FIELDS.supplier as readonly string[]).some((f) => mappedFields.has(f)))
      tabs.push("supplier");

    if ((VISUAL_GROUPING_FIELDS.material as readonly string[]).some((f) => mappedFields.has(f)))
      tabs.push("material");

    if (
      (VISUAL_GROUPING_FIELDS.recipe as readonly string[]).some((f) => mappedFields.has(f)) ||
      (VISUAL_GROUPING_FIELDS.ingredient as readonly string[]).some((f) => mappedFields.has(f))
    )
      tabs.push("recipe");

    if ((VISUAL_GROUPING_FIELDS.product as readonly string[]).some((f) => mappedFields.has(f)))
      tabs.push("product");

    return tabs;
  }, [mappings]);

  // Auto-select first available tab when entering Preview
  useEffect(() => {
    if (
      step === "PREVIEW" &&
      availableTabs.length > 0 &&
      !availableTabs.includes(activeEntityTab)
    ) {
      setActiveEntityTab(availableTabs[0]);
    }
  }, [step, availableTabs, activeEntityTab]);

  // Filter data based on active tab
  const filteredData = useMemo(() => {
    return allTransformedData.filter((row) => {
      const hasValue = (field: string) =>
        row[field] !== undefined && row[field] !== "" && row[field] !== null && row[field] !== 0;

      if (activeEntityTab === "supplier") {
        return (VISUAL_GROUPING_FIELDS.supplier as readonly string[]).some(hasValue);
      }
      if (activeEntityTab === "material") {
        return (VISUAL_GROUPING_FIELDS.material as readonly string[]).some(hasValue);
      }
      if (activeEntityTab === "recipe") {
        return (
          (VISUAL_GROUPING_FIELDS.recipe as readonly string[]).some(hasValue) ||
          (VISUAL_GROUPING_FIELDS.ingredient as readonly string[]).some(hasValue) ||
          Object.keys(row).some((k) => k.startsWith("ingredient_") && hasValue(k))
        );
      }
      if (activeEntityTab === "product") {
        return (VISUAL_GROUPING_FIELDS.product as readonly string[]).some(hasValue);
      }
      return true;
    });
  }, [allTransformedData, activeEntityTab]);

  // Pagination Logic
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

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
        maxWidth="4xl"
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
        <div className="border-border mb-8 flex w-full items-center justify-between px-2">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = currentStepIndex === s.id;
            const isCompleted = currentStepIndex > s.id;

            return (
              <div key={s.id} className="relative flex flex-1 flex-col items-center">
                {/* Connecting Line */}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "absolute top-4 left-[50%] -z-10 h-[2px] w-full -translate-y-1/2",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}

                {/* Icon Circle */}
                <div
                  className={cn(
                    "bg-background z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-[10px] font-medium tracking-wider uppercase",
                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* VIEW 1: UPLOAD */}
        {step === "UPLOAD" && (
          <div className="animate-in fade-in zoom-in-95 flex h-[300px] w-full flex-col items-center justify-center overflow-hidden duration-300">
            {!file ? (
              // --- STATE 1: NO FILE (COMPACT DROPZONE) ---
              <div
                className="border-muted-foreground/25 bg-muted/5 hover:bg-muted/20 group hover:border-primary/50 flex w-[400px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-all hover:scale-[1.01]"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-primary/10 group-hover:bg-primary/20 mb-3 rounded-full p-3 transition-colors">
                  <UploadCloud className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">Upload CSV</h3>
                <p className="text-muted-foreground mt-1 px-4 text-xs">
                  Drag & drop or click to browse
                </p>
              </div>
            ) : (
              // --- STATE 2: FILE SELECTED (ULTRA COMPACT CARD) ---
              <div className="animate-in slide-in-from-bottom-2 fade-in w-full max-w-[400px] duration-300">
                <Card className="border border-green-200 bg-green-50/50 shadow-sm dark:border-green-900 dark:bg-green-950/10">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
                      <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">{file.name}</p>
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />
                        Ready to analyze
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={resetWizard}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0 rounded-full transition-colors"
                      disabled={isReadingFile}
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
                <div className="mt-2 text-center">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted-foreground hover:text-primary h-auto p-0 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace file
                  </Button>
                </div>
              </div>
            )}

            {/* Hidden Input outside conditional to preserve ref */}
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* VIEW 2: ANALYZING */}
        {step === "ANALYZING" && (
          <div className="flex h-[300px] w-full flex-col items-center justify-center text-center">
            <div className="relative mb-4 h-16 w-16">
              <Loader2 className="text-primary/30 absolute inset-0 h-full w-full animate-spin" />
              <Wand2 className="text-primary absolute inset-0 m-auto h-8 w-8 animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold">AI Analysis in Progress</h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-xs">
              Consulting store memory, identifying matches, and analyzing schema...
            </p>
          </div>
        )}

        {/* MAPPING STEP */}
        {step === "MAPPING" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border bg-blue-50/50 p-4 text-sm text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
              <div className="flex items-center gap-3">
                <Wand2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span>
                  <b>AI Agent</b> has mapped your data using your store's context. Please review the results:
                </span>
              </div>
            </div>

            <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-foreground w-[30%] pl-6 font-semibold">
                      CSV Column
                    </TableHead>
                    <TableHead className="text-foreground w-[15%] text-center font-semibold">
                      Confidence
                    </TableHead>
                    <TableHead className="text-foreground w-[55%] font-semibold">
                      Map To Field
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((map, idx) => {
                    // Update field options filtering out already selected ones (optional logic, kept simple for now)
                    return (
                      <TableRow key={idx} className="hover:bg-muted/10 transition-colors">
                        {/* CSV Column + Reasoning Tooltip */}
                        <TableCell className="py-4 pl-6 align-top">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-sm font-medium">
                              {map.csvHeader || (
                                <span className="text-muted-foreground italic">
                                  Column {map.csvIndex + 1}
                                </span>
                              )}
                            </span>
                            {map.reasoning && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="text-muted-foreground/30 hover:text-primary h-4 w-4 cursor-help transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent
                                  className="max-w-[300px] text-xs shadow-xl"
                                  side="right"
                                >
                                  <p>{map.reasoning}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {/* Sample data preview if needed in future */}
                        </TableCell>

                        {/* Confidence Badge */}
                        <TableCell className="py-4 text-center align-top">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-none",
                              map.confidence === "HIGH"
                                ? "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : map.confidence === "MEDIUM"
                                  ? "border-yellow-200 bg-yellow-100 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : "border-gray-200 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            )}
                          >
                            {map.confidence}
                          </Badge>
                        </TableCell>

                        {/* Map Field Select */}
                        <TableCell className="py-4 pr-6 align-top">
                          <div className="flex flex-col gap-2">
                            <Select
                              value={map.targetField}
                              onValueChange={(val) => updateMapping(idx, val)}
                            >
                              <SelectTrigger className="bg-background border-input/60 focus:ring-primary/20 h-10 w-full shadow-sm transition-all focus:ring-2">
                                <SelectValue placeholder="Select field..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem
                                  value="SKIP"
                                  className="text-muted-foreground font-medium italic"
                                >
                                  Don't Import (Skip)
                                </SelectItem>
                                <div className="my-1 border-t" />
                                <div className="my-1 border-t" />
                                {groupedTargetOptions.map((group) => (
                                  <SelectGroup key={group.label}>
                                    <SelectLabel className="text-muted-foreground/70 pl-2 text-[10px] font-bold tracking-wider uppercase">
                                      {group.label}
                                    </SelectLabel>
                                    {group.options.map((opt) => (
                                      <SelectItem key={opt} value={opt} className="cursor-pointer">
                                        {FIELD_LABELS[opt] || opt}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Transform info */}
                            {map.transform !== "NONE" && (
                              <div className="flex items-center gap-1.5 px-1">
                                <Wand2 className="text-muted-foreground h-3 w-3" />
                                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase">
                                  Auto-format:{" "}
                                  <span className="text-foreground">
                                    {map.transform.replace("_", " ")}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <p className="text-muted-foreground text-xs italic">
                * Mappings with High confidence are automatically selected by AI.
              </p>
            </div>
          </div>
        )}

        {/* VIEW 4: REVIEW & EDIT */}
        {step === "PREVIEW" && (
          <div className="animate-in fade-in space-y-4">
            {/* SMART TABS NAVIGATION */}
            <Tabs value={activeEntityTab} onValueChange={setActiveEntityTab} className="w-full">
              <TabsList className="bg-muted/50 grid w-full grid-cols-4 p-1">
                <TabsTrigger
                  value="supplier"
                  disabled={!availableTabs.includes("supplier")}
                  className={cn(
                    "data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-900 dark:data-[state=active]:bg-cyan-950/50 dark:data-[state=active]:text-cyan-400",
                    !availableTabs.includes("supplier") && "opacity-50"
                  )}
                >
                  Suppliers
                </TabsTrigger>
                <TabsTrigger
                  value="material"
                  disabled={!availableTabs.includes("material")}
                  className={cn(
                    "data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-950/50 dark:data-[state=active]:text-blue-400",
                    !availableTabs.includes("material") && "opacity-50"
                  )}
                >
                  Materials
                </TabsTrigger>
                <TabsTrigger
                  value="recipe"
                  disabled={!availableTabs.includes("recipe")}
                  className={cn(
                    "data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900 dark:data-[state=active]:bg-orange-950/50 dark:data-[state=active]:text-orange-400",
                    !availableTabs.includes("recipe") && "opacity-50"
                  )}
                >
                  Recipes
                </TabsTrigger>
                <TabsTrigger
                  value="product"
                  disabled={!availableTabs.includes("product")}
                  className={cn(
                    "data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-950/50 dark:data-[state=active]:text-green-400",
                    !availableTabs.includes("product") && "opacity-50"
                  )}
                >
                  Products
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  Page {currentPage} of {totalPages}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {filteredData.length} visible rows ({allTransformedData.length} total)
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

            {/* TABLE WITH EDITING - CONTEXT AWARE UI */}
            <div className="bg-card w-full overflow-hidden rounded-lg border shadow-sm">
              <ScrollAreaPrimitive.Root
                className="relative h-[300px] w-full overflow-hidden"
                type="always"
              >
                <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-slate-950/95">
                      <TableRow className="hover:bg-muted/50 border-b text-xs tracking-wider uppercase shadow-sm">
                        <TableHead className="text-muted-foreground bg-background/95 w-10 text-center font-medium backdrop-blur">
                          #
                        </TableHead>
                        {previewColumns.map((col) => {
                          let widthClass = "min-w-[150px]";
                          let bgClass = "bg-background/95";
                          let textColor = "text-muted-foreground";
                          let borderColor = "border-transparent";

                          // --- SMART ALL-IN-ONE: Field-based visual grouping (not type-based) ---
                          // Uses centralized field definitions from import-schema.ts (DRY principle)
                          // Removed color coding per user request - keeping clean UI

                          // Width Overrides

                          // Width Overrides
                          if (["sku", "unit", "yieldUnit", "ingredient_unit"].includes(col))
                            widthClass = "w-[80px] min-w-[80px]";
                          if (
                            [
                              "currentStock",
                              "minStock",
                              "maxStock",
                              "ingredient_qty",
                              "yieldQuantity",
                            ].includes(col)
                          )
                            widthClass = "w-[100px] min-w-[100px]";
                          if (
                            [
                              "sellingPrice",
                              "costPrice",
                              "unitCost",
                              "supplierPrice",
                              "ingredient_price",
                              "costPerBatch",
                            ].includes(col)
                          )
                            widthClass = "w-[130px] min-w-[120px]";
                          if (["name", "ingredient_name", "supplierName"].includes(col))
                            widthClass = "min-w-[200px]";

                          return (
                            <TableHead
                              key={col}
                              className={cn(
                                widthClass,
                                bgClass,
                                textColor,
                                "h-10 border-b-2 text-xs font-bold tracking-wider uppercase backdrop-blur",
                                borderColor
                              )}
                            >
                              {FIELD_LABELS[col] || col}
                            </TableHead>
                          );
                        })}
                        <TableHead className="bg-background/95 w-10 backdrop-blur">
                          <Trash2 className="text-muted-foreground/50 mx-auto h-4 w-4" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((row, idx) => {
                        const actualIndex = (currentPage - 1) * rowsPerPage + idx;
                        const rowErrors = validationErrors.filter(
                          (e) => e.rowIndex === actualIndex + 1
                        );
                        const hasError = rowErrors.length > 0;

                        // Smart Merging Logic (Active ONLY for Recipes for now)
                        const prevRow = idx > 0 ? paginatedData[idx - 1] : null;
                        const isRecipe = type === "recipe";
                        const isSameGroup =
                          isRecipe && prevRow && prevRow.name === row.name && row.name;

                        return (
                          <TableRow
                            key={actualIndex}
                            className={cn(
                              "group border-border/60 border-y transition-colors",
                              hasError
                                ? "bg-red-50/50 hover:bg-red-50 dark:bg-red-950/10"
                                : "hover:bg-muted/10",
                              // Separator line between different items in merged view
                              isRecipe && !isSameGroup && idx > 0 && "border-t-2"
                            )}
                          >
                            <TableCell className="text-muted-foreground/30 py-2 text-center font-mono text-[10px] select-none">
                              {actualIndex + 1}
                            </TableCell>
                            {previewColumns.map((col) => {
                              const error = rowErrors.find((e) => e.field === col);

                              // Determine Cell Background - SMART ALL-IN-ONE (field-based, not type-based)
                              // Uses centralized field definitions from import-schema.ts (DRY principle)
                              const cellBg = ""; // Neutral UI per user request

                              // Visual Dimming Logic
                              const isDimmed =
                                type === "recipe" &&
                                [
                                  "name",
                                  "category",
                                  "description",
                                  "yieldQuantity",
                                  "yieldUnit",
                                ].includes(col) &&
                                isSameGroup;

                              return (
                                <TableCell key={col} className={cn("relative p-0", cellBg)}>
                                  <div className="relative h-full w-full">
                                    <Input
                                      className={cn(
                                        "focus-visible:bg-background/80 h-10 w-full rounded-none border-0 bg-transparent px-4 py-2 text-sm shadow-none transition-all focus-visible:ring-0",
                                        "placeholder:text-muted-foreground/30",
                                        error && "text-destructive bg-destructive/5 font-medium",
                                        !error && "focus-visible:text-foreground",
                                        isDimmed &&
                                          !error &&
                                          "focus:text-foreground group-hover:text-muted-foreground/50 selection:text-foreground text-transparent"
                                      )}
                                      placeholder={!isDimmed ? "-" : ""}
                                      value={row[col] === undefined ? "" : String(row[col])}
                                      onChange={(e) =>
                                        handleCellChange(actualIndex, col, e.target.value)
                                      }
                                    />

                                    {error && (
                                      <div className="absolute top-1/2 right-2 -translate-y-1/2">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertCircle className="text-destructive h-4 w-4 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="bg-destructive text-destructive-foreground border-destructive">
                                            <p className="text-xs">{error.message}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="py-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 h-7 w-7 opacity-0 transition-all group-hover:opacity-100"
                                onClick={() => deleteRow(actualIndex)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollAreaPrimitive.Viewport>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
                <ScrollAreaPrimitive.Corner />
              </ScrollAreaPrimitive.Root>
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

            {/* Multi-Entity Import Breakdown */}
            {multiEntitySummary && (
              <div className="mt-6 w-full max-w-md">
                <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                  Import Breakdown by Entity
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {multiEntitySummary.suppliers.succeeded > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-800/30 dark:bg-cyan-950/20">
                      <span className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
                        Suppliers
                      </span>
                      <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400">
                        {multiEntitySummary.suppliers.succeeded}
                      </Badge>
                    </div>
                  )}
                  {multiEntitySummary.materials.succeeded > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800/30 dark:bg-blue-950/20">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        Materials
                      </span>
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                        {multiEntitySummary.materials.succeeded}
                      </Badge>
                    </div>
                  )}
                  {multiEntitySummary.recipes.succeeded > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-800/30 dark:bg-orange-950/20">
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                        Recipes
                      </span>
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
                        {multiEntitySummary.recipes.succeeded}
                      </Badge>
                    </div>
                  )}
                  {multiEntitySummary.products.succeeded > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-800/30 dark:bg-green-950/20">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        Products
                      </span>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                        {multiEntitySummary.products.succeeded}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Skipped Rows Breakdown (only show if there were skips) */}
            {importStats.skippedValidation > 0 && (
              <div className="bg-muted/30 mt-4 w-full max-w-md rounded-lg border p-3 text-xs">
                <div className="text-muted-foreground flex justify-center gap-6">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    <span>{importStats.skippedValidation} rows skipped (validation errors)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </FormDialogLayout>
    </Dialog>
  );
}
