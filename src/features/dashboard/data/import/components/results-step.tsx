/**
 * Results Step Component
 *
 * Shows import results with success/error breakdown.
 */

"use client";

import { Check, X, Package, ShoppingCart, Truck, ChefHat, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import type { ImportFailure } from "../hooks/use-ai-import";

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
    failures?: ImportFailure[];
    skippedRows?: number;
  };
  onClose: () => void;
}

const FAILURE_ENTITY_LABEL: Record<ImportFailure["entity"], string> = {
  supplier: "pages.smartImportTabSuppliers",
  material: "pages.smartImportTabMaterials",
  recipe: "pages.smartImportTabRecipes",
  product: "pages.smartImportTabProducts",
};

export function ResultsStep({ result, onClose }: ResultsStepProps) {
  const { t } = useI18n();
  const { success, summary, error, failures, skippedRows } = result;

  // The reasons rows were skipped. Without this a partial (or empty) import
  // only ever said "0 / 91", leaving the merchant to guess what to fix.
  const hasFailures = !!failures && failures.length > 0;
  const hasSkipped = !!skippedRows && skippedRows > 0;
  const failureList =
    hasFailures || hasSkipped ? (
      <div className="mt-6 w-full max-w-md rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-left">
        {hasFailures && (
          <p className="mb-2 text-sm font-medium">{t("pages.smartImportFailuresTitle")}</p>
        )}
        <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm">
          {hasSkipped && (
            <li className="text-muted-foreground">
              {t("pages.smartImportSkippedRows").replace("{count}", String(skippedRows))}
            </li>
          )}
          {(failures ?? []).map((failure, index) => (
            <li key={index} className="break-words">
              <span className="font-medium">
                {failure.row === null
                  ? t(FAILURE_ENTITY_LABEL[failure.entity])
                  : t("pages.smartImportFailureRow")
                      .replace("{entity}", t(FAILURE_ENTITY_LABEL[failure.entity]))
                      .replace("{row}", String(failure.row))}
                :
              </span>{" "}
              <span className="text-muted-foreground">{failure.message}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  // Entity display config
  const entities = [
    {
      key: "suppliers",
      labelKey: "pages.smartImportTabSuppliers",
      icon: Truck,
      data: summary?.suppliers,
    },
    {
      key: "materials",
      labelKey: "pages.smartImportTabMaterials",
      icon: Package,
      data: summary?.materials,
    },
    {
      key: "recipes",
      labelKey: "pages.smartImportTabRecipes",
      icon: ChefHat,
      data: summary?.recipes,
    },
    {
      key: "products",
      labelKey: "pages.smartImportTabProducts",
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
            {t("pages.smartImportSuccessTitle")}
          </h3>
          <p className="text-muted-foreground mb-8">
            {t("pages.smartImportSuccessCount").replace(
              "{count}",
              String(summary?.totalSucceeded || 0)
            )}
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
                    <span className="font-medium">{t(entity.labelKey)}</span>
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

          {failureList}

          {/* Quick actions */}
          <div className="mt-8 flex gap-4">
            <Button variant="outline" onClick={onClose}>
              {t("common.actions.close")}
            </Button>
            <Button onClick={onClose}>{t("pages.smartImportViewData")}</Button>
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

          <h3 className="mb-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {t("pages.smartImportFailedTitle")}
          </h3>
          <p className="text-muted-foreground mb-4">{t("pages.smartImportFailedDesc")}</p>

          {/* The row list already carries the reason; the lone message is for
              failures that never got as far as a row (auth, a network error). */}
          {failureList ? (
            <div className="mb-8 flex w-full justify-center">{failureList}</div>
          ) : (
            error && (
              <div className="mb-8 w-full max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-sm break-words text-red-600 dark:text-red-400">{error}</p>
              </div>
            )
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              {t("common.actions.close")}
            </Button>
            <Button onClick={() => window.location.reload()}>
              {t("pages.smartImportTryAgain")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
