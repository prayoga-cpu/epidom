import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const h = vi.hoisted(() => ({
  post: vi.fn(),
  signInEmail: vi.fn(),
  user: {
    current: null as null | { email: string; emailVerified?: boolean },
  },
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
  authClient: { signIn: { email: h.signInEmail } },
}));

import { ApiClientError } from "@/lib/api/client";
import { StaffInviteClaimForm } from "../staff-invite-claim-form";

const TOKEN = "t".repeat(43);
const NEXT = encodeURIComponent(`/staff-invite?token=${TOKEN}`);

const valid = (over: Record<string, unknown> = {}) => ({
  state: "valid",
  staffName: "Jane",
  storeName: "Kopi Kita",
  maskedEmail: "j***@example.com",
  hasExistingAccount: false,
  ...over,
});

function apiError(status: number, reason?: string, extra: Record<string, unknown> = {}) {
  return new ApiClientError(
    {
      success: false,
      error: { code: "X", message: "server said no", details: reason ? { reason, ...extra } : undefined },
    } as never,
    status
  );
}

function mockLookup(result: unknown) {
  h.post.mockImplementation(async (url: string) => {
    if (url === "/staff-invite/lookup") return result;
    throw new Error(`unexpected POST ${url}`);
  });
}

let originalLocation: Location;
beforeEach(() => {
  vi.clearAllMocks();
  h.user.current = null;
  h.loading.current = false;
  h.signInEmail.mockResolvedValue({ error: null });
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

describe("StaffInviteClaimForm — link problems", () => {
  it("no token in the URL: 'invalid', and the API is never called", () => {
    render(<StaffInviteClaimForm token={null} />);
    expect(screen.getByText("pages.staffInviteInvalid")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", "pages.staffInviteInvalid"],
    ["expired", "pages.staffInviteExpired"],
    ["consumed", "pages.staffInviteConsumed"],
    ["unavailable", "pages.staffInviteUnavailable"],
  ])("a %s invite shows its own message and no way to claim", async (state, message) => {
    mockLookup({ state });
    render(<StaffInviteClaimForm token={TOKEN} />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("pages.staffInviteCreateAccount")).toBeNull();
  });

  it("a failed lookup (network) says so instead of spinning forever", async () => {
    h.post.mockRejectedValue(new Error("offline"));
    render(<StaffInviteClaimForm token={TOKEN} />);
    expect(await screen.findByText("pages.staffInviteLoadFailed")).toBeInTheDocument();
  });

  it("sends the token in the POST body, never in a URL", async () => {
    mockLookup(valid());
    render(<StaffInviteClaimForm token={TOKEN} />);
    await screen.findByText("pages.staffInviteCreateAccount");
    expect(h.post).toHaveBeenCalledWith("/staff-invite/lookup", { token: TOKEN });
  });
});

describe("StaffInviteClaimForm — no account for that email yet", () => {
  async function fill(password: string, confirm = password) {
    await screen.findByText("pages.staffInviteCreateAccount");
    fireEvent.change(screen.getByLabelText("pages.staffInvitePasswordLabel"), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText("pages.staffInviteConfirmPasswordLabel"), {
      target: { value: confirm },
    });
    fireEvent.click(screen.getByText("pages.staffInviteCreateAccount"));
  }

  it("shows the staffer's name and store, with the email masked", async () => {
    mockLookup(valid());
    render(<StaffInviteClaimForm token={TOKEN} />);
    await screen.findByText("pages.staffInviteCreateAccount");
    // t() is a passthrough here, so the interpolated copy is the raw key.
    expect(screen.getByText("pages.staffInviteClaimIntro")).toBeInTheDocument();
    expect(screen.getByText("pages.staffInviteSentTo")).toBeInTheDocument();
    expect((screen.getByLabelText("pages.staffInviteNameLabel") as HTMLInputElement).value).toBe("Jane");
  });

  it("refuses a short password without calling the API", async () => {
    mockLookup(valid());
    render(<StaffInviteClaimForm token={TOKEN} />);
    await fill("short");
    expect(await screen.findByRole("alert")).toHaveTextContent("pages.staffInvitePasswordHint");
    expect(h.post).not.toHaveBeenCalledWith("/staff-invite/complete", expect.anything());
  });

  it("refuses mismatched passwords without calling the API", async () => {
    mockLookup(valid());
    render(<StaffInviteClaimForm token={TOKEN} />);
    await fill("correct-horse", "correct-horze");
    expect(await screen.findByRole("alert")).toHaveTextContent("pages.staffInvitePasswordMismatch");
    expect(h.post).not.toHaveBeenCalledWith("/staff-invite/complete", expect.anything());
  });

  it("creates the account, signs in with the returned email, and lands on the POS shortcut", async () => {
    h.post.mockImplementation(async (url: string) => {
      if (url === "/staff-invite/lookup") return valid();
      if (url === "/staff-invite/complete") return { linked: true, email: "jane.doe@example.com" };
      throw new Error(`unexpected POST ${url}`);
    });
    render(<StaffInviteClaimForm token={TOKEN} />);
    await fill("correct-horse-battery");

    await waitFor(() => expect(window.location.href).toBe("/go/pos"));
    expect(h.post).toHaveBeenCalledWith("/staff-invite/complete", {
      token: TOKEN,
      password: "correct-horse-battery",
      name: "Jane",
    });
    expect(h.signInEmail).toHaveBeenCalledWith({
      email: "jane.doe@example.com",
      password: "correct-horse-battery",
    });
  });

  it("if the account is created but the automatic sign-in fails, sends them to /login rather than a dead end", async () => {
    h.post.mockImplementation(async (url: string) =>
      url === "/staff-invite/lookup" ? valid() : { linked: true, email: "jane.doe@example.com" }
    );
    h.signInEmail.mockResolvedValue({ error: { message: "nope" } });
    render(<StaffInviteClaimForm token={TOKEN} />);
    await fill("correct-horse-battery");

    await waitFor(() => expect(window.location.href).toBe("/login"));
  });

  it("an account that appeared since the page loaded flips to the sign-in-and-link path instead of erroring", async () => {
    h.post.mockImplementation(async (url: string) => {
      if (url === "/staff-invite/lookup") return valid();
      throw apiError(409, "account_exists");
    });
    render(<StaffInviteClaimForm token={TOKEN} />);
    await fill("correct-horse-battery");

    expect(await screen.findByText("pages.staffInviteSignInToLink")).toBeInTheDocument();
    expect(screen.queryByText("pages.staffInviteCreateAccount")).toBeNull();
  });

  it("a link that died mid-way (consumed elsewhere) shows the dead-link state", async () => {
    h.post.mockImplementation(async (url: string) => {
      if (url === "/staff-invite/lookup") return valid();
      throw apiError(410, "consumed");
    });
    render(<StaffInviteClaimForm token={TOKEN} />);
    await fill("correct-horse-battery");

    expect(await screen.findByText("pages.staffInviteConsumed")).toBeInTheDocument();
  });

  it("warns a signed-in visitor that creating this account will replace their current session", async () => {
    h.user.current = { email: "owner@shop.com", emailVerified: true };
    mockLookup(valid());
    render(<StaffInviteClaimForm token={TOKEN} />);
    expect(await screen.findByText("pages.staffInviteSessionSwitchNote")).toBeInTheDocument();
  });
});

describe("StaffInviteClaimForm — an account already exists for that email", () => {
  it("signed out: sign in with THAT account, with this invite link preserved in `next`", async () => {
    mockLookup(valid({ hasExistingAccount: true }));
    render(<StaffInviteClaimForm token={TOKEN} />);

    const cta = await screen.findByText("pages.staffInviteSignInToLink");
    expect(cta.closest("a")?.getAttribute("href")).toBe(`/login?next=${NEXT}`);
    expect(screen.queryByText("pages.staffInviteCreateAccount")).toBeNull();
  });

  it("signed in: asks before linking, then posts the token ONLY — never a password or an email", async () => {
    h.user.current = { email: "jane.doe@example.com", emailVerified: true };
    h.post.mockImplementation(async (url: string) => {
      if (url === "/staff-invite/lookup") return valid({ hasExistingAccount: true });
      if (url === "/staff-invite/complete") return { linked: true };
      throw new Error(`unexpected POST ${url}`);
    });
    render(<StaffInviteClaimForm token={TOKEN} />);

    fireEvent.click(await screen.findByText("pages.staffInviteLinkAccount"));

    await waitFor(() => expect(window.location.href).toBe("/go/pos"));
    expect(h.post).toHaveBeenCalledWith("/staff-invite/complete", { token: TOKEN });
    expect(h.signInEmail).not.toHaveBeenCalled();
  });

  it("the server refusing a DIFFERENT signed-in account shows the wrong-account state and offers to switch", async () => {
    h.user.current = { email: "someone.else@example.com", emailVerified: true };
    h.post.mockImplementation(async (url: string) => {
      if (url === "/staff-invite/lookup") return valid({ hasExistingAccount: true });
      throw apiError(403, "email_mismatch", { maskedEmail: "j***@example.com" });
    });
    render(<StaffInviteClaimForm token={TOKEN} />);

    fireEvent.click(await screen.findByText("pages.staffInviteLinkAccount"));

    expect(await screen.findByText("pages.staffInviteWrongAccount")).toBeInTheDocument();
    expect(window.location.href).toBe("http://localhost/"); // did NOT navigate on

    fireEvent.click(screen.getByText("pages.staffInviteSwitchAccount"));
    await waitFor(() => expect(window.location.href).toBe(`/login?next=${NEXT}`));
    expect(h.signOut).toHaveBeenCalled();
  });

  it("a signed-in account whose email isn't verified can't press the link button", async () => {
    h.user.current = { email: "jane.doe@example.com", emailVerified: false };
    mockLookup(valid({ hasExistingAccount: true }));
    render(<StaffInviteClaimForm token={TOKEN} />);

    expect(await screen.findByText("pages.staffInviteUnverified")).toBeInTheDocument();
    expect(screen.getByText("pages.staffInviteLinkAccount").closest("button")).toBeDisabled();
  });
});
