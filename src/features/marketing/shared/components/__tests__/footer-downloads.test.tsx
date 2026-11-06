import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { en } from "@/locales/en";

const h = vi.hoisted(() => ({
  state: { isStandalone: false, isInstallStateKnown: true },
  show: vi.fn(),
  mounted: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) =>
      key
        .split(".")
        .reduce<unknown>(
          (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
          en
        ) as string,
  }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/pwa/pwa-install", () => ({
  usePwaInstaller: () => h.state,
  showPwaInstallDialog: h.show,
  PwaInstall: () => {
    h.mounted();
    return <div data-testid="pwa-install" />;
  },
}));

import { FooterDownloads } from "../footer-downloads";

beforeEach(() => {
  h.state = { isStandalone: false, isInstallStateKnown: true };
  h.show.mockClear();
  h.mounted.mockClear();
});

describe("FooterDownloads", () => {
  it("shows the download icon then one button per kind of device, all named, and loads no installer yet", () => {
    render(<FooterDownloads />);
    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Install: Install Epidom" })).toBeInTheDocument();
    expect(screen.queryByTestId("pwa-install")).toBeNull();
    expect(h.show).not.toHaveBeenCalled();
  });

  it("a tap mounts the installer and opens its dialog; the next tap just opens it", () => {
    render(<FooterDownloads />);
    fireEvent.click(screen.getByRole("button", { name: "Install: Phone and tablet" }));
    expect(screen.getByTestId("pwa-install")).toBeInTheDocument();
    expect(h.show).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Install: Mac and Windows" }));
    expect(h.show).toHaveBeenCalledTimes(2);
    expect(h.mounted).toHaveBeenCalled();
  });

  it("renders nothing once Epidom is installed, or before that is known", () => {
    h.state = { isStandalone: true, isInstallStateKnown: true };
    const { container, rerender } = render(<FooterDownloads />);
    expect(container).toBeEmptyDOMElement();
    h.state = { isStandalone: false, isInstallStateKnown: false };
    rerender(<FooterDownloads />);
    expect(container).toBeEmptyDOMElement();
  });
});
