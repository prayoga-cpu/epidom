"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { ImageUpload } from "@/components/shared/image-upload";
import { AvatarCropper } from "@/components/shared/avatar-cropper";
import { toast } from "sonner";
import { useUpdateProfile } from "../hooks/use-profile";
import { Loader2, Upload } from "lucide-react";
import {
  compressImage,
  createImagePreview,
  revokeImagePreview,
  deleteBlobImage,
} from "@/lib/utils/image-compression";

interface EditAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    image?: string | null;
    name?: string | null;
  };
  onUpdate?: () => void;
}

type DialogMode = "upload" | "crop" | "preview";

export function EditAvatarDialog({ open, onOpenChange, user, onUpdate }: EditAvatarDialogProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<DialogMode>("upload");
  const [originalImageUrl, setOriginalImageUrl] = useState<string | undefined>(
    user.image || undefined
  );
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | undefined>(undefined);
  const [tempImageUrl, setTempImageUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateProfile = useUpdateProfile();

  // Sync originalImageUrl with user.image when dialog opens or user.image changes
  useEffect(() => {
    if (open) {
      setOriginalImageUrl(user.image || undefined);
    }
  }, [open, user.image]);

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Cleanup temp URLs
      if (tempImageUrl && tempImageUrl.startsWith("blob:")) {
        revokeImagePreview(tempImageUrl);
      }
      if (croppedImageUrl && croppedImageUrl.startsWith("blob:")) {
        revokeImagePreview(croppedImageUrl);
      }
      // Reset state
      setMode("upload");
      setTempImageUrl(undefined);
      setCroppedImageUrl(undefined);
    }
    onOpenChange(newOpen);
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    try {
      // Create preview URL
      const preview = createImagePreview(file);
      setTempImageUrl(preview);
      setMode("crop");
    } catch (error) {
      console.error("Error creating preview:", error);
      toast.error(t("common.error"), {
        description: t("profile.errors.loadImageFailed") || t("profile.forms.loadImageFailed"),
      });
    }
  }, [t]);

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    e.target.value = "";
  };

  // Handle crop complete
  const handleCropComplete = useCallback((croppedUrl: string) => {
    setCroppedImageUrl(croppedUrl);
    setMode("preview");
  }, []);

  // Handle cancel crop - go back to upload
  const handleCancelCrop = useCallback(() => {
    if (tempImageUrl && tempImageUrl.startsWith("blob:")) {
      revokeImagePreview(tempImageUrl);
    }
    setTempImageUrl(undefined);
    setMode("upload");
  }, [tempImageUrl]);

  // Upload cropped image to server
  const handleSave = async () => {
    const imageToUpload = croppedImageUrl || originalImageUrl;

    if (!imageToUpload) {
      return;
    }

    try {
      // If it's a blob URL, we need to upload it
      if (imageToUpload.startsWith("blob:")) {
        // Convert blob URL to File
        const response = await fetch(imageToUpload);
        const blob = await response.blob();
        const file = new File([blob], "avatar.png", { type: "image/png" });

        // Compress image
        const compressedFile = await compressImage(file);

        // Upload to server
        const formData = new FormData();
        formData.append("file", compressedFile);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(t("profile.errors.uploadFailed") || t("profile.forms.uploadFailed"));
        }

        const data = await uploadResponse.json();

        // Cleanup blob URLs
        revokeImagePreview(imageToUpload);
        if (tempImageUrl && tempImageUrl !== imageToUpload) {
          revokeImagePreview(tempImageUrl);
        }

        // Update profile with new URL
        await updateProfile.mutateAsync({
          image: data.url,
        });
      } else {
        // Already a server URL, just update profile
        await updateProfile.mutateAsync({
          image: imageToUpload,
        });
      }

      // Note: Toast notification is now handled in useUpdateProfile hook
      // to prevent duplicate notifications
      handleOpenChange(false);
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("profile.errors.updateFailed"),
      });
    }
  };

  const handleRemove = async () => {
    try {
      // Delete image from blob storage if it exists
      if (originalImageUrl) {
        try {
          await deleteBlobImage(originalImageUrl);
        } catch (error) {
          // Continue with removal even if delete fails
          console.warn("Failed to delete avatar from storage:", error);
        }
      }

      // Update profile to remove image
      await updateProfile.mutateAsync({
        image: "",
      });

      setOriginalImageUrl(undefined);
      // Note: Toast notification is now handled in useUpdateProfile hook
      // to prevent duplicate notifications
      handleOpenChange(false);
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("profile.errors.updateFailed"),
      });
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile.forms.editAvatar")}</DialogTitle>
          <DialogDescription>
            {mode === "upload" && t("profile.forms.editAvatarDescription")}
            {mode === "crop" && t("profile.forms.cropAvatarDescription")}
            {mode === "preview" && t("profile.forms.previewAvatarDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Mode */}
          {mode === "upload" && (
            <>
              {originalImageUrl ? (
                <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-full">
                  <img
                    src={originalImageUrl}
                    alt={t("profile.forms.editAvatar")}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="border-border bg-muted/50 relative mx-auto aspect-square w-full max-w-xs cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-muted"
                  onClick={openFilePicker}
                >
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 mb-4 rounded-full p-4">
                      <Upload className="text-primary h-8 w-8" />
                    </div>
                    <p className="text-foreground mb-1 text-sm font-medium">
                      {t("profile.forms.uploadAvatar")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("profile.forms.fileTypesInfo")}
                    </p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleInputChange}
                className="hidden"
                aria-hidden="true"
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={updateProfile.isPending}
                  className="flex-1"
                >
                  {t("common.actions.cancel")}
                </Button>
                {originalImageUrl && (
                  <Button
                    variant="destructive"
                    onClick={handleRemove}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("profile.actions.removeAvatar")}
                  </Button>
                )}
                <Button
                  onClick={openFilePicker}
                  disabled={updateProfile.isPending}
                  className="flex-1"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {t("profile.actions.uploadAvatar")}
                </Button>
              </div>
            </>
          )}

          {/* Crop Mode */}
          {mode === "crop" && tempImageUrl && (
            <>
              <AvatarCropper
                imageSrc={tempImageUrl}
                onCropComplete={handleCropComplete}
                onCancel={handleCancelCrop}
                aspect={1}
                initialZoom={1}
              />
            </>
          )}

          {/* Preview Mode */}
          {mode === "preview" && croppedImageUrl && (
            <>
              <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-full">
                <img
                  src={croppedImageUrl}
                  alt={t("profile.forms.previewAvatarDescription")}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelCrop}
                  disabled={updateProfile.isPending}
                  className="flex-1"
                >
                  {t("common.actions.back")}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateProfile.isPending}
                  className="flex-1"
                >
                  {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.actions.save")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
