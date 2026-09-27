"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { AvatarCropper } from "@/components/shared/avatar-cropper";
import { ArrowRight, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  compressImage,
  createImagePreview,
  isValidImage,
  isValidImageSize,
  revokeImagePreview,
} from "@/lib/utils/image-compression";
import type { InstagramPrefill } from "../lib/instagram-prefill";
import { slugifyStoreLink, storeLinkLabel } from "../lib/store-link";

export type { InstagramPrefill } from "../lib/instagram-prefill";

/**
 * The optional "Fill from Instagram" shortcut on the wizard's first step,
 * rendered inside a dialog: upload a screenshot of the profile page → it is
 * read (POST /api/onboarding/analyze-profile) → the owner reviews what was
 * found → optionally crops the profile picture into the store logo. Nothing
 * is saved here; the result pre-fills step 1, which saves it.
 */
interface InstagramImportStepProps {
  onComplete: (prefill: InstagramPrefill) => void;
  /** Close without using anything (the owner fills the form by hand). */
  onCancel: () => void;
}

interface AnalyzeProfileResult {
  isInstagramProfile: boolean;
  confidence: number;
  username: string | null;
  businessName: string | null;
  bio: string | null;
  category: string | null;
  externalLinks: string[];
  whatsappNumber: string | null;
  suggestedThemeHex: string | null;
}

type Phase = "choice" | "upload" | "review" | "crop";

const BUTTON_PRIMARY =
  "group h-11 w-full rounded-xl text-sm font-semibold transition-colors bg-[var(--epi-gold-500)] hover:bg-[var(--epi-gold-600)] text-[var(--epi-navy-900)]";
const BUTTON_SECONDARY =
  "h-11 min-w-0 flex-1 rounded-xl border border-[var(--epi-gold-500)]/30 text-foreground hover:bg-[var(--epi-gold-500)]/10";
const BUTTON_GHOST = "h-11 w-full rounded-xl text-sm text-muted-foreground";

/** Thrown when /api/upload refuses the file; the caller shows its own localized message. */
class UploadError extends Error {}

async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data?.url) {
    throw new UploadError(json?.error?.message || "Upload failed");
  }
  return json.data.url as string;
}

