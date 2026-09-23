import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const h = vi.hoisted(() => ({
  post: vi.fn(),
  user: { current: null as null | { email: string; emailVerified?: boolean } },
  loading: { current: false },
  signOut: vi.fn(),
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiClient: { post: h.post } };
});
vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: h.user.current, loading: h.loading.current }),
  signOut: h.signOut,
}));

import { ApiClientError } from "@/lib/api/client";
import { AcceptTransferClient } from "../accept-transfer-client";

const TOKEN = "c".repeat(64);
const ACCEPT_PATH = `/transfer-ownership/accept?token=${TOKEN}`;
const NEXT = encodeURIComponent(ACCEPT_PATH);

const details = {
  storeName: "Kopi Kita",
  toEmail: "new@owner.com",
  fromName: "Olivia",
  storeTimezone: "Asia/Jakarta",
  expiresAt: "2026-09-26T00:00:00.000Z",
};

function apiError(status: number) {
  return new ApiClientError(
    { success: false, error: { code: "X", message: "nope" } } as never,
    status
  );
}

let originalLocation: Location;
beforeEach(() => {
  vi.clearAllMocks();
  h.user.current = null;
  h.loading.current = false;
  h.post.mockImplementation(async (url: string) => {
    if (url === "/transfer-ownership/lookup") return details;
    throw new Error(`unexpected POST ${url}`);
  });
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "http://localhost/" },
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe("AcceptTransferClient — link problems", () => {
  it("shows 'invalid' without calling the API when the link has no token", () => {
    render(<AcceptTransferClient token={null} />);
    expect(screen.getByText("pages.storeTransferInvalid")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it.each([
    [410, "pages.storeTransferExpired"],
    [404, "pages.storeTransferInvalid"],
    [500, "pages.storeTransferLoadFailed"],
  ])("maps a %s lookup response to the right message", async (status, key) => {
    h.post.mockRejectedValue(apiError(status));
    render(<AcceptTransferClient token={TOKEN} />);
    expect(await screen.findByText(key)).toBeInTheDocument();
  });

  it("maps a network failure to the generic 'couldn't load' message", async () => {
    h.post.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AcceptTransferClient token={TOKEN} />);
    expect(await screen.findByText("pages.storeTransferLoadFailed")).toBeInTheDocument();
  });

  it("looks the token up in a POST body, never in the URL", async () => {
    render(<AcceptTransferClient token={TOKEN} />);
    await screen.findByText("pages.storeTransferAcceptIntro");
    expect(h.post).toHaveBeenCalledWith("/transfer-ownership/lookup", { token: TOKEN });
  });
});

describe("AcceptTransferClient — signed out", () => {
  it("offers sign-in and sign-up that both carry the accept link back", async () => {
    render(<AcceptTransferClient token={TOKEN} />);
    const signIn = await screen.findByText("pages.storeTransferSignIn");
    expect(signIn.closest("a")?.getAttribute("href")).toBe(`/login?next=${NEXT}`);
    expect(
      screen.getByText("pages.storeTransferCreateAccount").closest("a")?.getAttribute("href")
    ).toBe(`/register?next=${NEXT}`);
    expect(screen.queryByText("pages.storeTransferAccept")).toBeNull();
  });

  it("waits for the session check instead of flashing sign-in CTAs at a signed-in user", () => {
    h.loading.current = true;
    render(<AcceptTransferClient token={TOKEN} />);
    expect(screen.queryByText("pages.storeTransferSignIn")).toBeNull();
    expect(screen.queryByText("pages.storeTransferAccept")).toBeNull();
  });
});

describe("AcceptTransferClient — signed in as someone else", () => {
  beforeEach(() => {
    h.user.current = { email: "someone.else@owner.com", emailVerified: true };
  });

  it("explains the mismatch, hides Accept, and offers to switch accounts", async () => {
    render(<AcceptTransferClient token={TOKEN} />);
    expect(await screen.findByText("pages.storeTransferWrongAccount")).toBeInTheDocument();
    expect(screen.queryByText("pages.storeTransferAccept")).toBeNull();
  });

  it("switching signs out and returns to login with the accept link preserved", async () => {
    h.signOut.mockResolvedValue(undefined);
    render(<AcceptTransferClient token={TOKEN} />);
    fireEvent.click(await screen.findByText("pages.storeTransferSwitchAccount"));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.href).toBe(`/login?next=${NEXT}`));
  });
});

describe("AcceptTransferClient — signed in as the invited address", () => {
  beforeEach(() => {
    h.user.current = { email: "New@Owner.com", emailVerified: true };
  });

  it("spells out what accepting does before offering the button", async () => {
    render(<AcceptTransferClient token={TOKEN} />);
    await screen.findByText("pages.storeTransferAccept");
    for (const key of [
      "pages.storeTransferConsequenceOwner",
      "pages.storeTransferConsequenceOldOwner",
      "pages.storeTransferConsequencePlan",
      "pages.storeTransferConsequencePin",
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it("matches the invited email case-insensitively and accepts, then does a full navigation into the store", async () => {
    h.post.mockImplementation(async (url: string) => {
      if (url === "/transfer-ownership/lookup") return details;
      if (url === "/transfer-ownership/accept") return { storeId: "store_9" };
      throw new Error(`unexpected POST ${url}`);
    });
    render(<AcceptTransferClient token={TOKEN} />);

    fireEvent.click(await screen.findByText("pages.storeTransferAccept"));

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith("/transfer-ownership/accept", { token: TOKEN })
    );
    await waitFor(() => expect(window.location.href).toBe("/store/store_9/dashboard"));
  });

  it("shows the server's reason on failure and lets the user retry", async () => {
    h.post.mockImplementation(async (url: string) => {
      if (url === "/transfer-ownership/lookup") return details;
      throw new Error("This transfer link is invalid or has already been used.");
    });
    render(<AcceptTransferClient token={TOKEN} />);

    fireEvent.click(await screen.findByText("pages.storeTransferAccept"));

    expect(
      await screen.findByText("This transfer link is invalid or has already been used.")
    ).toBeInTheDocument();
    expect(window.location.href).toBe("http://localhost/");
    expect(screen.getByText("pages.storeTransferAccept").closest("button")).not.toBeDisabled();
  });

  it("blocks Accept until the account's email is verified", async () => {
    h.user.current = { email: "new@owner.com", emailVerified: false };
    render(<AcceptTransferClient token={TOKEN} />);
    const button = (await screen.findByText("pages.storeTransferAccept")).closest("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("pages.storeTransferVerifyEmail")).toBeInTheDocument();
  });
});
