import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// ── Mocks ────────────────────────────────────────────────────────────────────
// The real I18nProvider and the real dictionaries are used on purpose: this file
// is about which language the two forms actually print.

const h = vi.hoisted(() => ({
  search: "",
  pending: false,
  mutate: vi.fn(),
  signInSocial: vi.fn(),
  sendVerificationEmail: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ push: vi.fn(), replace: h.replace }),
  usePathname: () => "/login",
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useLogin: () => ({ mutate: h.mutate, isPending: h.pending, error: null }),
  useRegister: () => ({ mutate: h.mutate, isPending: h.pending }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: h.signInSocial },
    sendVerificationEmail: h.sendVerificationEmail,
  },
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/features/auth/components/auth-visual", () => ({ AuthVisual: () => null }));

import { LoginForm } from "@/features/auth/login/components/login-form";
import { RegisterForm } from "@/features/auth/register/components/register-form";
import { AuthPage } from "@/features/auth/components/auth-page";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DICTS = { en, fr, id } as const;
const LOCALES = ["fr", "id"] as const;

/** Brand text, the same in every language. Nothing else may be exempt. */
const BRAND_TEXT = new Set(["Google"]);

/** The auth keys this work moved out of the JSX, with the English they replaced. */
const MOVED = {
  orContinueWithEmail: "Or continue with email",
  creatingAccount: "Creating account...",
} as const;

function leafStrings(node: unknown, into = new Set<string>()): Set<string> {
  if (typeof node === "string") into.add(node);
  else if (node && typeof node === "object") {
    for (const value of Object.values(node)) leafStrings(value, into);
  }
  return into;
}

/** Everything a visitor can read or hear: text nodes plus the text-bearing attributes. */
function visibleStrings(root: HTMLElement): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) found.push(text);
  }
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of ["placeholder", "aria-label", "title", "alt"]) {
      const value = el.getAttribute(attr)?.trim();
      if (value) found.push(value);
    }
  });
  return found;
}

function renderIn(locale: Locale, ui: React.ReactElement, search = "") {
  h.search = search;
  return render(<EagerI18nProvider initialLocale={locale}>{ui}</EagerI18nProvider>);
}

/** Flips the provider's language while the form stays mounted, the way the language switcher does. */
function SwitchToIndonesian() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("id")}>
      switch-to-id
    </button>
  );
}

const submitForm = (container: HTMLElement) =>
  // fireEvent.submit skips the browser's own type="email" check, so zod's messages are reached.
  fireEvent.submit(container.querySelector("form")!);

beforeEach(() => {
  h.search = "";
  h.pending = false;
  h.mutate.mockReset();
  h.signInSocial.mockReset();
  h.sendVerificationEmail.mockReset();
  h.replace.mockReset();
});

// ── The moved strings ────────────────────────────────────────────────────────

describe("the strings moved out of the forms", () => {
  it.each(Object.keys(MOVED) as (keyof typeof MOVED)[])(
    "auth.%s is translated in fr and id, and the English is unchanged",
    (key) => {
      expect(en.auth[key]).toBe(MOVED[key]);
      expect(fr.auth[key]).toBeTruthy();
      expect(id.auth[key]).toBeTruthy();
      expect(fr.auth[key]).not.toBe(en.auth[key]);
      expect(id.auth[key]).not.toBe(en.auth[key]);
    }
  );
});

// ── Both forms, every visible string ─────────────────────────────────────────

describe.each([
  ["LoginForm", () => <LoginForm />],
  ["RegisterForm", () => <RegisterForm />],
] as const)("%s", (_name, ui) => {
  it("prints the English copy it always did in en", () => {
    const { container } = renderIn("en", ui());

    expect(visibleStrings(container)).toContain(MOVED.orContinueWithEmail);
  });

  it.each(LOCALES)("shows nothing in English to a %s visitor", (locale) => {
    const { container } = renderIn(locale, ui());
    const texts = visibleStrings(container);
    const dictionary = leafStrings(DICTS[locale]);

    // Every string on screen is either that language's own copy or brand text ...
    const strangers = texts.filter((text) => !dictionary.has(text) && !BRAND_TEXT.has(text));
    expect(strangers, `not in the ${locale} dictionary: ${strangers.join(" | ")}`).toEqual([]);

    // ... and the separator, the string that used to be hardcoded, is the translated one.
    expect(texts).toContain(DICTS[locale].auth.orContinueWithEmail);
    expect(texts).not.toContain(en.auth.orContinueWithEmail);
    expect(texts).toContain("Google");
  });

  it.each(LOCALES)("has no English placeholder left in %s", (locale) => {
    const { container } = renderIn(locale, ui());
    const placeholders = Array.from(container.querySelectorAll("input"))
      .map((input) => input.getAttribute("placeholder"))
      .filter(Boolean);

    expect(placeholders).toContain(DICTS[locale].auth.emailPlaceholder);
    for (const placeholder of placeholders) {
      expect(["you@bakery.com", "name@company.com", "Jane Baker"]).not.toContain(placeholder);
    }
  });
});

