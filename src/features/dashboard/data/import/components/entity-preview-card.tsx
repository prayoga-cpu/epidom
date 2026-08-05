/**
 * Entity Preview Card
 *
 * Displays a single entity (Material/Product/Recipe/Supplier) with
 * entity-specific fields and edit/remove actions.
 */

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/ai/import/types";
import { useI18n } from "@/components/lang/i18n-provider";

interface EntityPreviewCardProps {
  entityType: EntityType;
  data: Record<string, unknown>;
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: (data: Record<string, unknown>) => void;
  onRemove: () => void;
}

// Field definitions for each entity type
const ENTITY_FIELDS: Record<
  EntityType,
  { key: string; labelKey: string; type: "text" | "number" | "textarea" }[]
> = {
  material: [
    { key: "name", labelKey: "common.name", type: "text" },
    { key: "sku", labelKey: "common.sku", type: "text" },
    { key: "category", labelKey: "common.category", type: "text" },
    { key: "unit", labelKey: "pages.smartImportUnit", type: "text" },
    { key: "unitCost", labelKey: "pages.smartImportUnitCost", type: "number" },
    { key: "currentStock", labelKey: "pages.smartImportCurrentStock", type: "number" },
    { key: "minStock", labelKey: "pages.smartImportMinStock", type: "number" },
    { key: "maxStock", labelKey: "pages.smartImportMaxStock", type: "number" },
    { key: "supplierName", labelKey: "pages.smartImportSupplier", type: "text" },
    { key: "notes", labelKey: "common.notes", type: "textarea" },
  ],
  product: [
    { key: "name", labelKey: "common.name", type: "text" },
    { key: "sku", labelKey: "common.sku", type: "text" },
    { key: "category", labelKey: "common.category", type: "text" },
    { key: "unit", labelKey: "pages.smartImportUnit", type: "text" },
    { key: "costPrice", labelKey: "pages.smartImportCostPrice", type: "number" },
    { key: "sellingPrice", labelKey: "pages.smartImportRetailPrice", type: "number" },
    { key: "currentStock", labelKey: "pages.smartImportCurrentStock", type: "number" },
    { key: "minStock", labelKey: "pages.smartImportMinStock", type: "number" },
    { key: "maxStock", labelKey: "pages.smartImportMaxStock", type: "number" },
    { key: "notes", labelKey: "common.notes", type: "textarea" },
  ],
  recipe: [
    { key: "name", labelKey: "pages.smartImportRecipeName", type: "text" },
    { key: "description", labelKey: "pages.smartImportDescription", type: "textarea" },
    { key: "yieldQuantity", labelKey: "pages.smartImportYieldQuantity", type: "number" },
    { key: "yieldUnit", labelKey: "pages.smartImportYieldUnit", type: "text" },
    { key: "productionTimeMinutes", labelKey: "pages.smartImportProductionTime", type: "number" },
    { key: "costPerBatch", labelKey: "pages.entityPreviewCostPerBatch", type: "number" },
    { key: "instructions", labelKey: "pages.smartImportInstructions", type: "textarea" },
  ],
  supplier: [
    { key: "name", labelKey: "pages.smartImportSupplierName", type: "text" },
    { key: "contactPerson", labelKey: "pages.smartImportContactPerson", type: "text" },
    { key: "phone", labelKey: "common.phone", type: "text" },
    { key: "email", labelKey: "common.email", type: "text" },
    { key: "address", labelKey: "common.address", type: "textarea" },
    { key: "city", labelKey: "pages.smartImportCity", type: "text" },
    { key: "country", labelKey: "pages.smartImportCountry", type: "text" },
    { key: "notes", labelKey: "common.notes", type: "textarea" },
  ],
};

// Display labels for entity types
const ENTITY_LABEL_KEYS: Record<EntityType, string> = {
  material: "common.material",
  product: "common.product",
  recipe: "common.recipe",
  supplier: "pages.entityPreviewSupplierLabel",
};

export function EntityPreviewCard({
  entityType,
  data,
  index,
  selected,
  onToggleSelect,
  onEdit,
  onRemove,
}: EntityPreviewCardProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>(data);

  const fields = ENTITY_FIELDS[entityType];
  const primaryFields = fields.slice(0, 4); // First 4 fields shown always
  const secondaryFields = fields.slice(4); // Rest shown when expanded

  const handleSave = () => {
    onEdit(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(data);
    setIsEditing(false);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") {
      return value.toLocaleString("id-ID");
    }
    return String(value);
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        selected ? "ring-primary ring-2" : "hover:shadow-md",
        !selected && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="truncate font-semibold">{formatValue(data.name)}</h4>
              <Badge variant="outline" className="shrink-0 text-xs">
                #{index + 1}
              </Badge>
            </div>
            {data.sku !== undefined && data.sku !== null && data.sku !== "" && (
              <p className="text-muted-foreground text-xs">SKU: {String(data.sku)}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {isEditing ? (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive h-8 w-8"
                  onClick={onRemove}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Primary Fields */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {primaryFields.map((field) => (
            <div key={field.key} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">{t(field.labelKey)}:</span>
              {isEditing ? (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={String(editData[field.key] || "")}
                  onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                  className="w-24 rounded border px-1 text-right text-xs"
                />
              ) : (
                <span className="truncate font-medium">{formatValue(data[field.key])}</span>
              )}
            </div>
          ))}
        </div>

        {/* Expand/Collapse for secondary fields */}
        {secondaryFields.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 w-full text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" />
                  {t("pages.entityPreviewHideDetails")}
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  {t("pages.entityPreviewViewDetails").replace(
                    "{count}",
                    String(secondaryFields.length)
                  )}
                </>
              )}
            </Button>

            {isExpanded && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-sm">
                {secondaryFields.map((field) => (
                  <div
                    key={field.key}
                    className={cn(
                      "flex justify-between gap-2",
                      field.type === "textarea" && "col-span-2"
                    )}
                  >
                    <span className="text-muted-foreground truncate">{t(field.labelKey)}:</span>
                    {isEditing ? (
                      field.type === "textarea" ? (
                        <textarea
                          value={String(editData[field.key] || "")}
                          onChange={(e) =>
                            setEditData({ ...editData, [field.key]: e.target.value })
                          }
                          className="min-h-[60px] flex-1 rounded border px-1 text-xs"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={String(editData[field.key] || "")}
                          onChange={(e) =>
                            setEditData({ ...editData, [field.key]: e.target.value })
                          }
                          className="w-24 rounded border px-1 text-right text-xs"
                        />
                      )
                    ) : (
                      <span className="truncate font-medium">{formatValue(data[field.key])}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { ENTITY_FIELDS, ENTITY_LABEL_KEYS };
