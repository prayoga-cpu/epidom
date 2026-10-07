import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    formatDateTime: (d: Date | string) => `at ${String(d)}`,
  }),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/store/s1/pos" }));

const exportMocks = vi.hoisted(() => ({ downloadJSON: vi.fn() }));
vi.mock("@/lib/utils/export", () => exportMocks);

const sync = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/features/dashboard/shared/offline-sync-provider", () => ({
  useOfflineSyncContext: () => sync.value,
}));

import { OfflineQueueReview } from "../offline-queue-review";
import { PosOfflineBanner } from "../pos-offline-banner";

const sale = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  storeId: "s1",
  queuedAt: "2026-10-05T10:00:00.000Z",
  attempts: 0,
  order: { items: [{ quantity: 2 }, { quantity: 1 }] },
  ...extra,
});

function context(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "s1",
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    attentionCount: 0,
    needsSignIn: false,
    lastSyncedAt: null,
    queuedSales: [],
    queuedProductionLogs: [],
    syncNow: vi.fn(),
    retryParked: vi.fn().mockResolvedValue(undefined),
    discardQueued: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  sync.value = context();
});

describe("OfflineQueueReview", () => {
  it("lists what is waiting and what needs attention, with the server's reason", () => {
    sync.value = context({
      pendingCount: 1,
      attentionCount: 1,
      queuedSales: [
        sale("aaaaaaaa-1"),
        sale("bbbbbbbb-2", {
          needsAttention: true,
          lastError: { status: 422, message: "Invalid order data", at: "x" },
        }),
      ],
      queuedProductionLogs: [
        {
          id: "p1",
          storeId: "s1",
          productId: "x",
          quantity: 12,
          queuedAt: "2026-10-05T09:00:00.000Z",
          attempts: 0,
        },
      ],
    });
    render(<OfflineQueueReview />);

    expect(screen.getAllByText("pos.offline.statusWaiting")).toHaveLength(2);
    expect(screen.getByText("pos.offline.statusNeedsAttention")).toBeInTheDocument();
    expect(screen.getByText("pos.offline.refusedWith")).toBeInTheDocument();
    // Only a parked entry can be discarded.
    expect(screen.getAllByRole("button", { name: "pos.offline.discard" })).toHaveLength(1);
  });

  it("try again puts parked entries back; discard asks first", async () => {
    sync.value = context({
      attentionCount: 1,
      queuedSales: [sale("bbbbbbbb-2", { needsAttention: true })],
    });
    render(<OfflineQueueReview />);

    fireEvent.click(screen.getByRole("button", { name: /pos\.offline\.retry/ }));
    expect(sync.value.retryParked).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "pos.offline.discard" }));
    expect(sync.value.discardQueued).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "pos.offline.discard" }));
    await waitFor(() =>
      expect(sync.value.discardQueued).toHaveBeenCalledWith("sale", "bbbbbbbb-2")
    );
  });

  it("downloads a copy of everything still on the device", () => {
    const sales = [sale("aaaaaaaa-1")];
    sync.value = context({ pendingCount: 1, queuedSales: sales });
    render(<OfflineQueueReview />);

    fireEvent.click(screen.getByRole("button", { name: /pos\.offline\.download/ }));
    expect(exportMocks.downloadJSON).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "s1", sales, productionLogs: [] }),
      expect.stringMatching(/^epidom-unsynced-/)
    );
  });

  it("an expired sign-in offers to sign in again, back to this page", () => {
    sync.value = context({ pendingCount: 1, needsSignIn: true, queuedSales: [sale("a")] });
    render(<OfflineQueueReview />);
    expect(screen.getByRole("link", { name: /pos\.offline\.signIn/ })).toHaveAttribute(
      "href",
      "/login?next=%2Fstore%2Fs1%2Fpos"
    );
  });
});

describe("PosOfflineBanner", () => {
  it("hides when online with nothing queued", () => {
    const { container } = render(<PosOfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  // The probe, not navigator.onLine — wifi up with the internet down.
  it("shows offline from the app's own connection check", () => {
    sync.value = context({ isOnline: false });
    render(<PosOfflineBanner />);
    expect(screen.getByText("pages.posOfflineMessageNoPending")).toBeInTheDocument();
  });

  it("says when sales need attention, and opens the review list", async () => {
    sync.value = context({
      attentionCount: 1,
      queuedSales: [sale("bbbbbbbb-2", { needsAttention: true })],
    });
    render(<PosOfflineBanner />);
    expect(screen.getByText("pos.offline.needsAttentionShort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "pos.offline.review" }));
    expect(await screen.findByText("pos.offline.reviewTitle")).toBeInTheDocument();
  });
});
