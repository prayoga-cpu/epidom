"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { AvatarCropper } from "@/components/shared/avatar-cropper";
import { ArrowRight, Instagram, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  compressImage,
  createImagePreview,
  isValidImage,
  isValidImageSize,
  revokeImagePreview,
} from "@/lib/utils/image-compression";

export interface InstagramPrefill {
  name: string;
  tagline: string;
  slugCandidate: string | null;
  instagramUrl: string | null;
  whatsappNumber: string | null;
  themeColor: string | null;
  logoUrl: string | null;
  bio: string | null;
  category: string | null;
}

interface InstagramImportStepProps {
  onComplete: (prefill: InstagramPrefill) => void;
  onSkip: () => void;
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
  "group h-12 w-full rounded-xl text-sm font-semibold shadow-lg transition-all bg-[var(--epi-gold-500)] hover:bg-[var(--epi-gold-600)] text-[var(--epi-navy-900)]";
const BUTTON_SECONDARY =
  "h-12 rounded-xl border border-[var(--epi-gold-500)]/30 text-foreground hover:bg-[var(--epi-gold-500)]/10";
const BUTTON_GHOST = "h-12 w-full rounded-xl text-sm text-muted-foreground";

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || "Upload failed");
  }
  return json.data.url as string;
}

export function InstagramImportStep({ onComplete, onSkip }: InstagramImportStepProps) {
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

  const ik = "onboarding.storeSetup.importStep" as const;

  const username = analysis?.username ? analysis.username.replace(/^@+/, "") : null;
  const slug = analysis ? sanitizeSlug(username ?? analysis.businessName ?? "") : "";

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isValidImage(file) || !isValidImageSize(file, 5)) {
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
      const analyzeJson = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeJson?.error?.message || "Failed to analyze profile");
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
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      if (croppedUrl.startsWith("blob:")) revokeImagePreview(croppedUrl);
      setIsUploadingLogo(false);
    }
  };

  const StepHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="mb-8 text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "color-mix(in srgb, var(--epi-gold-500) 12%, transparent)",
          color: "var(--epi-gold-500)",
        }}
      >
        <Instagram className="h-7 w-7" />
      </div>
      <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* CHOICE */}
      {phase === "choice" && (
        <>
          <StepHeader title={t(`${ik}.title`)} subtitle={t(`${ik}.subtitle`)} />
          <div className="space-y-3">
            <Button onClick={openFilePicker} className={BUTTON_PRIMARY}>
              <Upload className="mr-2 h-4 w-4" />
              {t(`${ik}.uploadCta`)}
            </Button>
            <p className="text-muted-foreground text-center text-xs">{t(`${ik}.uploadHint`)}</p>
            <Button variant="ghost" onClick={onSkip} className={BUTTON_GHOST}>
              {t(`${ik}.manualSetup`)}
            </Button>
          </div>
        </>
      )}

      {/* UPLOAD / ANALYZING */}
      {phase === "upload" && (
        <>
          <StepHeader title={t(`${ik}.title`)} subtitle={t(`${ik}.subtitle`)} />
          <div className="border-border bg-muted relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border">
            {localPreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localPreviewUrl}
                alt=""
                className="max-h-72 w-full object-contain opacity-40"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--epi-gold-500)" }} />
              <span className="text-foreground text-sm font-medium">{t(`${ik}.analyzing`)}</span>
            </div>
          </div>
        </>
      )}

      {/* REVIEW */}
      {phase === "review" && analysis && (
        <>
          <StepHeader title={t(`${ik}.reviewTitle`)} subtitle={t(`${ik}.fromInstagram`)} />
          <div className="border-border bg-muted/30 space-y-4 rounded-2xl border p-6">
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
            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {t(`${ik}.slugPreview`) + " "}
                <span className="text-foreground font-mono font-medium">
                  {"epidom.fr/@" + slug}
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Button onClick={() => setPhase("crop")} className={BUTTON_PRIMARY}>
              {t(`${ik}.looksRight`)}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={openFilePicker} className={BUTTON_SECONDARY}>
                {t(`${ik}.uploadCta`)}
              </Button>
              <Button
                variant="ghost"
                onClick={onSkip}
                className="text-muted-foreground h-12 rounded-xl"
              >
                {t(`${ik}.manualSetup`)}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* CROP */}
      {phase === "crop" && localPreviewUrl && (
        <>
          <StepHeader title={t(`${ik}.cropTitle`)} subtitle={t(`${ik}.cropSubtitle`)} />
          {isUploadingLogo ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--epi-gold-500)" }} />
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
              <Button variant="ghost" onClick={skipCrop} className={BUTTON_GHOST}>
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
