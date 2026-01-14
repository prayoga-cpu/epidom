/**
 * Import Preview Component
 *
 * Premium preview of products before import
 */

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Package,
  Loader2,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportStore } from "../import-store";
import { importProducts } from "../actions";

export function ImportPreview() {
  const params = useParams();
  const storeId = params?.storeId as string;

  const {
    previewProducts,
    validationErrors,
    setStep,
    setImportResult,
    step,
  } = useImportStore();

  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (previewProducts.length === 0) return;

    setIsImporting(true);
    setStep("importing");

    try {
      const result = await importProducts({
        storeId,
        products: previewProducts,
      });

      setImportResult(result.imported, result.skipped);
    } catch (error) {
      alert("Import failed");
      setStep("preview");
    } finally {
      setIsImporting(false);
    }
  };

  const isImportingStep = step === "importing" || isImporting;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/20 p-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{previewProducts.length}</p>
              <p className="text-sm text-muted-foreground">Ready to import</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{validationErrors.length}</p>
              <p className="text-sm text-muted-foreground">Rows skipped</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {previewProducts.length + validationErrors.length}
              </p>
              <p className="text-sm text-muted-foreground">Total rows</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Preview Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <h3 className="font-semibold">Products Preview</h3>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium">SKU</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-right px-4 py-3 font-medium">Cost</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-right px-4 py-3 font-medium">Stock</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {previewProducts.slice(0, 50).map((product, index) => (
                <tr key={index} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {product.costPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {product.sellingPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {product.currentStock}
                  </td>
                  <td className="px-4 py-3">
                    {product.category && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                        {product.category}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {previewProducts.length > 50 && (
            <div className="px-4 py-3 text-center text-sm text-muted-foreground bg-muted/30">
              ... and {previewProducts.length - 50} more products
            </div>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 overflow-hidden">
          <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/30">
            <h3 className="font-semibold text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Skipped Rows ({validationErrors.length})
            </h3>
          </div>
          <div className="max-h-[150px] overflow-auto p-4 space-y-2">
            {validationErrors.slice(0, 10).map((error, index) => (
              <p key={index} className="text-sm">
                <span className="font-mono text-amber-600">Row {error.row}:</span>{" "}
                <span className="text-muted-foreground">{error.message}</span>
              </p>
            ))}
            {validationErrors.length > 10 && (
              <p className="text-sm text-muted-foreground">
                ... and {validationErrors.length - 10} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="ghost"
          onClick={() => setStep("mapping")}
          disabled={isImportingStep}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Mapping
        </Button>

        <Button
          onClick={handleImport}
          disabled={previewProducts.length === 0 || isImportingStep}
          size="lg"
          className="gap-2 px-8 min-w-[180px]"
        >
          {isImportingStep ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import {previewProducts.length} Products
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
