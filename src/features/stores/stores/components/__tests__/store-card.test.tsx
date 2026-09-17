import { describe, it, expect, vi } from "vitest";
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
  id: "store-1",
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
  it("renders the POS shortcut at POS tier or above, linking to that store's /pos", () => {
    render(<StoreCard store={store} isBlocked={false} currentPlan="POS" />);
    const posLink = screen.getByRole("link", { name: /nav\.pos/i });
    expect(posLink.getAttribute("href")).toBe("/store/store-1/pos");
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
