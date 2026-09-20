import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted — anything a factory touches has to come from vi.hoisted.

const h = vi.hoisted(() => ({
  search: "",
  mutate: vi.fn(),
  signInSocial: vi.fn(),
}));

// Overrides the global mock from src/test/setup.ts so each test can set the
// URL's query string. A fresh URLSearchParams per call mirrors the real hook.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/register",
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useRegister: () => ({ mutate: h.mutate, isPending: false }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: h.signInSocial } },
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { RegisterForm } from "@/features/auth/register/components/register-form";
import {
  PREFILL_EMAIL_STORAGE_KEY,
  stashPrefillEmail,
} from "@/features/auth/register/lib/prefill-handoff";

// ── Helpers ──────────────────────────────────────────────────────────────────

const emailField = () => screen.getByLabelText("auth.email") as HTMLInputElement;

function renderAt(search: string) {
  h.search = search;
  return render(<RegisterForm />);
}

/** Fills everything except the email, the way a visitor arriving with a prefill would. */
function fillRest() {
  fireEvent.change(screen.getByLabelText("auth.name"), { target: { value: "Jane Baker" } });
  fireEvent.change(screen.getByLabelText("auth.password"), { target: { value: "hunter22" } });
  fireEvent.change(screen.getByLabelText("auth.confirmPassword"), {
    target: { value: "hunter22" },
  });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "auth.registerButton" }));

beforeEach(() => {
  h.search = "";
  h.mutate.mockReset();
  h.signInSocial.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/register");
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RegisterForm — ?email= prefill", () => {
  it("prefills the email field from a valid ?email=", () => {
    renderAt("email=jane%40bakery.com");

    expect(emailField()).toHaveValue("jane@bakery.com");
  });

  it("decodes a percent-encoded plus sign, the way the closing CTA encodes it", () => {
    renderAt(`email=${encodeURIComponent("jane+shop@bakery.com")}`);

    expect(emailField()).toHaveValue("jane+shop@bakery.com");
  });

  it("trims whitespace around the address", () => {
    renderAt("email=%20jane%40bakery.com%20");

    expect(emailField()).toHaveValue("jane@bakery.com");
  });

  it("leaves the other fields blank", () => {
    renderAt("email=jane%40bakery.com");

    expect(screen.getByLabelText("auth.name")).toHaveValue("");
    expect(screen.getByLabelText("auth.password")).toHaveValue("");
    expect(screen.getByLabelText("auth.confirmPassword")).toHaveValue("");
  });

  it.each([
    ["absent", ""],
    ["empty", "email="],
    ["malformed", "email=not-an-email"],
    ["missing a domain", "email=jane%40"],
    ["over 254 characters", `email=${"a".repeat(64)}%40${"b".repeat(190)}.com`],
  ])("starts blank when ?email= is %s", (_label, search) => {
    renderAt(search);

    expect(emailField()).toHaveValue("");
  });

  it.each([
    ["a script tag", "email=%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["a script tag inside an address", "email=%3Cscript%3Ealert(1)%3C%2Fscript%3E%40bakery.com"],
    ["an attribute breakout", "email=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E%40bakery.com"],
    ["a javascript: url", "email=javascript%3Aalert(1)"],
  ])("ignores %s and injects nothing into the page", (_label, search) => {
    const { container } = renderAt(search);

    expect(emailField()).toHaveValue("");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("keeps the field fully editable", () => {
    renderAt("email=jane%40bakery.com");
    const field = emailField();

    expect(field).not.toBeDisabled();
    expect(field).not.toHaveAttribute("readonly");

    fireEvent.change(field, { target: { value: "other@bakery.com" } });
    expect(field).toHaveValue("other@bakery.com");

    fireEvent.change(field, { target: { value: "" } });
    expect(field).toHaveValue("");
  });

  it("never submits on its own", async () => {
    renderAt("email=jane%40bakery.com");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.signInSocial).not.toHaveBeenCalled();
  });

  it("does not move focus", () => {
    renderAt("email=jane%40bakery.com");

    expect(document.activeElement).toBe(document.body);
  });

  it("neither logs nor persists the address", () => {
    const address = "jane@bakery.com";
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const consoleSpies = (["log", "info", "debug", "warn", "error"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    );

    renderAt(`email=${encodeURIComponent(address)}`);
    fireEvent.change(emailField(), { target: { value: "other@bakery.com" } });

    expect(setItem).not.toHaveBeenCalled();
    const logged = consoleSpies.flatMap((spy) => spy.mock.calls.flat().map(String)).join(" ");
    expect(logged).not.toContain(address);
    expect(logged).not.toContain("other@bakery.com");
    expect(document.cookie).not.toContain("bakery");
  });

  it("submits the prefilled address once the visitor fills the rest and submits", async () => {
    renderAt("email=jane%40bakery.com");
    fillRest();
    submit();

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Jane Baker", email: "jane@bakery.com" })
    );
  });

  it("submits an edited address, not the prefilled one", async () => {
    renderAt("email=jane%40bakery.com");
    fireEvent.change(emailField(), { target: { value: "other@bakery.com" } });
    fillRest();
    submit();

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ email: "other@bakery.com" })
    );
  });
});

