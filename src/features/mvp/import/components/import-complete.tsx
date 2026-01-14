/**
 * Import Complete Component
 *
 * Premium success screen after import
 */

"use client";

import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Package, AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportStore } from "../import-store";

export function ImportComplete() {
  const params = useParams();
  const router = useRouter();
  const storeId = params?.storeId as string;

  const { importedCount, skippedCount, reset } = useImportStore();

  const handleImportMore = () => {
    reset();
  };

  const handleGoToPOS = () => {
    router.push(`/store/${storeId}/pos`);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Success Icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-green-500/20" />
        <div className="relative rounded-full bg-gradient-to-br from-green-500 to-green-600 p-6 shadow-lg shadow-green-500/30">
          <CheckCircle2 className="h-12 w-12 text-white" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-3xl font-bold mb-2">Import Complete!</h2>
      <p className="text-muted-foreground text-lg mb-8">
        Your products have been successfully imported
      </p>

      {/* Stats Cards */}
      <div className="flex gap-6 mb-10">
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 px-8 py-6">
          <div className="rounded-full bg-green-500/20 p-3">
            <Package className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-4xl font-bold text-green-600">{importedCount}</p>
            <p className="text-sm text-muted-foreground">Products imported</p>
          </div>
        </div>

        {skippedCount > 0 && (
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 px-8 py-6">
            <div className="rounded-full bg-amber-500/20 p-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-600">{skippedCount}</p>
              <p className="text-sm text-muted-foreground">Rows skipped</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={handleImportMore}
          className="gap-2 px-6"
        >
          <RotateCw className="h-4 w-4" />
          Import More
        </Button>

        <Button
          size="lg"
          onClick={handleGoToPOS}
          className="gap-2 px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          Continue to POS
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Hint */}
      <p className="mt-8 text-sm text-muted-foreground">
        Next step: Execute at least 3 transactions in the POS module
      </p>
    </div>
  );
}
