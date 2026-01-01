/**
 * File Upload Step Component
 *
 * Native file input with drag & drop support and entity type selector.
 */

"use client";

import { useCallback, useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { EntityType } from "@/lib/ai/import/types";

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
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const validTypes = ["text/csv", "application/vnd.ms-excel", "text/plain"];
    const validExtensions = [".csv", ".txt"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const extension = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      return "Please upload a CSV file";
    }

    if (file.size > maxSize) {
      return "File too large. Maximum size is 10MB";
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
      <div className="space-y-2">
        <Label>What are you importing? (Optional)</Label>
        <Select
          value={selectedEntityType || "auto"}
          onValueChange={(v) => onEntityTypeChange(v === "auto" ? undefined : (v as EntityType))}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Auto-detect" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">🤖 Auto-detect (AI will figure it out)</SelectItem>
            <SelectItem value="material">📦 Materials (Bahan Baku)</SelectItem>
            <SelectItem value="product">🛒 Products (Produk)</SelectItem>
            <SelectItem value="supplier">🚚 Suppliers (Pemasok)</SelectItem>
            <SelectItem value="recipe">👨‍🍳 Recipes (Resep)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          AI will analyze your file and detect the entity type automatically.
        </p>
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
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div>
                <p className="text-lg font-medium">Processing...</p>
                <p className="text-sm text-muted-foreground">AI is analyzing your file</p>
              </div>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="h-12 w-12 text-primary" />
              <p className="text-lg font-medium">Drop your file here</p>
            </>
          ) : (
            <>
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Drag & drop your CSV file here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Supports .csv files up to 10MB • Any language • Any format
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {dragError && <p className="text-sm text-destructive text-center">{dragError}</p>}

      {/* AI Features hint */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">✨ AI-Powered Import Features:</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Automatic language detection (supports 100+ languages)</li>
          <li>• Smart column mapping (even with non-standard headers)</li>
          <li>• Typo correction & data healing</li>
          <li>• Duplicate detection & conflict resolution</li>
          <li>• Auto-create missing suppliers & materials</li>
        </ul>
      </div>
    </div>
  );
}
