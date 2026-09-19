import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const updateGoogleReview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ storefrontApi: { updateGoogleReview } }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// The real dialog draws a <canvas> — irrelevant here, only what it is given.
vi.mock("@/components/shared/qr-code-dialog", () => ({
  QrCodeDialog: ({ open, value }: { open: boolean; value: string }) =>
    open ? <div data-testid="qr-dialog">{value}</div> : null,
}));

import { ApiClientError } from "@/lib/api/client";
import { StorefrontReviews, type StorefrontReviewsData } from "../storefront-reviews";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;

const disconnected: StorefrontReviewsData = {
  displayName: "Warung Budi",
  isPublished: true,
  googleMapsUrl: null,
  googlePlaceId: null,
  googleReviewUrl: null,
  googleReviewEnabled: true,
};
const connected: StorefrontReviewsData = {
  ...disconnected,
  googlePlaceId: PLACE_ID,
  googleReviewUrl: REVIEW_URL,
};

function renderReviews(storefront: StorefrontReviewsData = disconnected) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <StorefrontReviews storeId="store-1" storefront={storefront} onSaved={onSaved} />
    </QueryClientProvider>
  );
  return { onSaved };
}

const linkInput = () => screen.getByLabelText("storefront.reviews.linkLabel");
const connectButton = () => screen.getByRole("button", { name: "storefront.reviews.connect" });
const paste = (value: string) => {
  fireEvent.change(linkInput(), { target: { value } });
  fireEvent.click(connectButton());
};

