"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle, Package } from "lucide-react";

interface IngredientAvailability {
  materialId: string;
  materialName: string;
  required: number;
  available: number;
  unit: string;
  status: "sufficient" | "low" | "insufficient";
}

interface MaterialAvailabilityCheckProps {
  ingredients: (IngredientAvailability | null)[];
  recipeName: string;
}

export function MaterialAvailabilityCheck({
  ingredients,
  recipeName,
}: MaterialAvailabilityCheckProps) {
  const { t } = useI18n();

  // Filter out null values
  const validIngredients = ingredients.filter((ing): ing is IngredientAvailability => ing !== null);

  // Get status configuration
  const getStatusConfig = (status: string) => {
    const configs = {
      sufficient: {
        label: t("management.recipeProduction.availability.sufficient"),
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        icon: CheckCircle,
        iconColor: "text-green-600 dark:text-green-400",
      },
      low: {
        label: t("management.recipeProduction.availability.low"),
        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        icon: AlertCircle,
        iconColor: "text-yellow-600 dark:text-yellow-400",
      },
      insufficient: {
        label: t("management.recipeProduction.availability.insufficient"),
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        icon: XCircle,
        iconColor: "text-red-600 dark:text-red-400",
      },
    };
    return configs[status as keyof typeof configs] || configs.sufficient;
  };

  // Count statuses
  const statusCounts = validIngredients.reduce(
    (acc, ing) => {
      acc[ing.status] = (acc[ing.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const allSufficient = statusCounts.insufficient === undefined && statusCounts.low === undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {t("management.recipeProduction.materialAvailability")}
            </CardTitle>
            <CardDescription>
              {t("management.recipeProduction.materialAvailabilityDescription")}
            </CardDescription>
          </div>
          {allSufficient ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <CheckCircle className="mr-1 h-3 w-3" />
              {t("management.recipeProduction.allMaterialsAvailable")}
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
              <AlertCircle className="mr-1 h-3 w-3" />
              {t("management.recipeProduction.materialShortage")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {validIngredients.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>{t("management.recipeProduction.noIngredientsFound")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {/* Table Header */}
            <div className="bg-muted grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium">
              <div className="col-span-4">{t("management.recipeProduction.material")}</div>
              <div className="col-span-3 text-right">
                {t("management.recipeProduction.required")}
              </div>
              <div className="col-span-3 text-right">
                {t("management.recipeProduction.available")}
              </div>
              <div className="col-span-2 text-center">
                {t("management.recipeProduction.status")}
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {validIngredients.map((ingredient) => {
                const statusConfig = getStatusConfig(ingredient.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={ingredient.materialId}
                    className="hover:bg-muted/50 grid grid-cols-12 gap-4 px-4 py-3 text-sm transition-colors"
                  >
                    <div className="col-span-4 flex items-center gap-2 font-medium">
                      <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
                      {ingredient.materialName}
                    </div>
                    <div className="text-muted-foreground col-span-3 text-right">
                      {ingredient.required.toFixed(2)} {ingredient.unit}
                    </div>
                    <div className="col-span-3 text-right font-medium">
                      {ingredient.available.toFixed(2)} {ingredient.unit}
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        {validIngredients.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {statusCounts.sufficient > 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  {statusCounts.sufficient}{" "}
                  {t("management.recipeProduction.availability.sufficient")}
                </span>
              </div>
            )}
            {statusCounts.low > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span>
                  {statusCounts.low} {t("management.recipeProduction.availability.low")}
                </span>
              </div>
            )}
            {statusCounts.insufficient > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span>
                  {statusCounts.insufficient}{" "}
                  {t("management.recipeProduction.availability.insufficient")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Warning for insufficient materials */}
        {statusCounts.insufficient > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {t("management.recipeProduction.insufficientMaterialsWarning")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