describe("RegisterForm — the address handed over from the CTA through sessionStorage", () => {
  const storedNow = () => window.sessionStorage.getItem(PREFILL_EMAIL_STORAGE_KEY);

  it("prefills the email field from the stashed address", async () => {
    stashPrefillEmail("jane@bakery.com");

    renderAt("");

    await waitFor(() => expect(emailField()).toHaveValue("jane@bakery.com"));
  });

  it("reads it once: the entry is removed as soon as the form has taken it", async () => {
    stashPrefillEmail("jane@bakery.com");

    const first = renderAt("");
    await waitFor(() => expect(emailField()).toHaveValue("jane@bakery.com"));
    expect(storedNow()).toBeNull();

    // A second mount (a toggle away and back, a refresh) finds nothing to prefill.
    first.unmount();
    renderAt("");
    expect(emailField()).toHaveValue("");
  });

  it("keeps the address out of the URL entirely", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    stashPrefillEmail("jane@bakery.com");

    renderAt("");
    await waitFor(() => expect(emailField()).toHaveValue("jane@bakery.com"));

    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("jane");
  });

  it("trims the stashed address like the URL prefill does", async () => {
    stashPrefillEmail("  jane@bakery.com  ");

    renderAt("");

    await waitFor(() => expect(emailField()).toHaveValue("jane@bakery.com"));
  });

  it.each([
    ["malformed", "not-an-email"],
    ["empty", ""],
    ["a script tag", "<script>alert(1)</script>@bakery.com"],
    ["an attribute breakout", '"><img src=x onerror=alert(1)>@bakery.com'],
    ["a javascript: url", "javascript:alert(1)"],
    ["over 254 characters", `${"a".repeat(64)}@${"b".repeat(190)}.com`],
  ])("ignores a stashed value that is %s, and still removes it", async (_label, value) => {
    window.sessionStorage.setItem(PREFILL_EMAIL_STORAGE_KEY, value);

    const { container } = renderAt("");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emailField()).toHaveValue("");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(storedNow()).toBeNull();
  });

  it("opens blank when nothing was stashed", () => {
    renderAt("");

    expect(emailField()).toHaveValue("");
  });

  it("opens blank, without crashing, when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    renderAt("");

    expect(emailField()).toHaveValue("");
  });

  it("does not overwrite an address already in the field (a legacy ?email= wins) and still clears the stash", async () => {
    stashPrefillEmail("stashed@bakery.com");

    renderAt("email=jane%40bakery.com");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emailField()).toHaveValue("jane@bakery.com");
    expect(storedNow()).toBeNull();
  });

  it("leaves the field editable and never submits on its own", async () => {
    stashPrefillEmail("jane@bakery.com");

    renderAt("");
    await waitFor(() => expect(emailField()).toHaveValue("jane@bakery.com"));

    expect(emailField()).not.toBeDisabled();
    expect(emailField()).not.toHaveAttribute("readonly");
    fireEvent.change(emailField(), { target: { value: "other@bakery.com" } });
    expect(emailField()).toHaveValue("other@bakery.com");
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("submits the stashed address once the visitor fills the rest", async () => {
    stashPrefillEmail("jane@bakery.com");

    renderAt("");
    await waitFor(() => expect(emailField()).toHaveValue("jane@bakery.com"));
    fillRest();
    submit();

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Jane Baker", email: "jane@bakery.com" })
    );
  });
});

