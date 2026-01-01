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
const ENTITY_FIELDS: Record<EntityType, { key: string; label: string; type: "text" | "number" | "textarea" }[]> = {
  material: [
    { key: "name", label: "Nama", type: "text" },
    { key: "sku", label: "SKU", type: "text" },
    { key: "category", label: "Kategori", type: "text" },
    { key: "unit", label: "Satuan", type: "text" },
    { key: "unitCost", label: "Harga Beli", type: "number" },
    { key: "currentStock", label: "Stok", type: "number" },
    { key: "minStock", label: "Min Stok", type: "number" },
    { key: "maxStock", label: "Max Stok", type: "number" },
    { key: "supplierName", label: "Supplier", type: "text" },
    { key: "notes", label: "Catatan", type: "textarea" },
  ],
  product: [
    { key: "name", label: "Nama", type: "text" },
    { key: "sku", label: "SKU", type: "text" },
    { key: "category", label: "Kategori", type: "text" },
    { key: "unit", label: "Satuan", type: "text" },
    { key: "costPrice", label: "Harga Modal", type: "number" },
    { key: "sellingPrice", label: "Harga Jual", type: "number" },
    { key: "currentStock", label: "Stok", type: "number" },
    { key: "minStock", label: "Min Stok", type: "number" },
    { key: "maxStock", label: "Max Stok", type: "number" },
    { key: "notes", label: "Catatan", type: "textarea" },
  ],
  recipe: [
    { key: "name", label: "Nama Resep", type: "text" },
    { key: "description", label: "Deskripsi", type: "textarea" },
    { key: "yieldQuantity", label: "Hasil", type: "number" },
    { key: "yieldUnit", label: "Satuan Hasil", type: "text" },
    { key: "productionTimeMinutes", label: "Waktu Produksi (menit)", type: "number" },
    { key: "costPerBatch", label: "Biaya per Batch", type: "number" },
    { key: "instructions", label: "Instruksi", type: "textarea" },
  ],
  supplier: [
    { key: "name", label: "Nama Supplier", type: "text" },
    { key: "contactPerson", label: "Kontak Person", type: "text" },
    { key: "phone", label: "Telepon", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "address", label: "Alamat", type: "textarea" },
    { key: "city", label: "Kota", type: "text" },
    { key: "country", label: "Negara", type: "text" },
    { key: "notes", label: "Catatan", type: "textarea" },
  ],
};

// Display labels for entity types
const ENTITY_LABELS: Record<EntityType, string> = {
  material: "Material",
  product: "Produk",
  recipe: "Resep",
  supplier: "Supplier",
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
    <Card className={cn(
      "transition-all duration-200",
      selected ? "ring-2 ring-primary" : "hover:shadow-md",
      !selected && "opacity-60"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold truncate">
                {formatValue(data.name)}
              </h4>
              <Badge variant="outline" className="text-xs shrink-0">
                #{index + 1}
              </Badge>
            </div>
            {data.sku !== undefined && data.sku !== null && data.sku !== "" && (
              <p className="text-xs text-muted-foreground">SKU: {String(data.sku)}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
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
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onRemove}>
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
              <span className="text-muted-foreground truncate">{field.label}:</span>
              {isEditing ? (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={String(editData[field.key] || "")}
                  onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                  className="w-24 px-1 text-right border rounded text-xs"
                />
              ) : (
                <span className="font-medium truncate">{formatValue(data[field.key])}</span>
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
              className="w-full mt-2 h-6 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Sembunyikan Detail
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Lihat Detail ({secondaryFields.length} field lagi)
                </>
              )}
            </Button>

            {isExpanded && (
              <div className="grid grid-cols-2 gap-2 text-sm mt-2 pt-2 border-t">
                {secondaryFields.map((field) => (
                  <div key={field.key} className={cn(
                    "flex justify-between gap-2",
                    field.type === "textarea" && "col-span-2"
                  )}>
                    <span className="text-muted-foreground truncate">{field.label}:</span>
                    {isEditing ? (
                      field.type === "textarea" ? (
                        <textarea
                          value={String(editData[field.key] || "")}
                          onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                          className="flex-1 px-1 border rounded text-xs min-h-[60px]"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={String(editData[field.key] || "")}
                          onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                          className="w-24 px-1 text-right border rounded text-xs"
                        />
                      )
                    ) : (
                      <span className="font-medium truncate">{formatValue(data[field.key])}</span>
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

export { ENTITY_FIELDS, ENTITY_LABELS };
