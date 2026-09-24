import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, formatDateTime: (d: string) => `DT(${d})` }),
}));

const mockSession = vi.fn();
vi.mock("@/features/pos/hooks/use-pos-session", () => ({
  usePosSession: () => mockSession(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({ status: "idle", locate: async () => null }),
}));

vi.mock("@/lib/utils/image-compression", () => ({
  compressImage: async (file: File) => file,
}));

// The real one opens the camera; here a button hands back a photo straight away.
vi.mock("@/components/shared/selfie-capture", () => ({
  SelfieCapture: ({ onConfirm }: { onConfirm: (file: File) => void }) => (
    <button
      type="button"
      onClick={() => onConfirm(new File(["x"], "selfie.jpg", { type: "image/jpeg" }))}
    >
      take-selfie
    </button>
  ),
}));

import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { ClockInOutPanel } from "../clock-in-out-panel";
import { ClockInOutDialog } from "../clock-in-out-dialog";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const fetchMock = vi.fn();

const STORE_ID = "s1";
const UPLOADED_URL = "https://abc.public.blob.vercel-storage.com/selfie.jpg";

const persona = {
  isActive: true,
  storeId: STORE_ID,
  staffId: "staff-budi",
  staffName: "Budi",
  staffRole: "CASHIER",
};
// The owner's own login is not a staff persona: it gets the kiosk grid.
const ownerSession = {
  isActive: true,
  storeId: STORE_ID,
  staffId: "owner",
  staffName: "Owner",
  staffRole: "OWNER",
};

function staffRow(id: string, name: string, role = "CASHIER", isActive = true) {
  return { id, name, role, isActive };
}

/** `status` is the answer to each successive /attendance/status call (the last one repeats). */
function mockApi({
  staff = [] as unknown[],
  status = [false],
  history = [] as unknown[],
}: { staff?: unknown[]; status?: boolean[]; history?: unknown[] } = {}) {
  let statusCalls = 0;
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/staff")) return { staff };
    if (url.endsWith("/attendance/status")) {
      return { isClockedIn: status[Math.min(statusCalls++, status.length - 1)] };
    }
    if (url.endsWith("/attendance/history")) return { records: history };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrap = (node: ReactElement) => (
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
  const utils = render(wrap(ui));
  return { ...utils, invalidate, rerenderUi: (node: ReactElement) => utils.rerender(wrap(node)) };
}

const statusCalls = () =>
  get.mock.calls.filter(([url]) => String(url).endsWith("/attendance/status"));

const button = (name: string | RegExp) => screen.getByRole("button", { name });

function typePin(digits: string) {
  for (const d of digits) fireEvent.click(button(d));
}

// Braces matter: a beforeEach that RETURNS a function is treated as its cleanup.
beforeEach(() => {
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({});
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { url: UPLOADED_URL } }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ClockInOutPanel — a staff persona is clocked in as itself", () => {
  it("auto-selects the persona and lands on choose-action, with no staff grid or roster fetch", async () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    expect(await screen.findByRole("button", { name: "clockInOut.clockInAction" })).toBeVisible();
    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.queryByText("clockInOut.selectStaff")).toBeNull();
    expect(get.mock.calls.some(([url]) => String(url).endsWith("/staff"))).toBe(false);
    expect(statusCalls()[0][1]).toEqual({ staffId: "staff-budi" });
  });

  it("inline (no onComplete): after a clock-in it restarts on choose-action — now offering clock-out, not a spinner", async () => {
    mockSession.mockReturnValue(persona);
    mockApi({ status: [false, true] });
    const { container, invalidate } = renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    // A persona skips the PIN: straight to the selfie.
    fireEvent.click(button("take-selfie"));

    expect(await screen.findByRole("button", { name: "clockInOut.clockOutAction" })).toBeVisible();
    expect(container.querySelector(".animate-spin")).toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({ method: "POST" })
    );
    expect(post).toHaveBeenCalledWith(`/stores/${STORE_ID}/attendance/clock-in`, {
      staffId: "staff-budi",
      pin: "",
      selfieUrl: UPLOADED_URL,
    });
    expect(toast.success).toHaveBeenCalledWith("clockInOut.success");
    expect(statusCalls()).toHaveLength(2);

    for (const key of [
      "attendance-history",
      "schedule-my-log",
      "schedule-log",
      "attendance-hours",
      "operations-status",
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key, STORE_ID] });
    }
  });

  it("inline: an absence also restarts at choose-action", async () => {
    mockSession.mockReturnValue(persona);
    mockApi({ status: [false, false] });
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.reportAbsence" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sick" } });
    fireEvent.click(button("clockInOut.submit"));

    await waitFor(() => expect(statusCalls()).toHaveLength(2));
    expect(await screen.findByRole("button", { name: "clockInOut.clockInAction" })).toBeVisible();
    expect(post).toHaveBeenCalledWith(`/stores/${STORE_ID}/attendance/absence`, {
      staffId: "staff-budi",
      pin: "",
      notes: "Sick",
    });
    expect(toast.success).toHaveBeenCalledWith("clockInOut.absenceRecorded");
  });

  it("with onComplete: calls it once and does not restart the flow", async () => {
    mockSession.mockReturnValue(persona);
    mockApi({ status: [false, true] });
    const onComplete = vi.fn();
    const { invalidate } = renderWithClient(
      <ClockInOutPanel storeId={STORE_ID} onComplete={onComplete} />
    );

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    fireEvent.click(button("take-selfie"));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(statusCalls()).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["schedule-my-log", STORE_ID] });
  });

  it("restarts for the new persona when the persona changes while mounted", async () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    const { rerenderUi } = renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);
    await screen.findByRole("button", { name: "clockInOut.clockInAction" });

    mockSession.mockReturnValue({ ...persona, staffId: "staff-sari", staffName: "Sari" });
    rerenderUi(<ClockInOutPanel storeId={STORE_ID} />);

    expect(await screen.findByText("Sari")).toBeInTheDocument();
    expect(screen.queryByText("Budi")).toBeNull();
    expect(statusCalls().at(-1)?.[1]).toEqual({ staffId: "staff-sari" });
  });
});