// ── The button that only shows while a sign-up is in flight ──────────────────

describe("RegisterForm while the account is being created", () => {
  it("says so in en, exactly as before", () => {
    h.pending = true;
    renderIn("en", <RegisterForm />);

    expect(screen.getByRole("button", { name: MOVED.creatingAccount })).toBeDisabled();
  });

  it.each(LOCALES)("says so in %s", (locale) => {
    h.pending = true;
    const { container } = renderIn(locale, <RegisterForm />);
    const texts = visibleStrings(container);

    expect(screen.getByRole("button", { name: DICTS[locale].auth.creatingAccount })).toBeDisabled();
    expect(texts).not.toContain(en.auth.creatingAccount);
    expect(texts.filter((t) => !leafStrings(DICTS[locale]).has(t) && !BRAND_TEXT.has(t))).toEqual(
      []
    );
  });
});

describe("LoginForm while the login is in flight", () => {
  it.each(LOCALES)("says so in %s", (locale) => {
    h.pending = true;
    renderIn(locale, <LoginForm />);

    expect(screen.getByRole("button", { name: DICTS[locale].messages.loggingIn })).toBeDisabled();
    expect(screen.queryByText(en.messages.loggingIn)).not.toBeInTheDocument();
  });
});

// ── Validation messages, the other place English used to leak in ─────────────

