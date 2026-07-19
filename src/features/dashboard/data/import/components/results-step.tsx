/**
 * Results Step Component
 *
 * Shows import results with success/error breakdown.
 */

"use client";

import { Check, X, Package, ShoppingCart, Truck, ChefHat, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ResultsStepProps {
  result: {
    success: boolean;
    summary?: {
      suppliers: { attempted: number; succeeded: number };
      materials: { attempted: number; succeeded: number };
      recipes: { attempted: number; succeeded: number };
      products: { attempted: number; succeeded: number };
      totalSucceeded: number;
    };
    error?: string;
  };
  onClose: () => void;
}

export function ResultsStep({ result, onClose }: ResultsStepProps) {
  const { success, summary, error } = result;

  // Entity display config
  const entities = [
    {
      key: "suppliers",
      label: "Suppliers",
      icon: Truck,
      data: summary?.suppliers,
    },
    {
      key: "materials",
      label: "Materials",
      icon: Package,
      data: summary?.materials,
    },
    {
      key: "recipes",
      label: "Recipes",
      icon: ChefHat,
      data: summary?.recipes,
    },
    {
      key: "products",
      label: "Products",
      icon: ShoppingCart,
      data: summary?.products,
    },
  ];

  return (
    <div className="flex flex-col items-center py-8">
      {success ? (
        <>
          {/* Success animation */}
          <div className="relative mb-6">
            <div className="absolute inset-0 animate-ping rounded-full bg-green-500/20" />
            <div className="relative rounded-full bg-green-500 p-6 text-white">
              <Check className="h-12 w-12" />
            </div>
          </div>

          <h3 className="mb-2 text-2xl font-bold text-green-600 dark:text-green-400">
            Import Successful!
          </h3>
          <p className="text-muted-foreground mb-8">
            {summary?.totalSucceeded || 0} items imported successfully
          </p>

          {/* Entity breakdown */}
          <div className="w-full max-w-md space-y-4">
            {entities.map((entity) => {
              if (!entity.data || entity.data.attempted === 0) return null;

              const Icon = entity.icon;
              const allSucceeded = entity.data.succeeded === entity.data.attempted;

              return (
                <div
                  key={entity.key}
                  className={cn(
                    "flex items-center justify-between rounded-lg p-4",
                    allSucceeded ? "bg-green-500/10" : "bg-yellow-500/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="text-muted-foreground h-5 w-5" />
                    <span className="font-medium">{entity.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-bold",
                        allSucceeded
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      )}
                    >
                      {entity.data.succeeded}
                    </span>
                    <span className="text-muted-foreground">/ {entity.data.attempted}</span>
                    {allSucceeded ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="mt-8 flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onClose}>View Imported Data</Button>
          </div>
        </>
      ) : (
        <>
          {/* Error display */}
          <div className="relative mb-6">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
            <div className="relative rounded-full bg-red-500 p-6 text-white">
              <X className="h-12 w-12" />
            </div>
          </div>

          <h3 className="mb-2 text-2xl font-bold text-red-600 dark:text-red-400">Import Failed</h3>
          <p className="text-muted-foreground mb-4">Something went wrong during import.</p>

          {error && (
            <div className="mb-8 w-full max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </>
      )}
    </div>
  );
}
