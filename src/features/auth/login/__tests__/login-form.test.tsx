import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted: anything a factory touches has to come from vi.hoisted.

const h = vi.hoisted(() => ({
  search: "",
  mutate: vi.fn(),
  signInSocial: vi.fn(),
}));

// A fresh URLSearchParams per call mirrors the real hook; each test sets h.search.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useLogin: () => ({ mutate: h.mutate, isPending: false, error: null }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: h.signInSocial }, sendVerificationEmail: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { LoginForm } from "@/features/auth/login/components/login-form";

// ── Helpers ──────────────────────────────────────────────────────────────────

const START = "http://localhost/";

let originalLocation: Location;

beforeEach(() => {
  h.search = "";
  h.mutate.mockReset();
  h.signInSocial.mockReset();
  // The server accepted the credentials: fire the success callback the way react-query would.
  h.mutate.mockImplementation((_data: unknown, options: { onSuccess?: () => void }) => {
    options.onSuccess?.();
  });
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: START },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

/** Renders the form at `?search`, fills in valid credentials and submits. */
function signInAt(search: string) {
  h.search = search;
  const { container } = render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("auth.email"), { target: { value: "jane@bakery.com" } });
  fireEvent.change(screen.getByLabelText("auth.password"), { target: { value: "hunter22" } });
  // fireEvent.submit skips the browser's own type="email" check, like the other form tests.
  fireEvent.submit(container.querySelector("form")!);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LoginForm: where a successful email login lands", () => {
  it("goes to /stores when there is no ?next= or ?callbackUrl=", async () => {
    signInAt("");

    await waitFor(() => expect(window.location.href).toBe("/stores"));
  });

  it.each([
    ["an internal path in ?next=", "next=%2Fstore%2Fabc%2Fpos", "/store/abc/pos"],
    [
      "an internal path in ?callbackUrl= (what the middleware sets)",
      "callbackUrl=%2Fonboarding",
      "/onboarding",
    ],
    [
      "an internal path that carries its own query",
      "next=%2Ftransfer-ownership%2Fabc%3Ftoken%3D1",
      "/transfer-ownership/abc?token=1",
    ],
  ])("honours %s", async (_label, search, expected) => {
    signInAt(search);

    await waitFor(() => expect(window.location.href).toBe(expected));
  });

  it.each([
    ["an absolute URL in ?next=", "next=https%3A%2F%2Fevil.example"],
    ["an absolute URL in ?callbackUrl=", "callbackUrl=https%3A%2F%2Fevil.example%2Fphish"],
    ["an absolute http URL", "next=http%3A%2F%2Fevil.example"],
    ["a protocol-relative //host in ?next=", "next=%2F%2Fevil.example"],
    ["a protocol-relative //host in ?callbackUrl=", "callbackUrl=%2F%2Fevil.example%2Fphish"],
    ["a javascript: URL", "next=javascript%3Aalert(document.cookie)"],
    ["a data: URL", "next=data%3Atext%2Fhtml%2C%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["a backslash the browser turns into //host (/\\host)", "next=%2F%5Cevil.example"],
    ["a tab smuggled between the slashes", "next=%2F%09%2Fevil.example"],
    ["a relative path with no leading slash", "next=evil.example%2Fphish"],
  ])("never follows %s: it lands on /stores", async (_label, search) => {
    signInAt(search);

    await waitFor(() => expect(window.location.href).toBe("/stores"));
    // Belt and braces: whatever the value was, the page was never pointed at it.
    expect(window.location.href).not.toMatch(/evil|javascript:|data:/i);
  });

  it("does not navigate at all when the login fails", async () => {
    h.mutate.mockImplementation((_data: unknown, options: { onError?: (e: Error) => void }) => {
      options.onError?.(new Error("Invalid email or password"));
    });

    signInAt("next=%2Fstore%2Fabc%2Fpos");

    // The submit is async (react-hook-form validates first), so wait for the attempt.
    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(window.location.href).toBe(START);
  });
});

describe("LoginForm: the other places that use ?next= agree with the redirect", () => {
  it("sends Google sign-in to /stores for an absolute ?next=, exactly like the email login", async () => {
    h.search = "next=https%3A%2F%2Fevil.example";
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    await waitFor(() => expect(h.signInSocial).toHaveBeenCalledTimes(1));
    expect(h.signInSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "/stores" });
  });

  it("sends Google sign-in to a legitimate ?next= path", async () => {
    h.search = "next=%2Fstore%2Fabc%2Fpos";
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    await waitFor(() => expect(h.signInSocial).toHaveBeenCalledTimes(1));
    expect(h.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/store/abc/pos",
    });
  });
});
