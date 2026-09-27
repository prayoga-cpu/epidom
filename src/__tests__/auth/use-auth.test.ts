import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted — factories must not reference external let/const.

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
  signIn: { email: vi.fn() },
  signOut: vi.fn(),
  signUp: { email: vi.fn() },
}));

// Overrides the global next/navigation mock so the tests can see where
// useRegister navigates.
const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => "/register",
  useSearchParams: () => new URLSearchParams(),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { authClient } from "@/lib/auth-client";
import { useLogin, useRegister } from "@/features/auth/hooks/use-auth";
import { VERIFY_EMAIL_STORAGE_KEY } from "@/features/auth/register/lib/verify-email-handoff";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useLogin", () => {
  it("resolves with session data on successful login", async () => {
    const fakeSession = { user: { id: "u1", email: "a@b.com" } };
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: fakeSession,
      error: null,
    } as never);

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    result.current.mutate({ email: "a@b.com", password: "Pass123" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(fakeSession);
  });

  it("throws with the error message when login fails", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    } as never);

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    result.current.mutate({ email: "a@b.com", password: "wrong" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Invalid credentials");
  });

  it("falls back to default message when error has no message", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: {},
    } as never);

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    result.current.mutate({ email: "a@b.com", password: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Invalid email or password");
  });
});

describe("useRegister", () => {
  it("resolves with session and email on successful registration", async () => {
    const fakeSession = { user: { id: "u2" } };
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: fakeSession,
      error: null,
    } as never);

    const { result } = renderHook(() => useRegister(), { wrapper: makeWrapper() });

    result.current.mutate({
      email: "new@user.com",
      password: "Pass123",
      confirmPassword: "Pass123",
      name: "New User",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.email).toBe("new@user.com");
  });

  it("always sends a verification callbackURL: the setup wizard, flagged verified=1", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: { user: { id: "u3" } },
      error: null,
    } as never);

    const { result } = renderHook(() => useRegister(), { wrapper: makeWrapper() });

    result.current.mutate({
      email: "new@user.com",
      password: "Pass123",
      confirmPassword: "Pass123",
      name: "New User",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Better Auth's own default is "/", the marketing homepage.
    expect(authClient.signUp.email).toHaveBeenCalledWith({
      email: "new@user.com",
      password: "Pass123",
      name: "New User",
      callbackURL: "/onboarding?verified=1",
    });
  });

  it("uses a deep link as the verification callbackURL when the caller passes one", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: { user: { id: "u4" } },
      error: null,
    } as never);

    const { result } = renderHook(() => useRegister(), { wrapper: makeWrapper() });

    result.current.mutate({
      email: "new@user.com",
      password: "Pass123",
      confirmPassword: "Pass123",
      name: "New User",
      callbackURL: "/transfer-ownership/abc",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authClient.signUp.email).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/transfer-ownership/abc" })
    );
    expect(result.current.data?.callbackURL).toBe("/transfer-ownership/abc");
  });

  it("never passes an unsafe callbackURL through, even if a caller forgets to validate", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: { user: { id: "u5" } },
      error: null,
    } as never);

    const { result } = renderHook(() => useRegister(), { wrapper: makeWrapper() });

    result.current.mutate({
      email: "new@user.com",
      password: "Pass123",
      confirmPassword: "Pass123",
      name: "New User",
      callbackURL: "//evil.example",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authClient.signUp.email).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/onboarding?verified=1" })
    );
  });

  describe("the hand-over to /verify-email-sent keeps the address out of the URL", () => {
    // Analytics (GA4 page_location, the Meta Pixel) records the full page URL.
    async function registerAndLand(callbackURL?: string) {
      vi.mocked(authClient.signUp.email).mockResolvedValue({
        data: { user: { id: "u6" } },
        error: null,
      } as never);
      const { result } = renderHook(() => useRegister(), { wrapper: makeWrapper() });
      result.current.mutate({
        email: "jane+shop@bakery.com",
        password: "Pass123",
        confirmPassword: "Pass123",
        name: "Jane",
        ...(callbackURL ? { callbackURL } : {}),
      });
      await waitFor(() => expect(nav.push).toHaveBeenCalledTimes(1));
      return nav.push.mock.calls[0][0] as string;
    }

    it("navigates to the bare page and leaves the address in sessionStorage", async () => {
      const url = await registerAndLand();

      expect(url).toBe("/verify-email-sent");
      expect(window.sessionStorage.getItem(VERIFY_EMAIL_STORAGE_KEY)).toBe("jane+shop@bakery.com");
    });

    it("still carries the deep link, and only the deep link", async () => {
      const url = await registerAndLand("/transfer-ownership/abc");

      expect(url).toBe("/verify-email-sent?next=%2Ftransfer-ownership%2Fabc");
      expect(url).not.toMatch(/[?&]email=|jane|bakery/);
    });

    it("falls back to ?email= only when storage is unavailable, so the page can still resend", async () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });

      const url = await registerAndLand("/transfer-ownership/abc");

      const params = new URL(url, "http://x.invalid").searchParams;
      expect(params.get("email")).toBe("jane+shop@bakery.com");
      expect(params.get("next")).toBe("/transfer-ownership/abc");
    });
  });

  it("throws when registration returns an error", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: null,
      error: { message: "Email already in use" },
    } as never);

    const { result } = renderHook(() => useRegister(), { wrapper: makeWrapper() });

    result.current.mutate({
      email: "dup@user.com",
      password: "Pass123",
      confirmPassword: "Pass123",
      name: "Dup",
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Email already in use");
  });
});
