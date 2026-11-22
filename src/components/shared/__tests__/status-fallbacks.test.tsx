import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { ErrorBoundary } from "@/components/error-boundary";
import { SectionErrorBoundary } from "../section-error-boundary";

// Both boundaries usually sit ABOVE the I18nProvider they protect, so their
// fallbacks render with no provider at all. They must still speak the
// visitor's language (the saved one, here via the legacy `locale` key) and
// must not throw.

let shouldThrow = true;
function Boom() {
  if (shouldThrow) throw new Error("boom");
  return <p>recovered</p>;
}

const CASES = [
  ["en", "Something went wrong", "Try again", "Reload page", "This section didn't load"],
  ["fr", "Une erreur est survenue", "Réessayer", "Recharger la page", "Cette section ne s'est pas chargée"],
  ["id", "Terjadi kesalahan", "Coba lagi", "Muat ulang halaman", "Bagian ini gagal dimuat"],
  ["th", "เกิดข้อผิดพลาด", "ลองอีกครั้ง", "โหลดหน้าใหม่", "โหลดส่วนนี้ไม่สำเร็จ"],
] as const;

beforeEach(() => {
  shouldThrow = true;
  window.localStorage.clear();
  // React logs the caught error; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary default fallback, outside any I18nProvider", () => {
  it.each(CASES)("%s: announces the error with one <h1> and both actions", (locale, title, retry, reload) => {
    window.localStorage.setItem("locale", locale);

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByRole("button", { name: retry })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: reload })).toBeInTheDocument();
    // No key printed raw.
    expect(document.body.textContent).not.toContain("statusPages.");
  });

  it("never letter-spaces Thai, and does space the Latin eyebrow", () => {
    window.localStorage.setItem("locale", "th");
    const thai = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    const thaiEyebrow = screen.getByText("ข้อผิดพลาดที่ไม่คาดคิด");
    expect(thaiEyebrow.className).not.toMatch(/tracking-|uppercase/);
    expect(screen.getByRole("heading", { level: 1 }).className).not.toMatch(/tracking-/);
    thai.unmount();

    window.localStorage.setItem("locale", "en");
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText("Unexpected error").className).toMatch(/tracking-/);
  });

  it("'Try again' resets the boundary", () => {
    window.localStorage.setItem("locale", "en");
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still prefers a custom fallback", () => {
    render(
      <ErrorBoundary fallback={() => <p>custom fallback</p>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText("custom fallback")).toBeInTheDocument();
  });
});

describe("SectionErrorBoundary default fallback", () => {
  it.each(CASES)("%s: translated, without the internal section name", (locale, _t, _r, reload, section) => {
    window.localStorage.setItem("locale", locale);

    render(
      <SectionErrorBoundary sectionName="Trust Bar">
        <Boom />
      </SectionErrorBoundary>
    );

    expect(screen.getByRole("status")).toHaveTextContent(section);
    expect(screen.getByRole("button", { name: reload })).toBeInTheDocument();
    // "Trust Bar" is an English label for developers, not copy.
    expect(screen.getByRole("status").textContent).not.toContain("Trust Bar");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("still prefers a custom fallback", () => {
    render(
      <SectionErrorBoundary fallback={<p>custom section fallback</p>}>
        <Boom />
      </SectionErrorBoundary>
    );
    expect(screen.getByText("custom section fallback")).toBeInTheDocument();
  });
});
