import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

const h = vi.hoisted(() => ({ search: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => h.search,
}));

import { CheckoutFailedContent } from "../checkout-failed-content";

const DICTS = { en, fr, id } as const;
const SESSION = "cs_test_a1B2c3D4";

/** The real provider and dictionaries, so the language on screen is what a visitor gets. */
function renderIn(locale: Locale, query: string) {
  h.search = new URLSearchParams(query);
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <CheckoutFailedContent />
    </EagerI18nProvider>
  );
}

function leafStrings(node: unknown, into = new Set<string>()): Set<string> {
  if (typeof node === "string") into.add(node);
  else if (node && typeof node === "object") {
    for (const value of Object.values(node)) leafStrings(value, into);
  }
  return into;
}

function textNodes(root: HTMLElement): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) found.push(text);
  }
  return found;
}

beforeEach(() => {
  h.search = new URLSearchParams();
});

describe("checkout.failed.sessionId", () => {
  it("is 'Session ID', 'ID de session' and 'ID Sesi'", () => {
    expect(en.checkout.failed.sessionId).toBe("Session ID");
    expect(fr.checkout.failed.sessionId).toBe("ID de session");
    expect(id.checkout.failed.sessionId).toBe("ID Sesi");
  });
});

describe("CheckoutFailedContent session label", () => {
  it.each(["en", "fr", "id"] as const)("is printed in %s", (locale) => {
    const { container } = renderIn(locale, `session_id=${SESSION}`);
    const texts = textNodes(container);

    expect(texts).toContain(DICTS[locale].checkout.failed.sessionId);
    expect(texts).toContain(SESSION);
  });

  it("no longer shows the Indonesian label to English or French visitors", () => {
    for (const locale of ["en", "fr"] as const) {
      const { container, unmount } = renderIn(locale, `session_id=${SESSION}`);
      expect(textNodes(container)).not.toContain("ID Sesi");
      unmount();
    }
  });

  it("is still the Indonesian label for Indonesian visitors", () => {
    const { container } = renderIn("id", `session_id=${SESSION}`);

    expect(textNodes(container)).toContain("ID Sesi");
  });

  it("is left out, with the id, when the URL carries no session", () => {
    const { container } = renderIn("fr", "reason=canceled");
    const texts = textNodes(container);

    expect(texts).not.toContain(fr.checkout.failed.sessionId);
    expect(texts).not.toContain("ID Sesi");
  });
});

describe("CheckoutFailedContent language", () => {
  it.each(["en", "fr", "id"] as const)(
    "prints nothing but %s copy (and the session id itself)",
    (locale) => {
      const { container } = renderIn(locale, `reason=payment_failed&session_id=${SESSION}`);
      const dictionary = leafStrings(DICTS[locale]);

      const strangers = textNodes(container).filter(
        (text) => !dictionary.has(text) && text !== SESSION
      );
      expect(strangers, `not in the ${locale} dictionary: ${strangers.join(" | ")}`).toEqual([]);
    }
  );
});