describe("RegisterForm validation messages", () => {
  it("are the shipped English in en", async () => {
    const { container } = renderIn("en", <RegisterForm />);
    submitForm(container);

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByText("Please confirm your password")).toBeInTheDocument();
  });

  it.each(LOCALES)("are in %s when the form is empty", async (locale) => {
    const dict = DICTS[locale].auth.validation;
    const { container } = renderIn(locale, <RegisterForm />);
    submitForm(container);

    expect(await screen.findByText(dict.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(dict.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(dict.passwordRequired)).toBeInTheDocument();
    expect(screen.getByText(dict.confirmPasswordRequired)).toBeInTheDocument();
    expect(screen.queryByText(en.auth.validation.nameRequired)).not.toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it.each(LOCALES)("are in %s for a short, mismatched password", async (locale) => {
    const { container } = renderIn(locale, <RegisterForm />);
    fireEvent.change(screen.getByLabelText(DICTS[locale].auth.name), { target: { value: "J" } });
    fireEvent.change(screen.getByLabelText(DICTS[locale].auth.email), {
      target: { value: "nope" },
    });
    fireEvent.change(screen.getByLabelText(DICTS[locale].auth.password), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByLabelText(DICTS[locale].auth.confirmPassword), {
      target: { value: "abd" },
    });
    submitForm(container);

    const dict = DICTS[locale].auth.validation;
    expect(await screen.findByText(dict.nameTooShort.replace("{min}", "2"))).toBeInTheDocument();
    expect(screen.getByText(dict.emailInvalid)).toBeInTheDocument();
    expect(screen.getByText(dict.passwordTooShort.replace("{min}", "8"))).toBeInTheDocument();
    expect(screen.getByText(DICTS[locale].messages.passwordsDoNotMatch)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[{}]/);
  });

  it("follow the visitor when the language changes while the form is open", async () => {
    // A schema built once, for the first language, must not keep speaking it.
    const { container } = renderIn(
      "fr",
      <>
        <SwitchToIndonesian />
        <RegisterForm />
      </>
    );
    submitForm(container);
    expect(await screen.findByText(fr.auth.validation.nameRequired)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch-to-id" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: id.auth.registerButton })).toBeInTheDocument()
    );
    submitForm(container);

    expect(await screen.findByText(id.auth.validation.nameRequired)).toBeInTheDocument();
    expect(screen.queryByText(fr.auth.validation.nameRequired)).not.toBeInTheDocument();
  });
});

describe("LoginForm validation messages", () => {
  it("are the shipped English in en", async () => {
    const { container } = renderIn("en", <LoginForm />);
    submitForm(container);

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it.each(LOCALES)("are in %s", async (locale) => {
    const dict = DICTS[locale].auth.validation;
    const { container } = renderIn(locale, <LoginForm />);
    submitForm(container);

    expect(await screen.findByText(dict.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(dict.passwordRequired)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(DICTS[locale].auth.email), {
      target: { value: "nope" },
    });
    fireEvent.change(screen.getByLabelText(DICTS[locale].auth.password), {
      target: { value: "abc" },
    });
    submitForm(container);

    await waitFor(() => expect(screen.getByText(dict.emailInvalid)).toBeInTheDocument());
    // Sign-in has no length floor (that is a sign-up rule), so a short password is not flagged.
    expect(screen.queryByText(dict.passwordTooShort.replace("{min}", "8"))).not.toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });
});

// ── The notice a login attempt can raise ─────────────────────────────────────

describe("LoginForm unverified-email notice", () => {
  it.each(LOCALES)("and its resend button are in %s", async (locale) => {
    // The server refuses the login because the address is not verified yet.
    h.mutate.mockImplementation((_data, options) =>
      options.onError(new Error("Email not verified"))
    );
    h.sendVerificationEmail.mockResolvedValue({ error: null });
    const dict = DICTS[locale];
    const { container } = renderIn(locale, <LoginForm />);

    fireEvent.change(screen.getByLabelText(dict.auth.email), {
      target: { value: "jane@bakery.com" },
    });
    fireEvent.change(screen.getByLabelText(dict.auth.password), { target: { value: "hunter22" } });
    submitForm(container);

    expect(await screen.findByText(dict.auth.verifyEmail.notice)).toBeInTheDocument();
    expect(screen.getByText(dict.auth.verifyEmail.checkYourEmail)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: dict.auth.verifyEmail.resendButton }));
    expect(
      await screen.findByRole("button", { name: dict.auth.verifyEmail.resendSuccess })
    ).toBeDisabled();

    const dictionary = leafStrings(dict);
    const strangers = visibleStrings(container).filter(
      (text) => !dictionary.has(text) && !BRAND_TEXT.has(text)
    );
    expect(strangers, `not in the ${locale} dictionary: ${strangers.join(" | ")}`).toEqual([]);
  });
});

// ── The page shell around the forms ──────────────────────────────────────────

describe("AuthPage footer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["en", "fr", "id"] as const)("prints the %s copyright line", (locale) => {
    // Only Date is faked, so React and Testing Library keep their real timers. A year that
    // is not this year's proves the number is computed, not typed into the JSX (it was 2025).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));

    const { container } = renderIn(locale, <AuthPage initialMode="register" />);

    expect(visibleStrings(container)).toContain(
      DICTS[locale].auth.copyright.replace("{year}", "2031")
    );
    expect(container.textContent).not.toContain("{year}");
    expect(container.textContent).not.toContain("2025");
  });

  it("keeps the shipped English wording", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));

    const { container } = renderIn("en", <AuthPage initialMode="login" />);

    expect(visibleStrings(container)).toContain("© 2031 Epidom. All rights reserved.");
  });

  it("carries ?next= but not a legacy ?email= across the toggle with the real forms mounted", () => {
    // Deliberate change: the address is personal data, so the toggle no longer copies it.
    renderIn(
      "fr",
      <AuthPage initialMode="register" />,
      "email=jane%40bakery.com&next=%2Fstaff-invite%2Ftok"
    );

    fireEvent.click(screen.getByRole("button", { name: fr.auth.loginButton }));

    expect(h.replace).toHaveBeenCalledWith("/login?next=%2Fstaff-invite%2Ftok", {
      scroll: false,
    });
  });
});

// ── Guard: no English fallback creeps back into the source ───────────────────

describe("the form sources", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), "src/features/auth", path), "utf8");

  it.each([
    "login/components/login-form.tsx",
    "register/components/register-form.tsx",
    "components/auth-page.tsx",
  ])('%s has no t(...) || "English" fallback and no bare English label', (path) => {
    const source = read(path);

    // A fallback like t("x") || "Some English" is dead code today (t() never returns "")
    // and the first place a hardcoded English string hides.
    expect(source).not.toMatch(/\bt\([^)]*\)\s*\|\|\s*["'`]/);
    for (const english of Object.values(MOVED)) expect(source).not.toContain(english);
    expect(source).not.toContain("All rights reserved");
  });
});
