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
 * - Error handling with toast notifications
 * - Accessible (ARIA labels, keyboard navigation)
 * - Client-side compression before upload
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  compressImage,
  isValidImage,
  isValidImageSize,
  createImagePreview,
  revokeImagePreview,
  deleteBlobImage,
} from "@/lib/utils/image-compression";
import { cn } from "@/lib/utils";

export interface ImageUploadProps {
  /** Current image URL */
  value?: string;
  /** Callback when image changes */
  onChange: (url: string | undefined) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Maximum file size in MB (default: 5) */
  maxSize?: number;
  /** Custom class name */
  className?: string;
  /** Aspect ratio for preview (e.g., '16/9', '1/1') */
  aspectRatio?: string;
  /** Callback when upload state changes */
  onUploadStateChange?: (isUploading: boolean) => void;
}

export function ImageUpload({
  value,
  onChange,
  disabled = false,
  maxSize = 5,
  className,
  aspectRatio,
  onUploadStateChange,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(value);
  const previousValueRef = useRef<string | undefined>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        return "Please select a valid image file (JPEG, PNG, WebP, or GIF)";
      }

      // Check file size
      if (!isValidImageSize(file, maxSize)) {
        return `Image size must be less than ${maxSize}MB`;
      }

      return null;
    },
    [maxSize]
  );

  /**
   * Upload image to server
   */
  const uploadImage = useCallback(
    async (file: File) => {
      const oldImageUrl = value; // Store old image URL before starting upload

      try {
        setIsUploading(true);

        // Delete old image if exists
        if (oldImageUrl) {
          try {
            await deleteBlobImage(oldImageUrl);
          } catch (error) {
            // Continue with upload even if delete fails
          }
        }

        // Compress image
        toast({
          title: "Compressing image...",
          description: "Please wait while we optimize your image.",
        });

        const compressedFile = await compressImage(file);

        // Create preview
        const preview = createImagePreview(compressedFile);
        setPreviewUrl(preview);

        // Upload to server
        toast({
          title: "Uploading image...",
          description: "Please wait while we upload your image.",
        });

        const formData = new FormData();
        formData.append("file", compressedFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Upload failed");
        }

        const data = await response.json();

        // Revoke preview URL since we have the final URL
        revokeImagePreview(preview);

        // Update with final URL
        setPreviewUrl(data.data.url);
        previousValueRef.current = data.data.url;
        onChange(data.data.url);

        toast({
          title: "Success!",
          description: "Image uploaded successfully.",
        });
      } catch (error) {
        // Cleanup preview on error and restore old value
        if (previewUrl && previewUrl.startsWith("blob:")) {
          revokeImagePreview(previewUrl);
        }
        setPreviewUrl(oldImageUrl);

        const message = error instanceof Error ? error.message : "Failed to upload image";

        toast({
          title: "Upload failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [value, onChange, toast, previewUrl]
  );

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Invalid file",
          description: error,
          variant: "destructive",
        });
        return;
      }

      uploadImage(file);
    },
    [validateFile, uploadImage, toast]
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

    // Delete from blob storage if it's a blob storage URL
    if (currentUrl) {
      try {
        await deleteBlobImage(currentUrl);
      } catch (error) {
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

    toast({
      title: "Image removed",
      description: "The image has been removed.",
    });
  }, [previewUrl, value, onChange, toast]);

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
            className={cn(
              "border-border bg-muted relative overflow-hidden rounded-lg border",
              aspectRatio && `aspect-[${aspectRatio}]`
            )}
          >
            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />

            {/* Remove Button */}
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleRemove}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove image</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "border-border bg-muted/50 relative rounded-lg border-2 border-dashed p-8 transition-colors",
            isDragging && "border-primary bg-primary/10",
            disabled && "cursor-not-allowed opacity-60",
            !disabled && "hover:border-primary hover:bg-muted cursor-pointer"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={!disabled ? openFilePicker : undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload image"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
        >
          {/* Upload Icon and Text */}
          <div className="flex flex-col items-center justify-center text-center">
            {isUploading ? (
              <>
                <LottieLoader size="lg" />
                <p className="text-muted-foreground text-sm font-medium">Uploading...</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Please wait while we process your image
                </p>
              </>
            ) : (
              <>
                <div className="bg-primary/10 mb-4 rounded-full p-4">
                  {isDragging ? (
                    <ImageIcon className="text-primary h-8 w-8" />
                  ) : (
                    <Upload className="text-primary h-8 w-8" />
                  )}
                </div>
                <p className="text-foreground mb-1 text-sm font-medium">
                  {isDragging ? "Drop image here" : "Drag & drop an image, or click to browse"}
                </p>
                <p className="text-muted-foreground text-xs">
                  JPEG, PNG, WebP, or GIF (max {maxSize}MB)
                </p>
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

      {/* Help Text */}
      <p className="text-muted-foreground text-xs">
        Images will be automatically compressed and optimized for best performance.
      </p>
    </div>
  );
}
