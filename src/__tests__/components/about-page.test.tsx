import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StaticImageData } from "next/image";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { en } = await import("@/locales/en");
  const lookup = (key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
        en
      );
  return {
    useI18n: () => ({
      locale: "en",
      t: (key: string) => {
        const value = lookup(key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

import { AboutPageClient } from "@/features/marketing/about/components/about-page-client";
import { TEAM_MEMBERS, type TeamMember } from "@/features/marketing/about/data/team";

const photo: StaticImageData = { src: "/team/ada.jpg", width: 400, height: 400 };

describe("AboutPageClient", () => {
  it("has no numbers card, so no customer or usage figures can appear", () => {
    const { container } = render(<AboutPageClient />);
    const text = container.textContent ?? "";
    for (const removed of ["The numbers", "Active businesses", "500+", "10k+", "20+", "4.9"]) {
      expect(text).not.toContain(removed);
    }
  });

  it("states truthfully who builds Epidom", () => {
    render(<AboutPageClient />);
    expect(
      screen.getByText(/small product team at Prionation, working from Bali and Paris/)
    ).toBeInTheDocument();
  });

  it("ships with no team members and renders no placeholder avatars or cards", () => {
    expect(TEAM_MEMBERS).toEqual([]);
    const { container } = render(<AboutPageClient />);
    expect(screen.queryByTestId("team-members")).toBeNull();
    expect(container.querySelector("main img, img")).toBeNull();
    // The old placeholder tiles were 6 avatar SVGs with a 3-column grid.
    expect(container.querySelectorAll('svg[stroke="rgba(217,174,59,0.35)"]')).toHaveLength(0);
  });

  it("renders a card with name, role and photo for each real team member", () => {
    const team: TeamMember[] = [
      { slug: "ada", name: "Ada Example", role: "Product design", photo },
      { slug: "bo", name: "Bo Example", role: { fr: "Ingénierie", en: "Engineering" }, photo },
    ];
    render(<AboutPageClient team={team} />);
    const list = screen.getByTestId("team-members");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("Ada Example")).toBeInTheDocument();
    expect(screen.getByText("Product design")).toBeInTheDocument();
    expect(screen.getByAltText("Ada Example")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });
});
