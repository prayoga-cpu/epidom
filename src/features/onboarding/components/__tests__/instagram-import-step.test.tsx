import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { renderIn } from "@/features/stores/shared/__tests__/helpers";
import { InstagramImportStep } from "../instagram-import-step";

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

vi.mock("@/lib/utils/image-compression", () => ({
  compressImage: vi.fn(async (file: File) => file),
  createImagePreview: vi.fn(() => "blob:screenshot"),
  isValidImage: vi.fn(() => true),
  isValidImageSize: vi.fn(() => true),
  revokeImagePreview: vi.fn(),
}));

vi.mock("@/components/shared/avatar-cropper", () => ({
  AvatarCropper: ({
    onCropComplete,
    onCancel,
  }: {
    onCropComplete: (url: string) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onCropComplete("blob:cropped")}>
        mock-crop
      </button>
      <button type="button" onClick={onCancel}>
        mock-crop-cancel
      </button>
    </div>
  ),
}));

const SCREENSHOT_URL = "https://abc.public.blob.vercel-storage.com/shot.png";
const LOGO_URL = "https://abc.public.blob.vercel-storage.com/logo.png";

const analysis = {
  isInstagramProfile: true,
  confidence: 0.9,
  username: "@sunset.cafe",
  businessName: "Sunset Café",
  bio: "Coffee & cake\nOpen daily",
  category: "Cafe",
  externalLinks: [],
  whatsappNumber: "+62 812 3456 7890",
  suggestedThemeHex: "#123456",
};

let analyzeReply: { status: number; body: unknown };
let uploads: number;

beforeEach(() => {
  uploads = 0;
  analyzeReply = { status: 200, body: { success: true, data: analysis } };
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "blob:cropped") {
      return { ok: true, status: 200, blob: async () => new Blob(["x"], { type: "image/png" }) };
    }
    if (url === "/api/upload") {
      uploads += 1;
      const uploaded = uploads === 1 ? SCREENSHOT_URL : LOGO_URL;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { url: uploaded } }),
      };
    }
    if (url === "/api/onboarding/analyze-profile") {
      return {
        ok: analyzeReply.status < 300,
        status: analyzeReply.status,
        json: async () => analyzeReply.body,
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as never;
});

function renderStep(locale: Locale = "en") {
  const onComplete = vi.fn();
  const onCancel = vi.fn();
  const view = renderIn(
    locale,
    <InstagramImportStep onComplete={onComplete} onCancel={onCancel} />
  );
  const pick = () => {
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "shot.png", { type: "image/png" })] },
    });
  };
  return { onComplete, onCancel, pick };
}

describe("<InstagramImportStep>", () => {
  it("reads a screenshot, shows what it found, and hands it back without a logo", async () => {
    const { onComplete, pick } = renderStep();
    pick();
    expect(await screen.findByText("Here's what we found")).toBeInTheDocument();
    expect(screen.getByText("Sunset Café")).toBeInTheDocument();
    expect(screen.getByText("@sunset.cafe")).toBeInTheDocument();
    expect(screen.getByText("epidom.fr/@sunset-cafe")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Looks right/ }));
    expect(screen.getByText("Crop your logo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip the logo for now" }));

    expect(onComplete).toHaveBeenCalledWith({
      name: "Sunset Café",
      tagline: "Coffee & cake",
      slugCandidate: "sunset-cafe",
      instagramUrl: "https://instagram.com/sunset.cafe",
      whatsappNumber: "+62 812 3456 7890",
      themeColor: "#123456",
      logoUrl: null,
      bio: "Coffee & cake\nOpen daily",
      category: "Cafe",
    });
    const [, analyzeInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => url === "/api/onboarding/analyze-profile"
    ) as [string, RequestInit];
    expect(JSON.parse(String(analyzeInit.body))).toEqual({ imageUrl: SCREENSHOT_URL });
  });

  it("uploads the cropped profile picture as the logo", async () => {
    const { onComplete, pick } = renderStep();
    pick();
    fireEvent.click(await screen.findByRole("button", { name: /Looks right/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock-crop" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0]).toMatchObject({ logoUrl: LOGO_URL });
  });

  it("refuses a screenshot that isn't an Instagram profile", async () => {
    analyzeReply = {
      status: 200,
      body: { success: true, data: { ...analysis, isInstagramProfile: false } },
    };
    const { onComplete, pick } = renderStep("fr");
    pick();
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith(
        "Cette image ne ressemble pas à une capture de profil Instagram. Réessayez avec une capture de votre page de profil."
      )
    );
    expect(
      screen.getByRole("button", { name: /Importer une capture d'écran/ })
    ).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("says so when the screenshot can't be read", async () => {
    analyzeReply = { status: 500, body: { success: false, error: { code: "X", message: "boom" } } };
    const { pick } = renderStep();
    pick();
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith(
        "We couldn't read that screenshot. Try again, or fill in the form yourself."
      )
    );
  });

  it("Cancel closes without using anything", () => {
    const { onCancel, onComplete } = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