describe("ClockInOutPanel — kiosk (no staff persona)", () => {
  it("the staff grid lists only active, non-owner staff", async () => {
    mockSession.mockReturnValue(ownerSession);
    mockApi({
      staff: [
        staffRow("st-owner", "Olivia Owner", "OWNER"),
        staffRow("st-gone", "Gary Gone", "CASHIER", false),
        staffRow("st-ana", "Ana Cashier"),
        staffRow("st-max", "Max Manager", "MANAGER"),
      ],
    });
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    expect(await screen.findByRole("button", { name: /Ana Cashier/ })).toBeVisible();
    expect(button(/Max Manager/)).toBeVisible();
    expect(screen.queryByText("Olivia Owner")).toBeNull();
    expect(screen.queryByText("Gary Gone")).toBeNull();
    // Plain heading outside a dialog — no Radix primitives needed.
    expect(screen.getByRole("heading", { name: "clockInOut.dialogTitle" })).toBeInTheDocument();
  });

  it("PIN → selfie → clock-in posts the typed PIN, then restarts at the staff grid", async () => {
    mockSession.mockReturnValue({ isActive: false, storeId: null, staffId: null, staffRole: null });
    mockApi({ staff: [staffRow("st-ana", "Ana Cashier")] });
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: /Ana Cashier/ }));
    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    typePin("1234");
    fireEvent.click(button("take-selfie"));

    expect(await screen.findByRole("button", { name: /Ana Cashier/ })).toBeVisible();
    expect(post).toHaveBeenCalledWith(`/stores/${STORE_ID}/attendance/clock-in`, {
      staffId: "st-ana",
      pin: "1234",
      selfieUrl: UPLOADED_URL,
    });
  });
});