export function InstagramImportStep({ onComplete, onCancel }: InstagramImportStepProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("choice");
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeProfileResult | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Revoke the screenshot preview object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) revokeImagePreview(previewUrlRef.current);
    };
  }, []);

  const setPreview = (url: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== url) {
      revokeImagePreview(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setLocalPreviewUrl(url);
  };

  const ik = "onboarding.instagram" as const;

  const username = analysis?.username ? analysis.username.replace(/^@+/, "") : null;
  const slug = analysis ? slugifyStoreLink(username ?? analysis.businessName ?? "") : "";

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isValidImage(file) || !isValidImageSize(file)) {
      toast.error(t("common.error"), { description: t(`${ik}.uploadHint`) });
      return;
    }

    setPreview(createImagePreview(file));
    setPhase("upload");

    try {
      const imageUrl = await uploadImage(file);

      const analyzeRes = await fetch("/api/onboarding/analyze-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const analyzeJson = await analyzeRes.json().catch(() => null);
      if (!analyzeRes.ok || !analyzeJson?.data) {
        toast.error(t(`${ik}.analyzeFailed`));
        setPhase("choice");
        return;
      }
      const result = analyzeJson.data as AnalyzeProfileResult;

      if (!result.isInstagramProfile) {
        toast.error(t(`${ik}.notInstagram`));
        setPhase("choice");
        return;
      }
      if (result.confidence < 0.5) {
        toast.error(t(`${ik}.lowConfidence`));
        setPhase("choice");
        return;
      }

      setAnalysis(result);
      setPhase("review");
    } catch (err) {
      toast.error(t(err instanceof UploadError ? `${ik}.uploadFailed` : `${ik}.analyzeFailed`));
      setPhase("choice");
    }
  };

  const finish = (logoUrl: string | null) => {
    if (!analysis) return;

    const themeHex =
      analysis.suggestedThemeHex && /^#[0-9a-fA-F]{6}$/.test(analysis.suggestedThemeHex)
        ? analysis.suggestedThemeHex
        : null;

    onComplete({
      name: analysis.businessName ?? "",
      tagline: analysis.bio ? analysis.bio.split("\n")[0].trim().slice(0, 120) : "",
      slugCandidate: slug || null,
      instagramUrl: username ? `https://instagram.com/${username}` : null,
      whatsappNumber: analysis.whatsappNumber,
      themeColor: themeHex,
      logoUrl,
      bio: analysis.bio,
      category: analysis.category,
    });
  };

  const skipCrop = () => finish(null);

  const handleCropped = async (croppedUrl: string) => {
    setIsUploadingLogo(true);
    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const file = new File([blob], "logo.png", { type: "image/png" });
      const logoUrl = await uploadImage(file);
      finish(logoUrl);
    } catch {
      toast.error(t(`${ik}.uploadFailed`));
    } finally {
      if (croppedUrl.startsWith("blob:")) revokeImagePreview(croppedUrl);
      setIsUploadingLogo(false);
    }
  };

  const PhaseHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="space-y-1">
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{subtitle}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* CHOICE */}
      {phase === "choice" && (
        <div className="space-y-3">
          <Button type="button" onClick={openFilePicker} className={BUTTON_PRIMARY}>
            <Upload className="mr-2 h-4 w-4" />
            {t(`${ik}.uploadCta`)}
          </Button>
          <p className="text-muted-foreground text-center text-xs">{t(`${ik}.uploadHint`)}</p>
          <Button type="button" variant="ghost" onClick={onCancel} className={BUTTON_GHOST}>
            {t(`${ik}.cancel`)}
          </Button>
        </div>
      )}

      {/* UPLOAD / ANALYZING */}
      {phase === "upload" && (
        <>
          <div className="border-border bg-muted relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border">
            {localPreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localPreviewUrl}
                alt=""
                className="max-h-72 w-full object-contain opacity-40"
              />
            )}
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <Loader2
                aria-hidden="true"
                className="h-6 w-6 animate-spin text-[var(--epi-gold-500)]"
              />
              <span className="text-foreground text-sm font-medium">{t(`${ik}.analyzing`)}</span>
            </div>
          </div>
        </>
      )}

      {/* REVIEW */}
      {phase === "review" && analysis && (
        <>
          <PhaseHeader title={t(`${ik}.reviewTitle`)} subtitle={t(`${ik}.fromInstagram`)} />
          <div className="border-border bg-muted/30 space-y-4 rounded-2xl border p-4 sm:p-5">
            <div>
              <p className="text-muted-foreground text-xs font-medium">{t(`${ik}.detectedName`)}</p>
              <p className="text-foreground text-sm font-semibold">{analysis.businessName ?? ""}</p>
            </div>
            {username && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  {t(`${ik}.detectedUsername`)}
                </p>
                <p className="text-foreground text-sm font-semibold">{"@" + username}</p>
              </div>
            )}
            {analysis.bio && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  {t(`${ik}.detectedBio`)}
                </p>
                <p className="text-foreground line-clamp-3 text-sm">{analysis.bio}</p>
              </div>
            )}
            {slug ? (
              <div className="border-border border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  {t(`${ik}.slugPreview`) + " "}
                  <span className="text-foreground font-mono font-medium break-all">
                    {storeLinkLabel(slug)}
                  </span>
                </p>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <Button type="button" onClick={() => setPhase("crop")} className={BUTTON_PRIMARY}>
              {t(`${ik}.looksRight`)}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={openFilePicker}
                className={BUTTON_SECONDARY}
              >
                <span className="truncate">{t(`${ik}.reupload`)}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="text-muted-foreground h-11 rounded-xl sm:flex-none"
              >
                {t(`${ik}.cancel`)}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* CROP */}
      {phase === "crop" && localPreviewUrl && (
        <>
          <PhaseHeader title={t(`${ik}.cropTitle`)} subtitle={t(`${ik}.cropSubtitle`)} />
          {isUploadingLogo ? (
            <div role="status" className="flex h-[300px] items-center justify-center">
              <Loader2
                aria-hidden="true"
                className="h-6 w-6 animate-spin text-[var(--epi-gold-500)]"
              />
              <span className="sr-only">{t(`${ik}.uploadingLogo`)}</span>
            </div>
          ) : (
            <>
              <AvatarCropper
                imageSrc={localPreviewUrl}
                aspect={1}
                maxZoom={7}
                onCropComplete={handleCropped}
                onCancel={skipCrop}
              />
              <Button type="button" variant="ghost" onClick={skipCrop} className={BUTTON_GHOST}>
                {t(`${ik}.cropSkip`)}
              </Button>
            </>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
