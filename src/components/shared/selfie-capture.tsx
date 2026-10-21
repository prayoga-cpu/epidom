"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, Upload, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

interface SelfieCaptureProps {
  onConfirm: (file: File) => void;
  disabled?: boolean;
}

type CameraFailure =
  | "denied"
  | "policy"
  | "busy"
  | "not-found"
  | "insecure"
  | "unsupported"
  | "other";

const errorName = (error: unknown) =>
  typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";

const isPermissionError = (error: unknown) => {
  const name = errorName(error);
  return name === "NotAllowedError" || name === "SecurityError";
};

const isBusyError = (error: unknown) => {
  const name = errorName(error);
  return name === "NotReadableError" || name === "TrackStartError" || name === "AbortError";
};

/**
 * A `Permissions-Policy: camera=()` header (or an iframe without
 * `allow="camera"`) switches the camera off for the whole page: getUserMedia
 * rejects instantly and the browser never shows its prompt, however often we ask.
 */
function cameraBlockedByPolicy(): boolean {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature(feature: string): boolean };
    featurePolicy?: { allowsFeature(feature: string): boolean };
  };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  try {
    return policy ? !policy.allowsFeature("camera") : false;
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Front camera first, then any camera, then every camera by id — a virtual
 * camera or a docked webcam can be the busy default while another one works.
 * A permission refusal ends the chain at once: re-asking in a loop only earns
 * Chromium's "dismissed too often" auto-block.
 */
async function openCameraStream(): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  type Attempt = { ok: true; stream: MediaStream } | { ok: false; error: unknown };
  const attempt = async (constraints: MediaStreamConstraints): Promise<Attempt> => {
    try {
      return { ok: true, stream: await media.getUserMedia(constraints) };
    } catch (error) {
      if (isPermissionError(error)) throw error;
      return { ok: false, error };
    }
  };

  let result = await attempt({ video: { facingMode: { ideal: "user" } }, audio: false });
  if (result.ok) return result.stream;
  result = await attempt({ video: true, audio: false });
  if (result.ok) return result.stream;
  let lastError = result.error;

  const devices = await media.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
  for (const device of devices) {
    // deviceId is "" until the site has been granted the camera once.
    if (device.kind !== "videoinput" || !device.deviceId) continue;
    result = await attempt({ video: { deviceId: { exact: device.deviceId } }, audio: false });
    if (result.ok) return result.stream;
    lastError = result.error;
  }

  // Windows and macOS hand the camera back a moment after another app or tab lets go.
  if (isBusyError(lastError)) {
    await wait(800);
    result = await attempt({ video: true, audio: false });
    if (result.ok) return result.stream;
    lastError = result.error;
  }
  throw lastError;
}

/**
 * Front-camera selfie capture for attendance clock-in/out, on desktop webcams
 * and phone front cameras alike. Every failure has its own message, "Try
 * again" re-asks for the camera inside the click itself, a permission granted
 * later in the browser's settings restarts the camera on its own, and a plain
 * `<input type="file">` (native camera on mobile) is always the last resort.
 */