beforeEach(() => {
  vi.clearAllMocks();
  updateGoogleReview.mockResolvedValue({});
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("StorefrontReviews — not connected", () => {
  it("shows the connect form and the how-to, with no Connected badge", () => {
    renderReviews();
    expect(linkInput()).toBeInTheDocument();
    expect(screen.getByText("storefront.reviews.howTitle")).toBeInTheDocument();
    expect(screen.queryByText("storefront.reviews.connected")).toBeNull();
    expect(screen.queryByText("storefront.reviews.appearsTitle")).toBeNull();
  });

  it("rejects plain text on the client, without calling the API", async () => {
    renderReviews();
    paste("my restaurant");
    expect(await screen.findByText("storefront.reviews.errors.invalid")).toBeInTheDocument();
    expect(updateGoogleReview).not.toHaveBeenCalled();
  });

  it("explains a Maps listing link instead of accepting it as a review link", async () => {
    renderReviews();
    paste("https://maps.app.goo.gl/AbCdEf123");
    expect(await screen.findByText("storefront.reviews.errors.mapsListing")).toBeInTheDocument();
    expect(updateGoogleReview).not.toHaveBeenCalled();
  });

  it("asks for something when the field is empty", async () => {
    renderReviews();
    fireEvent.click(connectButton());
    expect(await screen.findByText("storefront.reviews.errors.empty")).toBeInTheDocument();
    expect(updateGoogleReview).not.toHaveBeenCalled();
  });

  it("clears the error as soon as the merchant edits the field", async () => {
    renderReviews();
    paste("nonsense");
    await screen.findByText("storefront.reviews.errors.invalid");
    fireEvent.change(linkInput(), { target: { value: "nonsens" } });
    expect(screen.queryByText("storefront.reviews.errors.invalid")).toBeNull();
  });

  it("sends the raw paste to the server (which re-validates) and refreshes", async () => {
    const { onSaved } = renderReviews();
    paste(PLACE_ID);
    await waitFor(() =>
      expect(updateGoogleReview).toHaveBeenCalledWith("store-1", { link: PLACE_ID })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("storefront.reviews.toast.connected");
  });

  it("shows the server's verdict when it disagrees with the client", async () => {
    updateGoogleReview.mockRejectedValueOnce(
      new ApiClientError(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "no", details: { reason: "mapsListing" } },
          meta: { timestamp: "2026-09-19T00:00:00.000Z" },
        } as never,
        400
      )
    );
    renderReviews();
    paste(PLACE_ID);
    expect(await screen.findByText("storefront.reviews.errors.mapsListing")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts an unexpected failure rather than blaming the link", async () => {
    updateGoogleReview.mockRejectedValueOnce(new Error("network down"));
    renderReviews();
    paste(PLACE_ID);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("storefront.reviews.toast.saveFailed")
    );
    expect(screen.queryByText("storefront.reviews.errors.invalid")).toBeNull();
  });
});

describe("StorefrontReviews — connected", () => {
  it("shows the stored review link and the Connected badge instead of the form", () => {
    renderReviews(connected);
    expect(screen.getByDisplayValue(REVIEW_URL)).toBeInTheDocument();
    expect(screen.getByText("storefront.reviews.connected")).toBeInTheDocument();
    expect(screen.queryByLabelText("storefront.reviews.linkLabel")).toBeNull();
  });

  it("test link opens the review form in a new tab, safely", () => {
    renderReviews(connected);
    const link = screen.getByRole("link", { name: /storefront\.reviews\.testLink/ });
    expect(link).toHaveAttribute("href", REVIEW_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("builds the review link from the Place ID when only that is stored", () => {
    renderReviews({ ...connected, googleReviewUrl: null });
    expect(screen.getByDisplayValue(REVIEW_URL)).toBeInTheDocument();
  });

  it("opens the QR code for the review link", () => {
    renderReviews(connected);
    expect(screen.queryByTestId("qr-dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /storefront\.reviews\.showQr/ }));
    expect(screen.getByTestId("qr-dialog")).toHaveTextContent(REVIEW_URL);
  });

  it("lets the merchant change the link, and cancel", () => {
    renderReviews(connected);
    fireEvent.click(screen.getByRole("button", { name: "storefront.reviews.change" }));
    expect(linkInput()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));
    expect(screen.queryByLabelText("storefront.reviews.linkLabel")).toBeNull();
    expect(screen.getByDisplayValue(REVIEW_URL)).toBeInTheDocument();
  });

  it("pauses the prompts without disconnecting", async () => {
    renderReviews(connected);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(updateGoogleReview).toHaveBeenCalledWith("store-1", { enabled: false })
    );
    expect(toast.success).toHaveBeenCalledWith("storefront.reviews.toast.promptsOff");
  });

  it("a paused store still reads as connected, with the switch off", () => {
    renderReviews({ ...connected, googleReviewEnabled: false });
    expect(screen.getByDisplayValue(REVIEW_URL)).toBeInTheDocument();
    expect(screen.getByText("storefront.reviews.connected")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("disconnects only after confirming", async () => {
    renderReviews(connected);
    fireEvent.click(screen.getByRole("button", { name: /storefront\.reviews\.disconnect$/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(updateGoogleReview).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "storefront.reviews.disconnect" }));
    await waitFor(() => expect(updateGoogleReview).toHaveBeenCalledWith("store-1", { link: "" }));
    expect(toast.success).toHaveBeenCalledWith("storefront.reviews.toast.disconnected");
  });

  it("leaves everything alone when the confirmation is cancelled", async () => {
    renderReviews(connected);
    fireEvent.click(screen.getByRole("button", { name: /storefront\.reviews\.disconnect$/ }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(updateGoogleReview).not.toHaveBeenCalled();
  });
});

describe("StorefrontReviews — the Maps link note", () => {
  it("says it was added automatically when derived from the Place ID", () => {
    renderReviews(connected);
    expect(screen.getByText("storefront.reviews.mapsLinkAuto")).toBeInTheDocument();
  });

  it("says a hand-entered Maps URL is being used, when there is one", () => {
    renderReviews({ ...connected, googleMapsUrl: "https://maps.app.goo.gl/manual" });
    expect(screen.getByText("storefront.reviews.mapsLinkManual")).toBeInTheDocument();
  });

  it("explains the gap for a g.page link, which carries no map location", () => {
    renderReviews({
      ...disconnected,
      googleReviewUrl: "https://g.page/r/Cabc/review",
    });
    expect(screen.getByText("storefront.reviews.mapsLinkNone")).toBeInTheDocument();
  });
});

describe("StorefrontReviews — unpublished store", () => {
  it("warns that customers can't see it yet", () => {
    renderReviews({ ...connected, isPublished: false });
    expect(screen.getByText("storefront.reviews.unpublishedNote")).toBeInTheDocument();
  });

  it("stays quiet for a published store", () => {
    renderReviews(connected);
    expect(screen.queryByText("storefront.reviews.unpublishedNote")).toBeNull();
  });
});
