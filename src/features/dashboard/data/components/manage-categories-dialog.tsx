"use client";

import { useState } from "react";
import { Trash2, Tags } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CategoryDeleteDialog,
  type CategoryDeleteMode,
} from "@/components/ui/category-delete-dialog";

export interface CategoryUsage {
  /** Raw value stored on the item rows — what gets sent to the delete call. */
  name: string;
  /** Optional display label (e.g. a translated name); defaults to `name`. */
  label?: string;
  count: number;
}

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryUsage[];
  onDelete: (category: string, mode: CategoryDeleteMode) => Promise<void>;
  isDeleting?: boolean;
  title: string;
  description: string;
  emptyText: string;
  itemCountLabel: (count: number) => string;
  confirmTitle: (category: CategoryUsage) => string;
  uncategorizeLabel: string;
  uncategorizeDescription: (category: CategoryUsage) => string;
  deleteLabel: string;
  deleteDescription: (category: CategoryUsage) => string;
  confirmText: string;
  cancelText: string;
}

/**
 * Lists categories currently in use (derived from item rows — there is no
 * separate category entity) with a delete action per category. Deleting a
 * category lets the user choose whether to keep the items (just clear the
 * category tag) or delete them too. Shared by Products, Materials, and
 * Recipes sections.
 */
export function ManageCategoriesDialog({
  open,
  onOpenChange,
  categories,
  onDelete,
  isDeleting,
  title,
  description,
  emptyText,
  itemCountLabel,
  confirmTitle,
  uncategorizeLabel,
  uncategorizeDescription,
  deleteLabel,
  deleteDescription,
  confirmText,
  cancelText,
}: ManageCategoriesDialogProps) {
  const [pendingCategory, setPendingCategory] = useState<CategoryUsage | null>(null);

  const handleConfirmDelete = async (mode: CategoryDeleteMode) => {
    if (!pendingCategory) return;
    await onDelete(pendingCategory.name, mode);
    setPendingCategory(null);
  };

  return (
    <>
      {/* The per-category delete prompt replaces this list instead of stacking
          on it (two overlays, two focus traps) — closing it returns here with
          the list still open. Same swap the POS order dialogs use, hand-rolled
          because the layer carries a payload (see useDialogSwap). */}
      <Dialog open={open && pendingCategory === null} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(50vh/var(--app-zoom,1))] space-y-1 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{emptyText}</p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {category.label ?? category.name}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {itemCountLabel(category.count)}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0 p-0"
                    onClick={() => setPendingCategory(category)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CategoryDeleteDialog
        // Remount per category so the destructive "delete" choice never carries
        // over as the default when the user moves on to a different category.
        key={pendingCategory?.name}
        open={open && pendingCategory !== null}
        onOpenChange={(next) => {
          if (!next) setPendingCategory(null);
        }}
        title={pendingCategory ? confirmTitle(pendingCategory) : ""}
        onConfirm={handleConfirmDelete}
        isSubmitting={isDeleting}
        uncategorizeLabel={uncategorizeLabel}
        uncategorizeDescription={pendingCategory ? uncategorizeDescription(pendingCategory) : ""}
        deleteLabel={deleteLabel}
        deleteDescription={pendingCategory ? deleteDescription(pendingCategory) : ""}
        confirmText={confirmText}
        cancelText={cancelText}
      />
    </>
  );
}
