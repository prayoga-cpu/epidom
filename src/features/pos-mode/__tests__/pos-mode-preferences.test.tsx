import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const setLocale = vi.fn();
let currentLocale = "en";
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: currentLocale, setLocale }),
}));

const setTheme = vi.fn();
let resolvedTheme: string | undefined = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

import { PosModePreferences } from "../pos-mode-preferences";

describe("PosModePreferences — language", () => {
  beforeEach(() => {
    currentLocale = "en";
    resolvedTheme = "light";
  });

  it("offers French, Indonesian and English, by their own names", () => {
    render(<PosModePreferences />);
    expect(screen.getByRole("button", { name: "Français" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indonesia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
  });

  it("marks only the current language as pressed", () => {
    currentLocale = "id";
    render(<PosModePreferences />);
    expect(screen.getByRole("button", { name: "Indonesia" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Français" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("switches language in one tap", () => {
    render(<PosModePreferences />);
    fireEvent.click(screen.getByRole("button", { name: "Français" }));
    expect(setLocale).toHaveBeenCalledTimes(1);
    expect(setLocale).toHaveBeenCalledWith("fr");
  });
});

describe("PosModePreferences — dark mode", () => {
  beforeEach(() => {
    currentLocale = "en";
    resolvedTheme = "light";
  });

  it("is off in light mode and on in dark mode", () => {
    const { unmount } = render(<PosModePreferences />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    unmount();

    resolvedTheme = "dark";
    render(<PosModePreferences />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("turning it on sets the dark theme", () => {
    render(<PosModePreferences />);
    fireEvent.click(screen.getByRole("switch"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("turning it off sets the light theme", () => {
    resolvedTheme = "dark";
    render(<PosModePreferences />);
    fireEvent.click(screen.getByRole("switch"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("the whole row is the tap target — the label toggles it, not just the ~18px switch", () => {
    render(<PosModePreferences />);
    fireEvent.click(screen.getByText("common.theme.dark"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("is labelled by the row text, so assistive tech announces what the switch does", () => {
    render(<PosModePreferences />);
    expect(screen.getByLabelText("common.theme.dark")).toBe(screen.getByRole("switch"));
  });
});

describe("PosModePreferences — zoom", () => {
  beforeEach(() => {
    currentLocale = "en";
    resolvedTheme = "light";
    window.localStorage.clear();
    document.documentElement.style.zoom = "";
    document.documentElement.style.removeProperty("--app-zoom");
    document.documentElement.removeAttribute("data-app-zoomed");
  });

  // POS Mode has no topbar or account dropdown, so this card is the only place
  // a cashier can reach zoom — the browser's own is out of reach on a locked
  // viewport or an installed PWA.
  it("offers the zoom stepper next to language and dark mode", () => {
    render(<PosModePreferences />);
    expect(screen.getByText("nav.zoom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nav.zoomIn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nav.zoomOut" })).toBeInTheDocument();
  });

  it("zooms the app when a step is tapped", () => {
    render(<PosModePreferences />);
    fireEvent.click(screen.getByRole("button", { name: "nav.zoomOut" }));
    expect(document.documentElement.style.zoom).toBe("0.9");
  });
});
