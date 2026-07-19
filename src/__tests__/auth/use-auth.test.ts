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

// next/navigation already mocked in global setup

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { authClient } from "@/lib/auth-client";
import { useLogin, useRegister } from "@/features/auth/hooks/use-auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.resetAllMocks();
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
