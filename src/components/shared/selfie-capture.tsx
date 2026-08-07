"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";

interface SelfieCaptureProps {
  onConfirm: (file: File) => void;
  disabled?: boolean;
}

type CameraFailure = "denied" | "not-found" | "insecure" | "unsupported" | "other";

/**
 * Front-camera selfie capture for attendance clock-in/out — must work the
 * same on a desktop webcam as it does on a mobile front camera, since owners
 * check the dashboard (and can clock staff in/out) from either. Built as a
 * small, self-contained component with a graceful fallback: if the camera
 * stream can't be opened (permission denied, unsupported browser, PWA
 * quirks, no camera hardware), a plain `<input type="file" capture="user">`
 * still opens the native camera on mobile — and a normal file picker on
 * desktop — with no custom video pipeline required. A distinct failure
 * reason drives the message so "you blocked the camera" and "this device
 * has no camera" don't look like the same dead end, and a Retry button lets
 * someone who just granted the permission (via the browser's own UI) try
 * again without closing the whole dialog.
 */
export function SelfieCapture({ onConfirm, disabled }: SelfieCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailure, setCameraFailure] = useState<CameraFailure | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      // Browsers only expose getUserMedia on HTTPS (or localhost) — over
      // plain HTTP on a LAN IP (common when testing a desktop against a
      // phone on the same network) `mediaDevices` is undefined entirely,
      // which would otherwise show the same generic message as a denied
      // permission.
      const isSecureContext =
        typeof window === "undefined" ||
        window.isSecureContext ||
        ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (!isSecureContext) {
        setCameraFailure("insecure");
        return;
      }
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
        setCameraFailure("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Non-exact "ideal" constraint — a desktop webcam that doesn't
          // report a "user" facingMode still matches instead of throwing
          // OverconstrainedError, so this same call works on phones and
          // laptops alike.
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
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraFailure("denied");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraFailure("not-found");
        } else {
          setCameraFailure("other");
        }
      }
    }

    if (!previewUrl) startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, retryToken]);

  const handleRetryCamera = () => {
    setCameraFailure(null);
    setCameraReady(false);
    setRetryToken((n) => n + 1);
  };

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
    setCameraFailure(null);
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

  const failureMessage = (() => {
    switch (cameraFailure) {
      case "denied":
        return t("clockInOut.cameraPermissionDenied");
      case "not-found":
        return t("clockInOut.cameraNotFound");
      case "insecure":
        return t("clockInOut.cameraInsecureContext");
      default:
        return t("clockInOut.cameraUnavailable");
    }
  })();
  // Re-requesting getUserMedia only makes sense once the user could plausibly
  // have changed something (granted the permission, plugged in a webcam) —
  // not when the browser itself doesn't support it or the page isn't served
  // over HTTPS, where retrying would just fail the same way immediately.
  const canRetryCamera = cameraFailure === "denied" || cameraFailure === "not-found";

  return (
    <div className="flex min-h-0 flex-col items-center gap-3">
      <div className="bg-muted relative aspect-square w-full max-w-[280px] overflow-hidden rounded-xl">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : cameraFailure ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Camera className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-xs">{failureMessage}</p>
            {canRetryCamera && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleRetryCamera}
                disabled={disabled}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("clockInOut.retryCamera")}
              </Button>
            )}
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
      ) : cameraFailure ? (
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
