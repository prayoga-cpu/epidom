import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/dashboard/profile/hooks/use-default-landing", () => ({
  useDefaultLanding: () => "dashboard",
}));
vi.mock("../edit-store-dialog", () => ({
  EditStoreDialog: () => null,
}));
vi.mock("../delete-store-dialog", () => ({
  DeleteStoreDialog: () => null,
}));

import { StoreCard } from "../store-card";

const store = {
  id: "store-001",
  businessId: "biz-1",
  name: "Test Store",
  address: null,
  city: "Paris",
  country: "FR",
  phone: null,
  email: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("StoreCard — switch-to-POS shortcut", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the POS shortcut at POS tier or above, linking to that store's /pos", () => {
    render(<StoreCard store={store} isBlocked={false} currentPlan="POS" />);
    const posLink = screen.getByRole("link", { name: /nav\.pos/i });
    expect(posLink.getAttribute("href")).toBe("/store/store-001/pos");
  });

  it("resumes the last POS screen visited in this store instead of the bare till", async () => {
    localStorage.setItem("epidom:lastVisitedPos", "/store/store-001/pos/orders");
    render(<StoreCard store={store} isBlocked={false} currentPlan="POS" />);
    const posLink = await screen.findByRole("link", { name: /nav\.pos/i });
    expect(posLink.getAttribute("href")).toBe("/store/store-001/pos/orders");
  });

  it("ignores a last-visited POS path saved for a different store", async () => {
    localStorage.setItem("epidom:lastVisitedPos", "/store/some-other-store/pos/kds");
    render(<StoreCard store={store} isBlocked={false} currentPlan="POS" />);
    const posLink = await screen.findByRole("link", { name: /nav\.pos/i });
    expect(posLink.getAttribute("href")).toBe("/store/store-001/pos");
  });

  it("does not render below POS tier (FREE)", () => {
    render(<StoreCard store={store} isBlocked={false} currentPlan="FREE" />);
    expect(screen.queryByRole("link", { name: /nav\.pos/i })).toBeNull();
  });

  it("does not render when the store is blocked, even at POS tier or above", () => {
    render(<StoreCard store={store} isBlocked={true} currentPlan="ENTERPRISE" />);
    expect(screen.queryByRole("link", { name: /nav\.pos/i })).toBeNull();
  });

  it("defaults to hidden when currentPlan isn't passed at all", () => {
    render(<StoreCard store={store} isBlocked={false} />);
    expect(screen.queryByRole("link", { name: /nav\.pos/i })).toBeNull();
  });
});
