import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

// The real uploader compresses and posts to /api/upload; what matters here is what
// the panel does with the URL it hands back.
const UPLOADED = "https://abc123.public.blob.vercel-storage.com/schedule/new.png";
vi.mock("@/components/shared/image-upload", () => ({
  ImageUpload: ({
    onChange,
    disabled,
  }: {
    onChange: (url: string | undefined) => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onChange(UPLOADED)}>
      stub-upload
    </button>
  ),
}));

import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { ScheduleImagePanel } from "../schedule-image-panel";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const del = vi.mocked(apiClient.delete);

const saved = {
  id: "climage000000000000000001",
  imageUrl: "https://abc123.public.blob.vercel-storage.com/schedule/old.png",
  startDate: "2026-09-14",
  endDate: "2026-09-20",
  note: "Week 38",
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ScheduleImagePanel storeId="s1" rangeFrom="2026-09-14" rangeTo="2026-09-20" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ images: [] });
  post.mockResolvedValue({});
  del.mockResolvedValue({});
});

describe("ScheduleImagePanel — nothing uploaded yet", () => {
  it("asks for the images overlapping the range on screen", async () => {
    renderPanel();
    await screen.findByText("stub-upload");
    expect(get).toHaveBeenCalledWith("/stores/s1/schedule-images", {
      from: "2026-09-14",
      to: "2026-09-20",
    });
  });

  it("uploading publishes the image for exactly the dates shown — no draft step", async () => {
    renderPanel();
    fireEvent.click(await screen.findByText("stub-upload"));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/stores/s1/schedule-images", {
        imageUrl: UPLOADED,
        startDate: "2026-09-14",
        endDate: "2026-09-20",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("pages.scheduleImagePublished");
  });

  it("a note typed before uploading travels with the image", async () => {
    renderPanel();
    fireEvent.change(await screen.findByLabelText("pages.scheduleImageNote"), {
      target: { value: "  Sam and Alex swapped  " },
    });
    fireEvent.click(screen.getByText("stub-upload"));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ note: "Sam and Alex swapped" });
  });

  it("a failed publish says so", async () => {
    post.mockRejectedValue(new Error("boom"));
    renderPanel();
    fireEvent.click(await screen.findByText("stub-upload"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("common.error"));
  });
});

describe("ScheduleImagePanel — an image is already published for these dates", () => {
  beforeEach(() => get.mockResolvedValue({ images: [saved] }));

  it("shows it uncropped, linked to the full-size file, with its saved note", async () => {
    renderPanel();
    const img = await screen.findByRole("img", { name: "pages.scheduleImageAlt" });

    expect(img).toHaveAttribute("src", saved.imageUrl);
    expect(img.className).toContain("object-contain");
    expect(img.closest("a")).toHaveAttribute("href", saved.imageUrl);
    expect(img.closest("a")).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("pages.scheduleImageNote")).toHaveValue("Week 38");
    // No uploader while there is an image to look at.
    expect(screen.queryByText("stub-upload")).toBeNull();
  });

  it("only edits the image for THESE dates — another range that merely overlaps is not shown", async () => {
    get.mockResolvedValue({
      images: [
        {
          ...saved,
          id: "climage000000000000000002",
          startDate: "2026-09-10",
          endDate: "2026-09-16",
        },
      ],
    });
    renderPanel();

    // Overlaps the window but isn't this range, so this range has no image yet.
    expect(await screen.findByText("stub-upload")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("Remove deletes it", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /pages\.scheduleImageRemove/ }));

    await waitFor(() =>
      expect(del).toHaveBeenCalledWith("/stores/s1/schedule-images/climage000000000000000001")
    );
    expect(toast.success).toHaveBeenCalledWith("pages.scheduleImageRemoved");
  });

  it("Replace brings the uploader back, and a new upload goes to the same dates", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "pages.scheduleImageReplace" }));
    fireEvent.click(await screen.findByText("stub-upload"));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/stores/s1/schedule-images",
        expect.objectContaining({
          imageUrl: UPLOADED,
          startDate: "2026-09-14",
          endDate: "2026-09-20",
        })
      )
    );
  });

  it("Cancel leaves the current image as it was", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "pages.scheduleImageReplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "common.actions.cancel" }));

    expect(await screen.findByRole("img")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("Save appears only once the note has changed, and re-publishes the SAME file with it", async () => {
    renderPanel();
    const input = await screen.findByLabelText("pages.scheduleImageNote");
    expect(screen.queryByRole("button", { name: "common.actions.save" })).toBeNull();

    fireEvent.change(input, { target: { value: "Updated Tuesday" } });
    fireEvent.click(screen.getByRole("button", { name: "common.actions.save" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/stores/s1/schedule-images", {
        imageUrl: saved.imageUrl,
        startDate: "2026-09-14",
        endDate: "2026-09-20",
        note: "Updated Tuesday",
      })
    );
  });
});

describe("ScheduleImagePanel — the saved image can't be read", () => {
  it("says so and offers a retry", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    renderPanel();

    expect(await screen.findByText("pages.scheduleImageLoadFailed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.retry" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  // The regression: a failed read used to replace the whole panel with an error, so
  // the manager could not upload at all — even though publishing is an upsert on
  // these exact dates and is right whether or not something is already saved.
  it("still offers the uploader, so an unreadable read is not a dead end", async () => {
    get.mockRejectedValue(new Error("server error"));
    renderPanel();

    expect(await screen.findByText("pages.scheduleImageLoadFailed")).toBeInTheDocument();
    expect(screen.getByText("stub-upload")).toBeInTheDocument();
    // …with the note field, as for a first upload. No Cancel: nothing to go back to.
    expect(screen.getByLabelText("pages.scheduleImageNote")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.actions.cancel" })).toBeNull();
  });

  it("an upload from that state publishes for the dates shown", async () => {
    get.mockRejectedValue(new Error("server error"));
    renderPanel();
    fireEvent.click(await screen.findByText("stub-upload"));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/stores/s1/schedule-images", {
        imageUrl: UPLOADED,
        startDate: "2026-09-14",
        endDate: "2026-09-20",
      })
    );
  });

  it("once a retry succeeds the saved image replaces the error", async () => {
    get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ images: [saved] });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "common.actions.retry" }));

    expect(await screen.findByRole("img", { name: "pages.scheduleImageAlt" })).toBeInTheDocument();
    expect(screen.queryByText("pages.scheduleImageLoadFailed")).toBeNull();
  });
});
