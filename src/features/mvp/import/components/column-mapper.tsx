/**
 * Column Mapper Component
 *
 * Premium UI for mapping file columns to product fields
 */

"use client";

import { useMemo } from "react";
import { ArrowRight, Check, AlertCircle, Columns3, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImportStore } from "../import-store";
import { REQUIRED_FIELDS, OPTIONAL_FIELDS, FIELD_LABELS, type ColumnMapping } from "../types";
import type { ImportPreviewProduct, ImportValidationError } from "../types";

export function ColumnMapper() {
  const { parsedData, mappings, setMapping, setStep, setPreviewData, fileName } = useImportStore();

  const headers = parsedData?.headers || [];

  // Check which required fields are mapped
  const mappedRequiredFields = useMemo(() => {
    return REQUIRED_FIELDS.filter((field) => mappings[field]);
  }, [mappings]);

  const allRequiredMapped = mappedRequiredFields.length === REQUIRED_FIELDS.length;
  const progressPercent = (mappedRequiredFields.length / REQUIRED_FIELDS.length) * 100;

  // Generate preview when proceeding
  const handleProceed = () => {
    if (!parsedData || !allRequiredMapped) return;

    const products: ImportPreviewProduct[] = [];
    const errors: ImportValidationError[] = [];

    parsedData.rows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header row

      const sku = mappings.sku ? String(row[mappings.sku] || "").trim() : "";
      const name = mappings.name ? String(row[mappings.name] || "").trim() : "";
      const costPriceRaw = mappings.costPrice ? row[mappings.costPrice] : 0;
      const sellingPriceRaw = mappings.sellingPrice ? row[mappings.sellingPrice] : 0;
      const stockRaw = mappings.currentStock ? row[mappings.currentStock] : 0;

      const costPrice =
        typeof costPriceRaw === "number" ? costPriceRaw : parseFloat(String(costPriceRaw)) || 0;
      const sellingPrice =
        typeof sellingPriceRaw === "number"
          ? sellingPriceRaw
          : parseFloat(String(sellingPriceRaw)) || 0;
      const currentStock =
        typeof stockRaw === "number" ? stockRaw : parseInt(String(stockRaw)) || 0;

      const category = mappings.category
        ? String(row[mappings.category] || "").trim() || undefined
        : undefined;
      const unit = mappings.unit ? String(row[mappings.unit] || "").trim() || "Pcs" : "Pcs";

      // Validate
      const rowErrors: string[] = [];
      if (!sku) rowErrors.push("Missing SKU");
      if (!name) rowErrors.push("Missing Name");
      if (costPrice < 0) rowErrors.push("Invalid Cost Price");
      if (sellingPrice < 0) rowErrors.push("Invalid Selling Price");
      if (currentStock < 0) rowErrors.push("Invalid Stock");

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, field: "multiple", message: rowErrors.join(", ") });
      } else {
        products.push({
          sku,
          name,
          costPrice,
          sellingPrice,
          currentStock,
          category,
          unit,
        });
      }
    });

    setPreviewData(products, errors);
  };

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="bg-card rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Mapping columns from</p>
            <p className="font-semibold">{fileName}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">
              {mappedRequiredFields.length}/{REQUIRED_FIELDS.length}
            </p>
            <p className="text-muted-foreground text-sm">required mapped</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Mapping Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Required Fields */}
        <div className="space-y-3">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-primary h-2 w-2 rounded-full" />
            <h3 className="font-semibold">Required Fields</h3>
          </div>
          {REQUIRED_FIELDS.map((field) => (
            <MappingRow
              key={field}
              field={field}
              label={FIELD_LABELS[field]}
              headers={headers}
              value={mappings[field]}
              onChange={(value) => setMapping(field, value)}
              required
            />
          ))}
        </div>

        {/* Optional Fields */}
        <div className="space-y-3">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-muted-foreground h-2 w-2 rounded-full" />
            <h3 className="text-muted-foreground font-semibold">Optional Fields</h3>
          </div>
          {OPTIONAL_FIELDS.map((field) => (
            <MappingRow
              key={field}
              field={field}
              label={FIELD_LABELS[field]}
              headers={headers}
              value={mappings[field]}
              onChange={(value) => setMapping(field, value)}
            />
          ))}
        </div>
      </div>

      {/* Preview Info */}
      {parsedData && (
        <div className="bg-muted/50 flex items-center gap-3 rounded-xl p-4">
          <Columns3 className="text-muted-foreground h-5 w-5" />
          <p className="text-sm">
            <span className="font-semibold">{parsedData.totalRows}</span> rows detected •
            <span className="ml-1 font-semibold">{headers.length}</span> columns available
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" onClick={() => setStep("upload")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          onClick={handleProceed}
          disabled={!allRequiredMapped}
          size="lg"
          className="gap-2 px-8"
        >
          Preview Import
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MappingRow({
  field,
  label,
  headers,
  value,
  onChange,
  required,
}: {
  field: string;
  label: string;
  headers: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
}) {
  const isMapped = !!value;

  return (
    <div
      className={`flex items-center gap-3 rounded-md border p-3 ${
        isMapped
          ? "border-primary/50 bg-accent/50"
          : required
            ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/10"
            : "border-border"
      }`}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
          isMapped
            ? "bg-primary text-primary-foreground"
            : required
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {isMapped ? <Check className="h-3 w-3" /> : required ? "!" : "?"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
      </div>

      <Select value={value || ""} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Not mapped</SelectItem>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
