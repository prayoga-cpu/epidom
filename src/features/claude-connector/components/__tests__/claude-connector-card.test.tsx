import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { en } from "@/locales/en";

/**
 * The connector is a beta: the card says so, and lists what works and what
 * stays in the app, for a locked account too (it is also the pitch).
 */

const connected = vi.hoisted(() => ({
  data: {
    connectorUrl: "https://www.epidom.fr/api/mcp",
    stores: [{ storeId: "s1", name: "Paris 11", connectorEnabled: false, connectorWriteEnabled: false }],
    apps: [],
  },
}));

vi.mock("../../hooks/use-connected-apps", () => ({
  useConnectedApps: () => ({
    data: connected.data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isRefetching: false,
  }),
  useRevokeConnectedApp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/ui/use-confirm", () => ({
  useConfirm: () => ({ confirm: vi.fn(), confirmDialog: null }),
}));

vi.mock("@/components/lang/i18n-provider", () => {
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
      t: (key: string) => {
        const value = lookup(key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

import { ClaudeConnectorCard } from "../claude-connector-card";

describe("ClaudeConnectorCard beta", () => {
  it("labels the card Beta and lists what works and what doesn't, even when locked", () => {
    render(<ClaudeConnectorCard />);
    expect(screen.getByText("Beta")).toBeTruthy();
    // Locked (no Operations store): the pitch still shows.
    expect(screen.getByText(en.claudeConnector.card.lockedBody)).toBeTruthy();

    const details = screen.getByText("What works in this beta").closest("details")!;
    const lists = within(details).getAllByRole("list");
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(4);
    expect(within(lists[1]).getAllByRole("listitem")).toHaveLength(4);
    expect(within(details).getByText(/Taking payments, refunds/)).toBeTruthy();
    expect(within(details).getByRole("link", { name: "Tell us" }).getAttribute("href")).toBe(
      "/contact"
    );
  });
});
