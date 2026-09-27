import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderIn } from "@/features/stores/shared/__tests__/helpers";
import { ImageUpload } from "../image-upload";

const h = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  deleteBlobImage: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

vi.mock("@/lib/utils/image-compression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/image-compression")>()),
  compressImage: vi.fn(async (file: File) => file),
  createImagePreview: vi.fn(() => "blob:preview"),
  revokeImagePreview: vi.fn(),
  deleteBlobImage: h.deleteBlobImage,
}));

const SAVED = "https://abc.public.blob.vercel-storage.com/users/u1/images/saved.png";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.deleteBlobImage.mockResolvedValue(undefined);
  fetchMock = vi.fn();
  global.fetch = fetchMock as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pick(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const png = (name = "logo.png") => new File(["x"], name, { type: "image/png" });

describe("<ImageUpload>", () => {
  it("with deletePrevious={false}, Remove clears the value but keeps the saved file", async () => {
    const onChange = vi.fn();
    renderIn("en", <ImageUpload value={SAVED} onChange={onChange} deletePrevious={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
    expect(h.deleteBlobImage).not.toHaveBeenCalled();
  });

  it("by default, Remove still deletes the file (every other caller)", async () => {
    const onChange = vi.fn();
    renderIn("en", <ImageUpload value={SAVED} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
    expect(h.deleteBlobImage).toHaveBeenCalledWith(SAVED);
  });

  it("the remove button is a 40px touch target", () => {
    renderIn("en", <ImageUpload value={SAVED} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove image" })).toHaveClass("size-10");
  });

  it("speaks the UI language (French)", () => {
    const { unmount } = renderIn("fr", <ImageUpload onChange={vi.fn()} compact />);
    expect(screen.getByRole("button", { name: "Ajouter une image" })).toHaveTextContent(
      "Cliquez ou glissez une image"
    );
    unmount();

    renderIn("fr", <ImageUpload value={SAVED} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Supprimer l'image" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aperçu de l'image" })).toBeInTheDocument();
  });

  it("uploads a picked file and reports the new URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { url: SAVED } }),
    });
    const onChange = vi.fn();
    const { container } = renderIn("en", <ImageUpload onChange={onChange} compact />);

    pick(container, png());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(SAVED));
    expect(fetchMock).toHaveBeenCalledWith("/api/upload", expect.objectContaining({ method: "POST" }));
    expect(h.deleteBlobImage).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a failed upload says so in the UI language, under the tile and as a toast", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: { message: "Storage down" } }),
    });
    const onChange = vi.fn();
    const { container } = renderIn("fr", <ImageUpload onChange={onChange} compact />);

    pick(container, png());

    const message = "Impossible d'envoyer l'image. Vérifiez votre connexion, puis réessayez.";
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(h.toastError).toHaveBeenCalledWith(message);
    expect(onChange).not.toHaveBeenCalled();
    expect(h.deleteBlobImage).not.toHaveBeenCalled();
  });

  it("refuses a file over the size limit with a visible reason, without uploading", async () => {
    const big = png("big.png");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    const { container } = renderIn("fr", <ImageUpload onChange={vi.fn()} compact />);

    pick(container, big);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "L'image doit faire moins de 5 Mo."
    );
    expect(h.toastError).toHaveBeenCalledWith("L'image doit faire moins de 5 Mo.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a file that isn't an image", async () => {
    const { container } = renderIn("en", <ImageUpload onChange={vi.fn()} compact />);
    pick(container, new File(["x"], "menu.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a JPEG, PNG, WebP or GIF image."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
