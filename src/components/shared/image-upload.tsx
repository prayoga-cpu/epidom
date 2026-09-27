/**
 * Image Upload Component
 *
 * Reusable image upload component with drag & drop support.
 *
 * Features:
 * - Drag & drop zone with visual feedback
 * - File type validation (image/jpeg, image/png, image/webp)
 * - File size validation (< 5MB original)
 * - Image preview with remove button
 * - Upload progress indicator
 * - Errors shown under the tile (and as a sonner toast), in the UI language
 * - Accessible (ARIA labels, keyboard navigation)
 * - Client-side compression before upload
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  compressImage,
  isValidImage,
  isValidImageSize,
  createImagePreview,
  revokeImagePreview,
  deleteBlobImage,
} from "@/lib/utils/image-compression";
import { IMAGE_DEFAULT_TARGET_MB, IMAGE_RAW_UPLOAD_MAX_MB } from "@/lib/constants/image";
import { cn } from "@/lib/utils";

export interface ImageUploadProps {
  /** Current image URL */
  value?: string;
  /** Callback when image changes */
  onChange: (url: string | undefined) => void;
  /** Disabled state */
  disabled?: boolean;
  /**
   * Guaranteed output size in MB after compression (default: 2). This is
   * the compression *target*, not a rejection threshold — any file up to
   * IMAGE_RAW_UPLOAD_MAX_MB is accepted and auto-compressed down to this.
   */
  maxSize?: number;
  /** Custom class name */
  className?: string;
  /** Aspect ratio for preview (e.g., '16/9', '1/1') */
  aspectRatio?: string;
  /** Callback when upload state changes */
  onUploadStateChange?: (isUploading: boolean) => void;
  /**
   * Denser layout for small/narrow containers (e.g. a square thumbnail in a
   * dialog): smaller icon, one-line copy, and no repeated help text below —
   * pair with a caller-supplied guide instead.
   */
  compact?: boolean;
  /**
   * Delete the previous file from storage when the image is removed, or
   * after a replacement has uploaded (default: true). Pass false when the
   * previous URL may still be saved somewhere until the form is submitted
   * (e.g. the setup wizard, whose Skip/Back don't save): the server then
   * cleans up the old file once the new value is saved.
   */
  deletePrevious?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  disabled = false,
  maxSize = IMAGE_DEFAULT_TARGET_MB,
  className,
  aspectRatio,
  onUploadStateChange,
  compact = false,
  deletePrevious = true,
}: ImageUploadProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(value);
  // The last failure, shown under the tile until the next pick or removal.
  const [error, setError] = useState<string | null>(null);
  const previousValueRef = useRef<string | undefined>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync previewUrl with value prop when it changes externally
  useEffect(() => {
    if (value !== previousValueRef.current) {
      setPreviewUrl(value);
      previousValueRef.current = value;
    }
  }, [value]);

  // Notify parent about upload state changes
  useEffect(() => {
    onUploadStateChange?.(isUploading);
  }, [isUploading, onUploadStateChange]);

  /**
   * Validate file before upload
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (!isValidImage(file)) {
        return t("imageUpload.invalidType");
      }

      // Check raw (pre-compression) file size — compression brings it down to
      // `maxSize` afterward, so this only needs to bound processing cost, not
      // match the target.
      if (!isValidImageSize(file, IMAGE_RAW_UPLOAD_MAX_MB)) {
        return t("imageUpload.tooLarge").replace("{max}", String(IMAGE_RAW_UPLOAD_MAX_MB));
      }

      return null;
    },
    [t]
  );

  const showError = useCallback((message: string) => {
    setError(message);
    toast.error(message);
  }, []);

  /**
   * Upload image to server
   */
  const uploadImage = useCallback(
    async (file: File) => {
      const oldImageUrl = value; // Store old image URL before starting upload
      let preview: string | undefined;

      try {
        setIsUploading(true);
        setError(null);

        // The spinner on the tile is the progress feedback; no toasts.
        const compressedFile = await compressImage(file, { maxSizeMB: maxSize });

        // Create preview
        preview = createImagePreview(compressedFile);
        setPreviewUrl(preview);

        const formData = new FormData();
        formData.append("file", compressedFile);
        formData.append("maxSizeMB", String(maxSize));

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          // /api/upload's reasons are English-only, so the catch below shows
          // a message in the UI language instead.
          throw new Error(`Upload failed (${response.status})`);
        }

        const data = await response.json();
        const newUrl: string = data.data.url;

        // Revoke preview URL since we have the final URL
        revokeImagePreview(preview);
        preview = undefined;

        // Update with final URL
        setPreviewUrl(newUrl);
        previousValueRef.current = newUrl;
        onChange(newUrl);

        // Only now that the new file is in place is the old one removed, so a
        // failed upload never leaves the field pointing at a deleted file.
        if (deletePrevious && oldImageUrl && oldImageUrl !== newUrl) {
          deleteBlobImage(oldImageUrl).catch(() => {
            // An orphaned old file is harmless.
          });
        }
      } catch {
        // Cleanup preview on error and restore old value (still in storage:
        // nothing is deleted before the new upload succeeds).
        if (preview) revokeImagePreview(preview);
        setPreviewUrl(oldImageUrl);
        showError(t("imageUpload.uploadFailed"));
      } finally {
        setIsUploading(false);
      }
    },
    [value, onChange, maxSize, deletePrevious, showError, t]
  );

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (file: File) => {
      const invalid = validateFile(file);
      if (invalid) {
        showError(invalid);
        return;
      }

      uploadImage(file);
    },
    [validateFile, uploadImage, showError]
  );

  /**
   * Handle file input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    e.target.value = "";
  };

  /**
   * Handle drag events
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Handle remove image
   */
  const handleRemove = useCallback(async () => {
    const currentUrl = previewUrl || value;
    setError(null);

    // Delete from blob storage if it's a blob storage URL (never when the
    // caller may still have this URL saved: see `deletePrevious`).
    if (deletePrevious && currentUrl) {
      try {
        await deleteBlobImage(currentUrl);
      } catch {
        // Continue with removal even if delete fails
      }
    }

    // Cleanup blob preview URL
    if (previewUrl && previewUrl.startsWith("blob:")) {
      revokeImagePreview(previewUrl);
    }

    setPreviewUrl(undefined);
    previousValueRef.current = undefined;
    onChange(undefined);
  }, [previewUrl, value, onChange, deletePrevious]);

  /**
   * Open file picker
   */
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Preview or Upload Zone */}
      {previewUrl ? (
        <div className="group relative">
          {/* Image Preview */}
          <div
            className="border-border bg-muted relative overflow-hidden rounded-lg border"
            style={aspectRatio ? { aspectRatio } : undefined}
          >
            <img
              src={previewUrl}
              alt={t("imageUpload.previewAlt")}
              className="h-full w-full object-cover"
            />

            {/* Remove Button — the dark backdrop is a hover-only decorative
                enhancement (mouse only), but the button itself stays fully
                visible always: it already has its own solid destructive
                background, so it doesn't need the backdrop for contrast,
                and touch devices have no hover state to reveal it with. */}
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-lg"
                  onClick={handleRemove}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">{t("imageUpload.removeLabel")}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "border-border bg-muted/50 relative flex rounded-lg border-2 border-dashed transition-colors",
            compact ? "p-3" : "p-8",
            isDragging && "border-primary bg-primary/10",
            disabled && "cursor-not-allowed opacity-60",
            !disabled && "hover:border-primary hover:bg-muted cursor-pointer"
          )}
          style={aspectRatio ? { aspectRatio } : undefined}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={!disabled ? openFilePicker : undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("imageUpload.uploadLabel")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
        >
          {/* Upload Icon and Text */}
          <div className="m-auto flex flex-col items-center justify-center text-center">
            {isUploading ? (
              <>
                <Loader2
                  className={cn(
                    "text-muted-foreground animate-spin",
                    compact ? "mb-2 h-6 w-6" : "mb-4 h-10 w-10"
                  )}
                />
                <p className="text-muted-foreground text-sm font-medium">
                  {t("imageUpload.uploading")}
                </p>
                {!compact && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("imageUpload.processing")}
                  </p>
                )}
              </>
            ) : (
              <>
                <div
                  className={cn("bg-primary/10 rounded-full", compact ? "mb-2 p-2" : "mb-4 p-4")}
                >
                  {isDragging ? (
                    <ImageIcon className={cn("text-primary", compact ? "h-5 w-5" : "h-8 w-8")} />
                  ) : (
                    <Upload className={cn("text-primary", compact ? "h-5 w-5" : "h-8 w-8")} />
                  )}
                </div>
                {compact ? (
                  <p className="text-foreground text-xs font-medium">
                    {isDragging ? t("imageUpload.dropHereCompact") : t("imageUpload.promptCompact")}
                  </p>
                ) : (
                  <>
                    <p className="text-foreground mb-1 text-sm font-medium">
                      {isDragging ? t("imageUpload.dropHere") : t("imageUpload.prompt")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {/* The largest file accepted (it is compressed afterwards). */}
                      {t("imageUpload.formats").replace("{max}", String(IMAGE_RAW_UPLOAD_MAX_MB))}
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleInputChange}
            disabled={disabled || isUploading}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      )}

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      {/* Help Text */}
      {!compact && <p className="text-muted-foreground text-xs">{t("imageUpload.help")}</p>}
    </div>
  );
}
