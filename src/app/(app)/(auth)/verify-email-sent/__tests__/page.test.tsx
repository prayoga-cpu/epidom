import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted: anything a factory touches has to come from vi.hoisted.

const h = vi.hoisted(() => ({
  search: "",
  sendVerificationEmail: vi.fn(),
}));

// Overrides the global mock from src/test/setup.ts so each test can set the query.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/verify-email-sent",
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { sendVerificationEmail: h.sendVerificationEmail },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import VerifyEmailSentPage from "../page";
import {
  VERIFY_EMAIL_STORAGE_KEY,
  stashVerifyEmail,
} from "@/features/auth/register/lib/verify-email-handoff";

beforeEach(() => {
  h.search = "";
  h.sendVerificationEmail.mockReset();
  h.sendVerificationEmail.mockResolvedValue({ error: null });
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/verify-email-sent");
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

/** Puts the page at `?search`, in both the mocked hook and the real address bar. */
function renderAt(search: string) {
  h.search = search;
  window.history.replaceState(null, "", `/verify-email-sent${search ? `?${search}` : ""}`);
  return render(<VerifyEmailSentPage />);
}

async function resendAt(search: string) {
  renderAt(search);
  fireEvent.click(await screen.findByRole("button", { name: "auth.verifyEmail.resendButton" }));
  await waitFor(() => expect(h.sendVerificationEmail).toHaveBeenCalledTimes(1));
  return h.sendVerificationEmail.mock.calls[0][0];
}

describe("/verify-email-sent: the resent link lands where the first email does", () => {
  beforeEach(() => {
    stashVerifyEmail("jane@bakery.com");
  });

  it("points at the setup wizard, flagged verified=1, when there is no ?next=", async () => {
    const args = await resendAt("");

    expect(args).toEqual({ email: "jane@bakery.com", callbackURL: "/onboarding?verified=1" });
  });

  it("points at a safe ?next= deep link", async () => {
    const args = await resendAt("next=%2Ftransfer-ownership%2Fabc");

    expect(args.callbackURL).toBe("/transfer-ownership/abc");
  });

  it.each([
    ["protocol-relative", "%2F%2Fevil.example"],
    ["absolute", "https%3A%2F%2Fevil.example"],
  ])("ignores an unsafe ?next= (%s)", async (_label, next) => {
    const args = await resendAt(`next=${next}`);

    expect(args.callbackURL).toBe("/onboarding?verified=1");
  });

  it("shows no resend button without an address to send to", async () => {
    window.sessionStorage.clear();
    renderAt("");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      screen.queryByRole("button", { name: "auth.verifyEmail.resendButton" })
    ).not.toBeInTheDocument();
  });
});

describe("/verify-email-sent: the address never has to be in the URL", () => {
  it("shows and resends to the address signup left in sessionStorage", async () => {
    stashVerifyEmail("jane@bakery.com");

    const args = await resendAt("");

    expect(screen.getByText("jane@bakery.com")).toBeInTheDocument();
    expect(args.email).toBe("jane@bakery.com");
    expect(window.location.href).not.toContain("jane");
  });

  it("keeps the stashed address across a reload (it is read, not taken)", async () => {
    stashVerifyEmail("jane@bakery.com");

    const first = renderAt("");
    await screen.findByText("jane@bakery.com");
    first.unmount();
    renderAt("");

    expect(await screen.findByText("jane@bakery.com")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(VERIFY_EMAIL_STORAGE_KEY)).toBe("jane@bakery.com");
  });

  it("still honours a legacy ?email= link, then stashes it and strips it from the address bar", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    const args = await resendAt(
      "utm_source=mail&email=jane%40bakery.com&next=%2Ftransfer-ownership%2Fabc"
    );

    expect(args).toEqual({ email: "jane@bakery.com", callbackURL: "/transfer-ownership/abc" });
    expect(window.sessionStorage.getItem(VERIFY_EMAIL_STORAGE_KEY)).toBe("jane@bakery.com");
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/verify-email-sent?utm_source=mail&next=%2Ftransfer-ownership%2Fabc"
    );
    expect(window.location.search).not.toContain("email");
  });

  it("prefers the address a legacy ?email= names over an older stashed one", async () => {
    stashVerifyEmail("older@bakery.com");

    const args = await resendAt("email=jane%40bakery.com");

    expect(args.email).toBe("jane@bakery.com");
    expect(window.sessionStorage.getItem(VERIFY_EMAIL_STORAGE_KEY)).toBe("jane@bakery.com");
  });

  it("leaves ?email= in the URL when storage is unavailable, so a reload keeps the address", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    const args = await resendAt("email=jane%40bakery.com");

    expect(args.email).toBe("jane@bakery.com");
    expect(window.location.search).toBe("?email=jane%40bakery.com");
  });

  it("renders a hostile stashed value as text, never as markup", async () => {
    stashVerifyEmail('<img src=x onerror="alert(1)">');

    const { container } = renderAt("");
    await screen.findByText('<img src=x onerror="alert(1)">');

    expect(container.querySelector("img")).toBeNull();
  });
});
