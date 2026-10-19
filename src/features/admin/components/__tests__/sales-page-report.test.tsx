import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ locale: "en", t: (key: string) => key }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { SalesPageReportView } from "../sales-page-report";
import {
  summarizeCampaigns,
  summarizeSalesPages,
  type SalesPageReport,
} from "@/lib/services/sales-page.service";

function report(overrides: Partial<SalesPageReport> = {}): SalesPageReport {
  const { pages, leader } = summarizeSalesPages([], []);
  return {
    range: "30",
    custom: null,
    lang: "all",
    since: "2026-09-19T00:00:00.000Z",
    until: null,
    pages,
    leader,
    tracked: { totalSignups: 0, rows: [], limit: 500, campaigns: summarizeCampaigns([]) },
    ...overrides,
  };
}

const hrefs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");

describe("SalesPageReportView", () => {
  afterEach(() => cleanup());

  it.each([
    ["all", "/sales-page-2?lang=fr"],
    ["fr", "/sales-page-2?lang=fr"],
    ["en", "/en/sales-page-2"],
    ["id", "/id/sales-page-2"],
  ] as const)("%s: opens each page at its public URL, never the .html file", (lang, href) => {
    const { container } = render(<SalesPageReportView report={report({ lang })} />);
    expect(hrefs(container)).toContain(href);
    expect(hrefs(container).some((h) => h.includes(".html"))).toBe(false);
  });

  it("keeps a custom range when switching language, and lights no preset tab", () => {
    const { container } = render(
      <SalesPageReportView
        report={report({ range: "custom", custom: { from: "2026-10-01", to: "2026-10-15" } })}
      />
    );
    expect(hrefs(container)).toContain(
      "/admin/sales-pages?range=custom&from=2026-10-01&to=2026-10-15&lang=en"
    );
    // (jsdom's selector engine trips on "&" inside an attribute value: find it by hand.)
    const thirty = Array.from(container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/admin/sales-pages?range=30&lang=all"
    );
    expect(thirty).toBeDefined();
    expect(thirty!.className).not.toContain("bg-amber-500/20");
    expect(container.textContent).toMatch(/1 Oct 2026 - 15 Oct 2026/);
  });

  it("offers the custom range next to the presets", () => {
    const { container } = render(<SalesPageReportView report={report()} />);
    expect(container.textContent).toContain("Custom");
  });
});