describe("RegisterForm — a legacy ?email= is stripped from the address bar once read", () => {
  it("removes ?email= and keeps every other param (next, callbackUrl, campaign tags)", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    renderAt("utm_source=newsletter&email=jane%40bakery.com&next=%2Fstaff-invite%2Ftok");

    // Still prefilled from it ...
    expect(emailField()).toHaveValue("jane@bakery.com");
    // ... but it no longer sits in the URL, and the rest of the query is untouched.
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/register?utm_source=newsletter&next=%2Fstaff-invite%2Ftok"
    );
    expect(window.location.search).not.toContain("email");
    expect(window.location.search).toContain("next=%2Fstaff-invite%2Ftok");
  });

  it("leaves the bare path when ?email= was the only param", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    renderAt("email=jane%40bakery.com");

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/register");
    expect(window.location.href).not.toContain("email");
  });

  it("keeps the hash", () => {
    window.history.replaceState(null, "", "/register?email=jane%40bakery.com#top");
    const replaceState = vi.spyOn(window.history, "replaceState");

    renderAt("email=jane%40bakery.com");

    expect(replaceState).toHaveBeenCalledWith(null, "", "/register#top");
  });

  it.each([
    ["malformed", "email=not-an-email"],
    ["a script tag", "email=%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["empty", "email="],
  ])("strips it when it is %s too, and the field stays blank", (_label, search) => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    renderAt(search);

    expect(emailField()).toHaveValue("");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/register");
  });

  it("does not touch the URL when there is no ?email=", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    renderAt("next=%2Fstaff-invite%2Ftok");

    expect(replaceState).not.toHaveBeenCalled();
  });

  it("strips it once, however many times the form re-renders", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    renderAt("email=jane%40bakery.com");
    fireEvent.change(emailField(), { target: { value: "other@bakery.com" } });
    fireEvent.change(screen.getByLabelText("auth.name"), { target: { value: "Jane" } });

    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});

describe("RegisterForm — ?next= handling is unchanged", () => {
  it("still passes a safe ?next= as the post-verify callbackURL", async () => {
    renderAt("next=%2Ftransfer-ownership%2Fabc");
    fillRest();
    fireEvent.change(emailField(), { target: { value: "jane@bakery.com" } });
    submit();

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ callbackURL: "/transfer-ownership/abc" })
    );
  });

  it("honours ?next= and ?email= together", async () => {
    renderAt("email=jane%40bakery.com&next=%2Fstaff-invite%2Ftok");

    expect(emailField()).toHaveValue("jane@bakery.com");
    expect(screen.getByRole("link", { name: "auth.loginButton" })).toHaveAttribute(
      "href",
      "/login?next=%2Fstaff-invite%2Ftok"
    );

    fillRest();
    submit();

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ email: "jane@bakery.com", callbackURL: "/staff-invite/tok" })
    );
  });

  it("still drops an unsafe ?next= while prefilling the email", async () => {
    renderAt("email=jane%40bakery.com&next=%2F%2Fevil.com");

    expect(emailField()).toHaveValue("jane@bakery.com");
    expect(screen.getByRole("link", { name: "auth.loginButton" })).toHaveAttribute(
      "href",
      "/login"
    );

    fillRest();
    submit();

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).not.toHaveProperty("callbackURL");
  });
});

describe("RegisterForm — Google sign-up is unaffected by a prefill", () => {
  it("still sends new visitors to /onboarding", async () => {
    renderAt("email=jane%40bakery.com");
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    await waitFor(() => expect(h.signInSocial).toHaveBeenCalledTimes(1));
    expect(h.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/onboarding",
    });
  });

  it("still sends a deep-linked visitor to their ?next= path", async () => {
    renderAt("email=jane%40bakery.com&next=%2Fstaff-invite%2Ftok");
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    await waitFor(() => expect(h.signInSocial).toHaveBeenCalledTimes(1));
    expect(h.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/staff-invite/tok",
    });
  });
});
