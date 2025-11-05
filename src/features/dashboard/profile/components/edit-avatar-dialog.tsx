"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { useUpdateProfile } from "../hooks/use-profile";
import { Loader2 } from "lucide-react";

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

export function EditAvatarDialog({ open, onOpenChange, user, onUpdate }: EditAvatarDialogProps) {
  const { t } = useI18n();
  const [imageUrl, setImageUrl] = useState<string | undefined>(user.image || undefined);
  const updateProfile = useUpdateProfile();

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        image: imageUrl || "",
      });

      toast.success(t("profile.toasts.avatarUpdated.title") || "Avatar updated", {
        description:
          t("profile.toasts.avatarUpdated.description") ||
          "Your avatar has been updated successfully.",
      });

      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("profile.errors.updateFailed"),
      });
    }
  };

  const handleRemove = async () => {
    try {
      await updateProfile.mutateAsync({
        image: "",
      });

      setImageUrl(undefined);
      toast.success(t("profile.toasts.avatarRemoved.title") || "Avatar removed", {
        description:
          t("profile.toasts.avatarRemoved.description") || "Your avatar has been removed.",
      });

      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("profile.errors.updateFailed"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile.forms.editAvatar") || "Edit Profile Picture"}</DialogTitle>
          <DialogDescription>
            {t("profile.forms.editAvatarDescription") ||
              "Upload a new profile picture or remove the current one."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            disabled={updateProfile.isPending}
            aspectRatio="1/1"
            className="mx-auto max-w-xs"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateProfile.isPending}
              className="flex-1"
            >
              {t("common.actions.cancel")}
            </Button>
            {imageUrl && (
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("profile.actions.removeAvatar") || "Remove"}
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending || !imageUrl}
              className="flex-1"
            >
              {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.actions.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
