/**
 * File Upload Step Component
 *
 * Native file input with drag & drop support and entity type selector.
 */

"use client";

import { useCallback, useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { LottieLoader } from "@/components/ui/lottie-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { EntityType } from "@/lib/ai/import/types";

import { useI18n } from "@/components/lang/i18n-provider";

interface FileUploadStepProps {
  onFileSelect: (file: File) => void;
  selectedEntityType: EntityType | undefined;
  onEntityTypeChange: (type: EntityType | undefined) => void;
  isLoading: boolean;
}

export function FileUploadStep({
  onFileSelect,
  selectedEntityType,
  onEntityTypeChange,
  isLoading,
}: FileUploadStepProps) {
  const { t } = useI18n();
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const validTypes = ["text/csv", "application/vnd.ms-excel", "text/plain"];
    const validExtensions = [".csv", ".txt"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const extension = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      return t("import.upload.error");
    }

    if (file.size > maxSize) {
      return t("import.upload.errorSize");
    }

    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      setDragError(null);
      const error = validateFile(file);

      if (error) {
        setDragError(error);
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="space-y-6">
      {/* Entity Type Selector */}
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2 bg-muted/40 p-1 pl-3 pr-1 rounded-lg border shadow-sm">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {t("import.upload.label")}
          </span>
          <Select
            value={selectedEntityType || "auto"}
            onValueChange={(v) =>
              onEntityTypeChange(v === "auto" ? undefined : (v as EntityType))
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-[200px] border-none shadow-none bg-transparent hover:bg-muted/50 focus:ring-0 h-8">
              <SelectValue placeholder="Auto-detect" />
            </SelectTrigger>
            <SelectContent align="center">
              <SelectItem value="auto">{t("import.upload.entities.auto")}</SelectItem>
              <SelectItem value="material">{t("import.upload.entities.material")}</SelectItem>
              <SelectItem value="product">{t("import.upload.entities.product")}</SelectItem>
              <SelectItem value="supplier">{t("import.upload.entities.supplier")}</SelectItem>
              <SelectItem value="recipe">{t("import.upload.entities.recipe")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          !isDragActive && "border-muted-foreground/25 hover:border-primary/50",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleInputChange}
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center gap-4">
          {isLoading ? (
            <>
              <LottieLoader size="xl" />
              <div>
                <p className="text-lg font-medium">{t("import.upload.processing")}</p>
                <p className="text-sm text-muted-foreground">{t("import.upload.analyzing")}</p>
              </div>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="h-12 w-12 text-primary" />
              <p className="text-lg font-medium">{t("import.upload.dropToUpload")}</p>
            </>
          ) : (
            <>
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">{t("import.upload.dropZone")}</p>
                <p className="text-sm text-muted-foreground">{t("import.upload.browse")}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {t("import.upload.supports")}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {dragError && <p className="text-sm text-destructive text-center">{dragError}</p>}
    </div>
  );
}
