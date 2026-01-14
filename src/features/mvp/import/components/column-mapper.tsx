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
  const {
    parsedData,
    mappings,
    setMapping,
    setStep,
    setPreviewData,
    fileName,
  } = useImportStore();

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

      const costPrice = typeof costPriceRaw === "number" ? costPriceRaw : parseFloat(String(costPriceRaw)) || 0;
      const sellingPrice = typeof sellingPriceRaw === "number" ? sellingPriceRaw : parseFloat(String(sellingPriceRaw)) || 0;
      const currentStock = typeof stockRaw === "number" ? stockRaw : parseInt(String(stockRaw)) || 0;

      const category = mappings.category ? String(row[mappings.category] || "").trim() || undefined : undefined;
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
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Mapping columns from</p>
            <p className="font-semibold text-lg">{fileName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              {mappedRequiredFields.length}/{REQUIRED_FIELDS.length}
            </p>
            <p className="text-sm text-muted-foreground">required mapped</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Mapping Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Required Fields */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
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
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            <h3 className="font-semibold text-muted-foreground">Optional Fields</h3>
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
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
          <Columns3 className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm">
            <span className="font-semibold">{parsedData.totalRows}</span> rows detected •
            <span className="font-semibold ml-1">{headers.length}</span> columns available
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="ghost"
          onClick={() => setStep("upload")}
          className="gap-2"
        >
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
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${
      isMapped
        ? "border-primary/30 bg-primary/5"
        : required
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-muted"
    }`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
        isMapped
          ? "bg-primary text-primary-foreground"
          : required
            ? "bg-amber-500/20 text-amber-600"
            : "bg-muted text-muted-foreground"
      }`}>
        {isMapped ? (
          <Check className="h-4 w-4" />
        ) : required ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <span className="text-xs">?</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{label}</p>
      </div>

      <Select
        value={value || ""}
        onValueChange={(v) => onChange(v || null)}
      >
        <SelectTrigger className="w-[180px] bg-background">
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
