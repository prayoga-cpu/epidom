"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/components/lang/i18n-provider";
import { Check, X } from "lucide-react";
import "react-easy-crop/react-easy-crop.css";

interface AvatarCropperProps {
  /** Image URL or blob URL to crop */
  imageSrc: string;
  /** Callback when crop is completed with cropped image data URL */
  onCropComplete: (croppedImageUrl: string) => void;
  /** Callback when user cancels cropping */
  onCancel: () => void;
  /** Aspect ratio for crop (default: 1 for square) */
  aspect?: number;
  /** Initial zoom level (default: 1) */
  initialZoom?: number;
}

/**
 * Create an image element from a URL
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
  });
}

/**
 * Create a cropped image from the crop area
 * Based on react-easy-crop's getCroppedImg utility approach
 */
async function createCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Set canvas to crop dimensions
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped portion
  // pixelCrop from react-easy-crop is in natural image pixel coordinates
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve(url);
      },
      "image/png",
      0.95
    );
  });
}

/**
 * Avatar Cropper Component
 *
 * Allows users to crop and adjust their avatar image before uploading.
 * Features:
 * - Drag to reposition crop area
 * - Zoom slider
 * - Square aspect ratio (1:1)
 * - Mobile-friendly touch gestures
 */
export function AvatarCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  aspect = 1,
  initialZoom = 1,
}: AvatarCropperProps) {
  const { t } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) {
      return;
    }

    setIsProcessing(true);
    try {
      const croppedImageUrl = await createCroppedImage(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImageUrl);
    } catch (error) {
      console.error("Error cropping image:", error);
      // Fallback: use original image if cropping fails
      onCropComplete(imageSrc);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete]);

  return (
    <div className="space-y-4">
      {/* Cropper Container */}
      <div className="relative bg-gray-900 h-[300px] w-full rounded-lg overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropCompleteCallback}
          cropShape="round"
          showGrid={false}
        />
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Zoom Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("profile.cropper.zoom")}
            </span>
            <span className="font-medium">{Math.round(zoom * 100)}%</span>
          </div>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(value) => onZoomChange(value[0])}
            className="w-full"
          />
        </div>

      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          <X className="mr-2 h-4 w-4" />
          {t("common.actions.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isProcessing || !croppedAreaPixels}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t("profile.cropper.processing")}
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {t("common.actions.apply")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

