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
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportStore } from "../import-store";
import { importProducts } from "../actions";

export function ImportPreview() {
  const params = useParams();
  const storeId = params?.storeId as string;

  const { previewProducts, validationErrors, setStep, setImportResult, step } = useImportStore();

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
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{previewProducts.length}</p>
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Ready to import
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{validationErrors.length}</p>
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Rows skipped
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Package className="text-primary h-8 w-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">
                {previewProducts.length + validationErrors.length}
              </p>
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Total rows
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Preview Table */}
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted border-b px-4 py-3">
          <h3 className="font-semibold">Products Preview</h3>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
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
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {product.sellingPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{product.currentStock}</td>
                  <td className="px-4 py-3">
                    {product.category && (
                      <span className="bg-muted inline-flex rounded-full px-2 py-0.5 text-xs">
                        {product.category}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {previewProducts.length > 50 && (
            <div className="text-muted-foreground bg-muted/30 px-4 py-3 text-center text-sm">
              ... and {previewProducts.length - 50} more products
            </div>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/10">
          <div className="border-b border-amber-200 px-4 py-3 dark:border-amber-900">
            <h3 className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Skipped Rows ({validationErrors.length})
            </h3>
          </div>
          <div className="max-h-[150px] space-y-1 overflow-auto p-4">
            {validationErrors.slice(0, 10).map((error, index) => (
              <p key={index} className="text-sm text-amber-900 dark:text-amber-200">
                <span className="font-mono font-semibold">Row {error.row}:</span>{" "}
                <span className="opacity-90">{error.message}</span>
              </p>
            ))}
            {validationErrors.length > 10 && (
              <p className="pt-2 text-xs text-amber-700 dark:text-amber-400">
                ... and {validationErrors.length - 10} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
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
          className="min-w-[180px] gap-2 px-8"
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
