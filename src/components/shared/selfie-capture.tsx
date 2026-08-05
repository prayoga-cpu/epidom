"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";

interface SelfieCaptureProps {
  onConfirm: (file: File) => void;
  disabled?: boolean;
}

/**
 * Front-camera selfie capture for attendance clock-in/out. Genuinely new to
 * this codebase (no prior getUserMedia usage) — built as a small,
 * self-contained component with a graceful fallback: if the camera stream
 * can't be opened (permission denied, unsupported browser, PWA quirks), a
 * plain `<input type="file" capture="user">` still opens the native camera
 * on mobile with no custom video pipeline required.
 */
export function SelfieCapture({ onConfirm, disabled }: SelfieCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
        setCameraFailed(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) setCameraFailed(true);
      }
    }

    if (!previewUrl) startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      },
      "image/jpeg",
      0.85
    );
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setCameraReady(false);
    setCameraFailed(false);
  };

  const handleConfirm = () => {
    if (!previewBlob) return;
    onConfirm(new File([previewBlob], "selfie.jpg", { type: "image/jpeg" }));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  return (
    <div className="flex min-h-0 flex-col items-center gap-3">
      <div className="bg-muted relative aspect-square w-full max-w-[280px] overflow-hidden rounded-xl">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : cameraFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Camera className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-xs">{t("clockInOut.cameraPermissionDenied")}</p>
          </div>
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileInput}
      />

      {previewUrl ? (
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={handleRetake}
            disabled={disabled}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("clockInOut.retake")}
          </Button>
          <Button type="button" className="h-11 flex-1" onClick={handleConfirm} disabled={disabled}>
            <Check className="mr-2 h-4 w-4" />
            {t("clockInOut.confirmPhoto")}
          </Button>
        </div>
      ) : cameraFailed ? (
        <Button
          type="button"
          className="h-11 w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t("clockInOut.takePhoto")}
        </Button>
      ) : (
        <Button
          type="button"
          className="h-11 w-full"
          onClick={handleCapture}
          disabled={disabled || !cameraReady}
        >
          <Camera className="mr-2 h-4 w-4" />
          {t("clockInOut.takePhoto")}
        </Button>
      )}
    </div>
  );
}
