"use client";

import { useState } from "react";
import { Loader2, Tag, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CategoryDeleteMode } from "@/lib/validation/inventory.schemas";

export type { CategoryDeleteMode };

interface CategoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: (mode: CategoryDeleteMode) => Promise<void>;
  isSubmitting?: boolean;
  uncategorizeLabel: string;
  uncategorizeDescription: string;
  deleteLabel: string;
  deleteDescription: string;
  confirmText: string;
  cancelText: string;
}

/**
 * Confirms deletion of a category, letting the user choose what happens to
 * the items in it: keep them (just drop the category tag) or delete them
 * too. Shared by data categories (products/materials/recipes) and storefront
 * menu categories.
 */
export function CategoryDeleteDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  isSubmitting,
  uncategorizeLabel,
  uncategorizeDescription,
  deleteLabel,
  deleteDescription,
  confirmText,
  cancelText,
}: CategoryDeleteDialogProps) {
  const [mode, setMode] = useState<CategoryDeleteMode>("uncategorize");

  const handleOpenChange = (next: boolean) => {
    if (!next) setMode("uncategorize");
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    await onConfirm(mode);
  };

  const isBusy = !!isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as CategoryDeleteMode)}
          className="gap-2"
        >
          <Label
            htmlFor="category-delete-uncategorize"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              mode === "uncategorize" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            )}
          >
            <RadioGroupItem
              value="uncategorize"
              id="category-delete-uncategorize"
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Tag className="h-3.5 w-3.5" />
                {uncategorizeLabel}
              </span>
              <span className="text-muted-foreground text-xs">{uncategorizeDescription}</span>
            </span>
          </Label>

          <Label
            htmlFor="category-delete-delete"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              mode === "delete"
                ? "border-destructive bg-destructive/5"
                : "hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value="delete" id="category-delete-delete" className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-destructive flex items-center gap-1.5 text-sm font-medium">
                <Trash2 className="h-3.5 w-3.5" />
                {deleteLabel}
              </span>
              <span className="text-muted-foreground text-xs">{deleteDescription}</span>
            </span>
          </Label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isBusy}>
            {cancelText}
          </Button>
          <Button
            variant={mode === "delete" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
