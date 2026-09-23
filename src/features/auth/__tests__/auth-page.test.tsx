import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted: anything a factory touches has to come from vi.hoisted.

const h = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
}));

// A fresh URLSearchParams per call mirrors the real hook; each test sets h.search.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ push: vi.fn(), replace: h.replace }),
  usePathname: () => "/register",
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// The forms and the marketing panel have their own tests. Stubbed here so this
// file is only about the toggle.
vi.mock("@/features/auth/login/components/login-form", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));
vi.mock("@/features/auth/register/components/register-form", () => ({
  RegisterForm: () => <div data-testid="register-form" />,
}));
vi.mock("@/features/auth/components/auth-visual", () => ({
  AuthVisual: () => <div data-testid="auth-visual" />,
}));

import { AuthPage } from "@/features/auth/components/auth-page";

// ── Helpers ──────────────────────────────────────────────────────────────────

const toLogin = () => screen.getByRole("button", { name: "auth.loginButton" });
const toRegister = () => screen.getByRole("button", { name: "auth.registerButton" });

function renderAt(initialMode: "login" | "register", search: string) {
  h.search = search;
  return render(<AuthPage initialMode={initialMode} />);
}

beforeEach(() => {
  h.search = "";
  h.replace.mockReset();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AuthPage: the Login <-> Register toggle keeps the query string", () => {
  it("does NOT copy a legacy ?email= onto the Login URL (personal data stays out of URLs)", () => {
    // Deliberate change: the toggle used to carry the homepage-CTA address across.
    renderAt("register", "email=jane%40bakery.com");

    fireEvent.click(toLogin());

    expect(h.replace).toHaveBeenCalledTimes(1);
    expect(h.replace).toHaveBeenCalledWith("/login", { scroll: false });
  });

  it("keeps ?next= when flipping to Register", () => {
    renderAt("login", "next=%2Ftransfer-ownership%2Fabc");

    fireEvent.click(toRegister());

    expect(h.replace).toHaveBeenCalledWith("/register?next=%2Ftransfer-ownership%2Fabc", {
      scroll: false,
    });
  });

  it("keeps ?callbackUrl= when flipping to Register", () => {
    renderAt("login", "callbackUrl=%2Fonboarding");

    fireEvent.click(toRegister());

    expect(h.replace).toHaveBeenCalledWith("/register?callbackUrl=%2Fonboarding", {
      scroll: false,
    });
  });

  it("keeps next and callbackUrl together, and drops email from the same query", () => {
    renderAt(
      "register",
      "email=jane%40bakery.com&next=%2Fstaff-invite%2Ftok&callbackUrl=%2Fstores"
    );

    fireEvent.click(toLogin());

    expect(h.replace).toHaveBeenCalledWith(
      "/login?next=%2Fstaff-invite%2Ftok&callbackUrl=%2Fstores",
      { scroll: false }
    );
  });

  it("keeps params it does not know about (campaign tags)", () => {
    renderAt("register", "utm_source=newsletter&email=jane%40bakery.com");

    fireEvent.click(toLogin());

    expect(h.replace).toHaveBeenCalledWith("/login?utm_source=newsletter", {
      scroll: false,
    });
  });

  it("does not carry the one-shot toast flags across", () => {
    renderAt("login", "error=state_mismatch&registered=true&next=%2Fstores%2Fabc");

    fireEvent.click(toRegister());

    expect(h.replace).toHaveBeenCalledWith("/register?next=%2Fstores%2Fabc", { scroll: false });
  });

  it("goes to the bare path when there is no query string (unchanged behaviour)", () => {
    renderAt("login", "");
    fireEvent.click(toRegister());
    expect(h.replace).toHaveBeenLastCalledWith("/register", { scroll: false });

    fireEvent.click(toLogin());
    expect(h.replace).toHaveBeenLastCalledWith("/login", { scroll: false });
  });

  it("keeps the query string (minus email) through a round trip", () => {
    renderAt("register", "email=jane%40bakery.com&next=%2Fstaff-invite%2Ftok");

    fireEvent.click(toLogin());
    fireEvent.click(toRegister());

    expect(h.replace).toHaveBeenNthCalledWith(1, "/login?next=%2Fstaff-invite%2Ftok", {
      scroll: false,
    });
    expect(h.replace).toHaveBeenNthCalledWith(2, "/register?next=%2Fstaff-invite%2Ftok", {
      scroll: false,
    });
  });

  it("does nothing when the active mode is clicked again", () => {
    renderAt("register", "email=jane%40bakery.com");

    fireEvent.click(toRegister());

    expect(h.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("register-form")).toBeInTheDocument();
  });

  it("still swaps the visible form", () => {
    renderAt("register", "email=jane%40bakery.com");
    expect(screen.getByTestId("register-form")).toBeInTheDocument();

    fireEvent.click(toLogin());

    expect(screen.getByTestId("login-form")).toBeInTheDocument();
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
  });
});