describe("ClockInOutPanel — Back on the steps that used to have no way out", () => {
  const backButton = () => screen.getByRole("button", { name: "common.actions.back" });

  it("selfie → Back → choose-action (touch-safe, at least h-10)", async () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    expect(button("take-selfie")).toBeInTheDocument();
    expect(backButton()).toHaveClass("h-10");
    fireEvent.click(backButton());

    expect(screen.getByRole("button", { name: "clockInOut.clockInAction" })).toBeVisible();
    expect(screen.queryByText("take-selfie")).toBeNull();
  });

  it("absence-reason → Back → choose-action, dropping the typed reason", async () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.reportAbsence" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sick" } });
    fireEvent.click(backButton());

    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(button("clockInOut.reportAbsence"));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(post).not.toHaveBeenCalled();
  });

  it("retake-selfie → Back → history", async () => {
    mockSession.mockReturnValue(persona);
    mockApi({
      history: [
        {
          id: "att-1",
          type: "CLOCK_IN",
          timestamp: new Date().toISOString(),
          selfieUrl: null,
          locationLabel: null,
          notes: null,
        },
      ],
    });
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.viewHistory" }));
    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.retake" }));
    expect(screen.getByText("clockInOut.retakePhotoTitle")).toBeInTheDocument();
    fireEvent.click(backButton());

    expect(await screen.findByText("clockInOut.historyTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "clockInOut.retake" })).toBeVisible();
  });

  it("a successful photo retake returns to the history — it doesn't end the flow or call onComplete", async () => {
    mockSession.mockReturnValue(persona);
    mockApi({
      history: [
        {
          id: "att-1",
          type: "CLOCK_IN",
          timestamp: new Date().toISOString(),
          selfieUrl: null,
          locationLabel: null,
          notes: null,
        },
      ],
    });
    post.mockResolvedValue({} as never);
    const onComplete = vi.fn();
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} onComplete={onComplete} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.viewHistory" }));
    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.retake" }));
    fireEvent.click(button("take-selfie"));

    expect(await screen.findByText("clockInOut.historyTitle")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      `/stores/${STORE_ID}/attendance/att-1/retake-photo`,
      expect.objectContaining({ selfieUrl: UPLOADED_URL })
    );
    expect(toast.success).toHaveBeenCalledWith("clockInOut.retakeSuccess");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("kiosk: selfie → Back → choose-action clears the PIN, so the next action asks for it again", async () => {
    mockSession.mockReturnValue(ownerSession);
    mockApi({ staff: [staffRow("st-ana", "Ana Cashier")] });
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: /Ana Cashier/ }));
    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    typePin("1234");
    expect(button("take-selfie")).toBeInTheDocument();
    fireEvent.click(backButton());

    fireEvent.click(button("clockInOut.clockInAction"));
    expect(screen.getByText("clockInOut.enterPin")).toBeInTheDocument();
    // A kept "1234" would make every key a no-op (the pad stops at 4 digits), so
    // the selfie step would never come and the clock-in would never go out.
    typePin("5678");
    fireEvent.click(button("take-selfie"));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `/stores/${STORE_ID}/attendance/clock-in`,
        expect.objectContaining({ staffId: "st-ana", pin: "5678" })
      )
    );
  });

  it("kiosk: Back from a half-typed PIN clears it — the next person's digits don't add to it", async () => {
    mockSession.mockReturnValue(ownerSession);
    mockApi({ staff: [staffRow("st-ana", "Ana Cashier")] });
    post.mockResolvedValue({} as never);
    renderWithClient(<ClockInOutPanel storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: /Ana Cashier/ }));
    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    typePin("12");
    fireEvent.click(backButton());

    fireEvent.click(button("clockInOut.clockInAction"));
    typePin("56");
    // Only two digits so far: still on the PIN step, not submitting "1256".
    expect(screen.queryByText("take-selfie")).toBeNull();
    typePin("78");
    fireEvent.click(button("take-selfie"));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `/stores/${STORE_ID}/attendance/clock-in`,
        expect.objectContaining({ pin: "5678" })
      )
    );
  });
});

describe("ClockInOutDialog — thin wrapper around the panel", () => {
  it("still renders its title as the dialog's accessible name, exactly once", async () => {
    mockSession.mockReturnValue(ownerSession);
    mockApi({ staff: [staffRow("st-ana", "Ana Cashier")] });
    renderWithClient(<ClockInOutDialog open onOpenChange={() => {}} storeId={STORE_ID} />);

    const dialog = await screen.findByRole("dialog", { name: "clockInOut.dialogTitle" });
    expect(dialog).toHaveAccessibleDescription("clockInOut.selectStaff");
    expect(dialog.querySelectorAll('[data-slot="dialog-title"]')).toHaveLength(1);
    expect(await within(dialog).findByRole("button", { name: /Ana Cashier/ })).toBeVisible();
  });

  it("a persona's steps with no visible heading still name the dialog (one sr-only title)", async () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    renderWithClient(<ClockInOutDialog open onOpenChange={() => {}} storeId={STORE_ID} />);

    const dialog = await screen.findByRole("dialog", { name: "clockInOut.dialogTitle" });
    await within(dialog).findByRole("button", { name: "clockInOut.clockInAction" });
    const titles = dialog.querySelectorAll('[data-slot="dialog-title"]');
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveClass("sr-only");

    // A step with its own heading swaps it in rather than adding a second title.
    fireEvent.click(within(dialog).getByRole("button", { name: "clockInOut.clockInAction" }));
    expect(dialog.querySelectorAll('[data-slot="dialog-title"]')).toHaveLength(1);
    expect(dialog).toHaveAccessibleName("clockInOut.clockInAction");
  });

  it("closes itself after a successful clock-in", async () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    const onOpenChange = vi.fn();
    renderWithClient(<ClockInOutDialog open onOpenChange={onOpenChange} storeId={STORE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "clockInOut.clockInAction" }));
    fireEvent.click(button("take-selfie"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("renders nothing while closed", () => {
    mockSession.mockReturnValue(persona);
    mockApi();
    renderWithClient(<ClockInOutDialog open={false} onOpenChange={() => {}} storeId={STORE_ID} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
