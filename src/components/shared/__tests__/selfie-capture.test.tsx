import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

import { SelfieCapture } from "../selfie-capture";

const domError = (name: string) => Object.assign(new Error(name), { name });

function fakeStream() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
}

const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();
const query = vi.fn();
const permission: { state: PermissionState; onchange: null | (() => void) } = {
  state: "prompt",
  onchange: null,
};

const takePhoto = () => screen.getByRole("button", { name: "clockInOut.takePhoto" });
const retry = () => screen.findByRole("button", { name: "clockInOut.retryCamera" });

function defineOn(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, value });
}

// Braces matter: a beforeEach that RETURNS a function is treated as its cleanup.
beforeEach(() => {
  getUserMedia.mockReset();
  enumerateDevices.mockReset();
  enumerateDevices.mockResolvedValue([]);
  permission.state = "prompt";
  permission.onchange = null;
  query.mockReset();
  query.mockResolvedValue(permission);
  defineOn(navigator, "mediaDevices", { getUserMedia, enumerateDevices });
  defineOn(navigator, "permissions", { query });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (document as { permissionsPolicy?: unknown }).permissionsPolicy;
  delete (document as { visibilityState?: unknown }).visibilityState;
});

describe("SelfieCapture — opening the camera", () => {
  it("asks for the front camera, shows a waiting state, then enables Take Photo", async () => {
    getUserMedia.mockResolvedValue(fakeStream());
    render(<SelfieCapture onConfirm={vi.fn()} />);

    expect(screen.getByText("clockInOut.cameraWaiting")).toBeInTheDocument();
    expect(takePhoto()).toBeDisabled();
    await waitFor(() => expect(takePhoto()).toBeEnabled());
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "user" } },
      audio: false,
    });
    expect(screen.queryByText("clockInOut.cameraWaiting")).toBeNull();
  });

  it("a webcam that can't honour facingMode falls back to any camera", async () => {
    getUserMedia
      .mockRejectedValueOnce(domError("OverconstrainedError"))
      .mockResolvedValueOnce(fakeStream());
    render(<SelfieCapture onConfirm={vi.fn()} />);

    await waitFor(() => expect(takePhoto()).toBeEnabled());
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true, audio: false });
  });

  it("a busy default camera: tries every camera by id until one opens", async () => {
    getUserMedia
      .mockRejectedValueOnce(domError("NotReadableError"))
      .mockRejectedValueOnce(domError("NotReadableError"))
      .mockRejectedValueOnce(domError("NotReadableError"))
      .mockResolvedValueOnce(fakeStream());
    enumerateDevices.mockResolvedValue([
      { kind: "audioinput", deviceId: "mic" },
      { kind: "videoinput", deviceId: "cam-a" },
      { kind: "videoinput", deviceId: "cam-b" },
    ]);
    render(<SelfieCapture onConfirm={vi.fn()} />);

    await waitFor(() => expect(takePhoto()).toBeEnabled());
    expect(getUserMedia).toHaveBeenNthCalledWith(3, {
      video: { deviceId: { exact: "cam-a" } },
      audio: false,
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(4, {
      video: { deviceId: { exact: "cam-b" } },
      audio: false,
    });
  });
});

describe("SelfieCapture — a refused camera", () => {
  it("shows the guide, and every Try again asks the browser again inside the click", async () => {
    getUserMedia.mockRejectedValue(domError("NotAllowedError"));
    permission.state = "denied";
    render(<SelfieCapture onConfirm={vi.fn()} />);

    expect(await screen.findByText("clockInOut.cameraPermissionDenied")).toBeInTheDocument();
    expect(screen.getByText("clockInOut.cameraGuideBrowser")).toBeInTheDocument();
    // A refusal never loops through the fallback chain.
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    for (const expectedCalls of [2, 3]) {
      fireEvent.click(await retry());
      // Synchronously, during the tap — not one render later from an effect.
      expect(getUserMedia).toHaveBeenCalledTimes(expectedCalls);
      expect(await screen.findByText("clockInOut.cameraPermissionDenied")).toBeInTheDocument();
    }

    getUserMedia.mockResolvedValue(fakeStream());
    fireEvent.click(await retry());
    await waitFor(() => expect(takePhoto()).toBeEnabled());
  });

  it("restarts by itself once the user allows the camera in the browser's site settings", async () => {
    getUserMedia.mockRejectedValueOnce(domError("NotAllowedError")).mockResolvedValueOnce(fakeStream());
    permission.state = "denied";
    render(<SelfieCapture onConfirm={vi.fn()} />);

    await screen.findByText("clockInOut.cameraPermissionDenied");
    expect(permission.onchange).toBeTypeOf("function");
    permission.state = "granted";
    act(() => permission.onchange?.());

    await waitFor(() => expect(takePhoto()).toBeEnabled());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("site allowed but still refused: points at the OS settings, not the address bar", async () => {
    getUserMedia.mockRejectedValue(domError("NotAllowedError"));
    permission.state = "granted";
    // Not "MacIntel": jsdom has touch events, so a Mac platform reads as an iPad.
    defineOn(navigator, "platform", "Win32");
    render(<SelfieCapture onConfirm={vi.fn()} />);

    expect(await screen.findByText("clockInOut.cameraGuideWindows")).toBeInTheDocument();
    expect(screen.queryByText("clockInOut.cameraGuideBrowser")).toBeNull();
    delete (navigator as { platform?: unknown }).platform;
  });

  it("a page whose Permissions-Policy disables the camera says so and offers only the photo fallback", async () => {
    defineOn(document, "permissionsPolicy", {
      allowsFeature: (feature: string) => feature !== "camera",
    });
    render(<SelfieCapture onConfirm={vi.fn()} />);

    expect(await screen.findByText("clockInOut.cameraPolicyBlocked")).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "clockInOut.retryCamera" })).toBeNull();
    expect(takePhoto()).toBeEnabled();
  });
});

describe("SelfieCapture — a camera held by another app", () => {
  it("says it is busy, then retries on its own when the user comes back to the window", async () => {
    getUserMedia.mockRejectedValue(domError("NotReadableError"));
    defineOn(document, "visibilityState", "visible");
    render(<SelfieCapture onConfirm={vi.fn()} />);

    expect(
      await screen.findByText("clockInOut.cameraBusy", undefined, { timeout: 3000 })
    ).toBeInTheDocument();

    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue(fakeStream());
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(takePhoto()).toBeEnabled());
  });
});
