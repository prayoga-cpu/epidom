import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/storefront/components/storefront-controls", () => ({
  StorefrontControls: () => null,
}));

// Only used by the reservation modal, but it imports a stylesheet that
// vitest's PostCSS pipeline can't process.
vi.mock("@/components/ui/phone-input", () => ({ PhoneInput: () => null }));

const track = vi.hoisted(() => ({ trackEvent: vi.fn(), useTrackPageView: vi.fn() }));
vi.mock("@/features/storefront/hooks/use-track-storefront-event", () => track);

import { OrderStatusClient } from "../order-status-client";
import { PublicProfile } from "../public-profile";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4";
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Warung&query_place_id=ChIJabc";

type OrderProps = React.ComponentProps<typeof OrderStatusClient>;
type ProfileProps = React.ComponentProps<typeof PublicProfile>;

const order: OrderProps["order"] = {
  id: "order-1",
  orderNumber: "A-001",
  status: "DELIVERED",
  paymentStatus: "PAID",
  paymentMethod: "CASH",
  customerName: "Sari",
  orderType: "DINE_IN",
  tableNumber: null,
  notes: null,
  total: 50000,
  currency: "IDR",
  createdAt: "2026-09-19T00:00:00.000Z",
  items: [],
};

function renderOrder(
  status: OrderProps["order"]["status"],
  googleReviewUrl: string | null | undefined
) {
  return render(
    <OrderStatusClient
      storefront={{
        slug: "warung",
        displayName: "Warung Budi",
        themeColor: "#FF6B35",
        whatsappNumber: null,
        googleReviewUrl,
      }}
      order={{ ...order, status }}
    />
  );
}

const profile: ProfileProps["storefront"] = {
  id: "sf-1",
  slug: "warung",
  displayName: "Warung Budi",
  tagline: null,
  description: null,
  logoUrl: null,
  heroImageUrl: null,
  themeColor: "#FF6B35",
  fontFamily: "Inter",
  whatsappNumber: null,
  instagramUrl: null,
  tiktokUrl: null,
  gofoodUrl: null,
  grabfoodUrl: null,
  shopeefoodUrl: null,
  googleMapsUrl: null,
  googleReviewUrl: null,
  customLinks: null,
  openingHours: null,
  acceptsOrders: false,
  acceptsReservations: false,
  reservableTables: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Non-terminal orders poll every 2s — keep that inert.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});

// ── Order status page ────────────────────────────────────────────────────────

describe("OrderStatusClient — Google review prompt", () => {
  it("asks a delivered order's customer for a review, linking to Google's form", () => {
    renderOrder("DELIVERED", REVIEW_URL);

    expect(screen.getByText("publicOrder.orderStatus.reviewTitle")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /publicOrder\.orderStatus\.reviewCta/ });
    expect(link).toHaveAttribute("href", REVIEW_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("records a REVIEW_CLICK against the storefront when tapped", () => {
    renderOrder("DELIVERED", REVIEW_URL);
    fireEvent.click(screen.getByRole("link", { name: /publicOrder\.orderStatus\.reviewCta/ }));
    expect(track.trackEvent).toHaveBeenCalledWith("warung", "REVIEW_CLICK");
  });

  it.each([null, undefined])("shows nothing when there is no review link (%s)", (url) => {
    renderOrder("DELIVERED", url);
    expect(screen.queryByText("publicOrder.orderStatus.reviewTitle")).toBeNull();
  });

  it.each(["CONFIRMED", "IN_PRODUCTION", "READY", "CANCELLED", "HELD"] as const)(
    "does not ask while the order is %s — only once it is in the customer's hands",
    (status) => {
      renderOrder(status, REVIEW_URL);
      expect(screen.queryByText("publicOrder.orderStatus.reviewTitle")).toBeNull();
    }
  );
});

// ── Public profile ───────────────────────────────────────────────────────────

describe("PublicProfile — Google links", () => {
  it("offers the review button (mobile and desktop groups) when a review link is resolved", () => {
    render(<PublicProfile storefront={{ ...profile, googleReviewUrl: REVIEW_URL }} />);

    const links = screen.getAllByRole("link", { name: /publicProfile\.reviewCta/ });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", REVIEW_URL);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("records a REVIEW_CLICK when the review button is tapped", () => {
    render(<PublicProfile storefront={{ ...profile, googleReviewUrl: REVIEW_URL }} />);
    fireEvent.click(screen.getAllByRole("link", { name: /publicProfile\.reviewCta/ })[0]);
    expect(track.trackEvent).toHaveBeenCalledWith("warung", "REVIEW_CLICK");
  });

  it("hides the review button when there is no resolved review link (unconnected or paused)", () => {
    render(<PublicProfile storefront={profile} />);
    expect(screen.queryByText("publicProfile.reviewCta")).toBeNull();
  });

  it("links the Google Maps icon to whatever Maps URL the page resolved", () => {
    render(<PublicProfile storefront={{ ...profile, googleMapsUrl: MAPS_URL }} />);
    expect(screen.getByTitle("Google Maps")).toHaveAttribute("href", MAPS_URL);
  });

  it("shows no Maps icon when the store has no Maps link at all", () => {
    render(<PublicProfile storefront={profile} />);
    expect(screen.queryByTitle("Google Maps")).toBeNull();
  });

  it("can show the Maps link while the review button is paused — they are independent", () => {
    render(
      <PublicProfile storefront={{ ...profile, googleMapsUrl: MAPS_URL, googleReviewUrl: null }} />
    );
    expect(screen.getByTitle("Google Maps")).toBeInTheDocument();
    expect(screen.queryByText("publicProfile.reviewCta")).toBeNull();
  });
});