export function SelfieCapture({ onConfirm, disabled }: SelfieCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0);
  const permissionRef = useRef<PermissionStatus | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailure, setCameraFailure] = useState<CameraFailure | null>(null);
  // The site permission says "granted" yet the camera still refused: the OS
  // (macOS / Windows privacy settings) is blocking the browser itself.
  const [osBlocked, setOsBlocked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopPermissionWatch = useCallback(() => {
    if (permissionRef.current) permissionRef.current.onchange = null;
    permissionRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current;
    const fail = (failure: CameraFailure) => {
      if (!stale()) setCameraFailure(failure);
    };

    stopStream();
    stopPermissionWatch();
    setCameraFailure(null);
    setCameraReady(false);
    setOsBlocked(false);

    const isSecureContext =
      window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!isSecureContext) return fail("insecure");
    if (!navigator.mediaDevices?.getUserMedia) return fail("unsupported");
    if (cameraBlockedByPolicy()) return fail("policy");

    try {
      const stream = await openCameraStream();
      if (stale()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Autoplay can be refused; the stream still plays once the user taps.
        await video.play().catch(() => {});
      }
      if (stale()) return;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (stale() || streamRef.current !== stream) return;
        streamRef.current = null;
        setCameraReady(false);
        setCameraFailure("busy");
      });
      setCameraReady(true);
    } catch (error) {
      if (stale()) return;
      if (isPermissionError(error)) {
        try {
          const permission = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          if (stale()) return;
          setOsBlocked(permission.state === "granted");
          permissionRef.current = permission;
          // Fires when the user flips the site setting to Allow (or back to
          // Ask): restart without waiting for them to find "Try again".
          permission.onchange = () => {
            if (permission.state !== "denied") void startCamera();
          };
        } catch {
          // Firefox has no "camera" permission name; the guide still applies.
        }
        return fail("denied");
      }
      const name = errorName(error);
      if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
        return fail("not-found");
      }
      if (isBusyError(error)) return fail("busy");
      return fail("other");
    }
  }, [stopStream, stopPermissionWatch]);

  useEffect(() => {
    if (previewUrl) return;
    void startCamera();
    return () => {
      attemptRef.current++;
      stopPermissionWatch();
      stopStream();
    };
  }, [previewUrl, startCamera, stopPermissionWatch, stopStream]);

  // A camera freed by another app, or allowed in the OS settings, is noticed
  // when the user comes back to this window. Never on a plain refusal: an
  // unprompted re-ask on every focus would get the site auto-blocked.
  const retryOnReturn = cameraFailure === "busy" || (cameraFailure === "denied" && osBlocked);
  useEffect(() => {
    if (!retryOnReturn || previewUrl) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") void startCamera();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [retryOnReturn, previewUrl, startCamera]);

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
  };

  const handleConfirm = () => {
    if (!previewBlob) return;
    onConfirm(new File([previewBlob], "selfie.jpg", { type: "image/jpeg" }));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopStream();
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const failureMessage = (() => {
    switch (cameraFailure) {
      case "denied":
        return t("clockInOut.cameraPermissionDenied");
      case "policy":
        return t("clockInOut.cameraPolicyBlocked");
      case "busy":
        return t("clockInOut.cameraBusy");
      case "not-found":
        return t("clockInOut.cameraNotFound");
      case "insecure":
        return t("clockInOut.cameraInsecureContext");
      default:
        return t("clockInOut.cameraUnavailable");
    }
  })();

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(ua);
  // iPads on iOS 13+ report as "MacIntel" in navigator.platform but have touchend
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" &&
      /Mac/i.test(navigator.platform ?? "") &&
      typeof document !== "undefined" &&
      "ontouchend" in document);
  const isMobile = isAndroid || isIOS;
  const isMac = !isIOS && typeof navigator !== "undefined" && /Mac/i.test(navigator.platform ?? "");
  const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform ?? "");

  const canRetryCamera =
    cameraFailure !== null && !["insecure", "unsupported", "policy"].includes(cameraFailure);
  const waitingForCamera = !previewUrl && !cameraFailure && !cameraReady;

  return (
    <div className="flex min-h-0 flex-col items-center gap-3">
      <div className="bg-muted relative aspect-square w-full max-w-[280px] overflow-hidden rounded-xl">
        {/* Always mounted, so a stream that arrives after a retry has somewhere to play. */}
        <video
          ref={videoRef}
          className={cn("h-full w-full object-cover", (previewUrl || cameraFailure) && "hidden")}
          playsInline
          muted
          autoPlay
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : cameraFailure ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Camera className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-xs">{failureMessage}</p>
            {cameraFailure === "denied" && (
              <div className="mt-1 w-full rounded-lg bg-black/20 p-2.5 text-left">
                <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
                  {t("clockInOut.cameraGuideTitle")}
                </p>
                <ol className="text-muted-foreground/80 list-decimal space-y-1 pl-3.5 text-[10px] leading-tight">
                  {/* Step 1: unlock the browser site permission — skip when the
                      browser already reports "granted" (OS is blocking instead) */}
                  {!osBlocked && <li>{t("clockInOut.cameraGuideBrowser")}</li>}
                  <li className={osBlocked ? "font-semibold text-amber-400/80" : ""}>
                    {isAndroid
                      ? t("clockInOut.cameraGuideAndroid")
                      : isIOS
                        ? t("clockInOut.cameraGuideIOS")
                        : isMac
                          ? t("clockInOut.cameraGuideMac")
                          : isWindows
                            ? t("clockInOut.cameraGuideWindows")
                            : `${t("clockInOut.cameraGuideMac")} / ${t("clockInOut.cameraGuideWindows")}`}
                  </li>
                </ol>
              </div>
            )}
            {canRetryCamera && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                // Called inside the click, like a "Test my cam" button: the
                // browser ties the new prompt to this tap.
                onClick={() => void startCamera()}
                disabled={disabled}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("clockInOut.retryCamera")}
              </Button>
            )}
          </div>
        ) : waitingForCamera ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-xs">{t("clockInOut.cameraWaiting")}</p>
          </div>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {/* `capture` is set dynamically at click-time: "user" on mobile so
          pressing the fallback button opens the native camera directly
          (bypassing any browser site-level block); removed on desktop so the
          normal file picker opens instead. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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
          onClick={() => {
            const input = fileInputRef.current;
            if (!input) return;
            // On Android/iOS, `capture="user"` opens the native camera directly,
            // bypassing any browser site-level permission block entirely.
            // On desktop, omit it so the normal file picker opens instead.
            if (isMobile) {
              input.setAttribute("capture", "user");
            } else {
              input.removeAttribute("capture");
            }
            input.click();
          }}
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
