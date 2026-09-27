import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Locale } from "@/components/lang/i18n-provider";
import { RENDER_TEST_TIMEOUT, renderIn } from "@/features/stores/shared/__tests__/helpers";

vi.mock("../../hooks/use-profile", () => ({
  useUpdateBusiness: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/phone-input", () => ({ PhoneInput: () => null }));

import { BusinessInfoCard } from "../business-info-card";

const business = {
  id: "b1",
  name: "Warung Senja",
  address: null,
  city: "Denpasar",
  country: "Indonesia",
  phone: null,
  email: null,
  website: null,
};

function renderCard(locale: Locale, value: Parameters<typeof BusinessInfoCard>[0]["business"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderIn(
    locale,
    <QueryClientProvider client={client}>
      <BusinessInfoCard business={value} userId="u1" />
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<BusinessInfoCard>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("fetches and shows the business timezone when the profile doesn't carry it", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { id: "b1", timezone: "Asia/Makassar" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderCard("en", business);

    expect(screen.getByText("Business time zone")).toBeInTheDocument();
    expect(await screen.findByText("Asia/Makassar (UTC+08:00)")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/user/business");
  });

  it("uses the profile's timezone when present, without fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCard("en", { ...business, timezone: "Asia/Jakarta" });

    expect(screen.getByText("Asia/Jakarta (UTC+07:00)")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a recognised country in the UI language, and other text as saved", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { unmount } = renderCard("fr", { ...business, timezone: "Asia/Makassar" });
    expect(screen.getByText("Indonésie")).toBeInTheDocument();
    unmount();

    renderCard("en", { ...business, country: "Bali", timezone: "Asia/Makassar" });
    expect(screen.getByText("Bali")).toBeInTheDocument();
  });
});
