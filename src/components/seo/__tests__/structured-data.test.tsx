import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  OrganizationStructuredData,
  ProductStructuredData,
  WebsiteStructuredData,
} from "../structured-data";

/** The JSON-LD object a component put in its <script type="application/ld+json">. */
function jsonLdOf(ui: ReactElement): Record<string, unknown> {
  const { container } = render(ui);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "");
}

describe("site-wide JSON-LD only states what the site can back up", () => {
  it("WebSite declares no SearchAction: there is no /search page", () => {
    const data = jsonLdOf(<WebsiteStructuredData />);
    expect(data["@type"]).toBe("WebSite");
    expect(data).not.toHaveProperty("potentialAction");
    expect(JSON.stringify(data)).not.toMatch(/search_term_string|\/search/);
  });

  it("no site-wide entity carries a founding date", () => {
    for (const ui of [
      <WebsiteStructuredData key="w" />,
      <OrganizationStructuredData key="o" />,
      <ProductStructuredData key="p" />,
    ]) {
      expect(jsonLdOf(ui)).not.toHaveProperty("foundingDate");
    }
  });

  it("Organization keeps its real details", () => {
    const data = jsonLdOf(<OrganizationStructuredData />);
    expect(data["@type"]).toBe("Organization");
    expect(data.url).toBe("https://epidom.fr");
    expect(data.parentOrganization).toMatchObject({ name: "Prionation" });
  });
});
