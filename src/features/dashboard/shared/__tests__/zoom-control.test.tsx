import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

import { ZoomControl } from "../zoom-control";
import { ZOOM_STORAGE_KEY } from "@/lib/app-zoom";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

const zoomIn = () => screen.getByRole("button", { name: "nav.zoomIn" });
const zoomOut = () => screen.getByRole("button", { name: "nav.zoomOut" });

describe("ZoomControl", () => {
  beforeEach(() => {
    setViewportWidth(1024);
    window.localStorage.clear();
    document.documentElement.style.zoom = "";
    document.documentElement.style.removeProperty("--app-zoom");
    document.documentElement.removeAttribute("data-app-zoomed");
  });

  afterEach(() => {
    setViewportWidth(1024);
  });

  describe("on a screen wide enough for every level", () => {
    it("steps up and down, showing the level it is at", () => {
      render(<ZoomControl />);
      expect(screen.getByText("100%")).toBeInTheDocument();

      fireEvent.click(zoomIn());
      expect(screen.getByText(/^110%/)).toBeInTheDocument();
      expect(document.documentElement.style.zoom).toBe("1.1");

      fireEvent.click(zoomOut());
      fireEvent.click(zoomOut());
      expect(screen.getByText(/^90%/)).toBeInTheDocument();
    });

    it("returns to 100% from the readout", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "125");
      render(<ZoomControl />);
      fireEvent.click(screen.getByRole("button", { name: /125%/ }));
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(document.documentElement.style.zoom).toBe("");
    });

    it("disables + at the top of the ladder without explaining itself", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");
      render(<ZoomControl />);
      expect(zoomIn()).toBeDisabled();
      // 150% is the ladder's own limit here, not the screen's — nothing to explain.
      expect(screen.queryByText("nav.zoomLimit")).not.toBeInTheDocument();
    });
  });

  describe("on a phone", () => {
    beforeEach(() => setViewportWidth(390));

    // Zooming a 390px screen in leaves the layout narrower than the 375px it is
    // built for, so + is unavailable — and the control says why, instead of
    // looking like it doesn't work on mobile.
    it("cannot zoom in past 100%, and explains why", () => {
      render(<ZoomControl />);
      expect(zoomIn()).toBeDisabled();
      expect(screen.getByText("nav.zoomLimit")).toBeInTheDocument();
    });

    it("can still zoom out, which frees zooming back in", () => {
      render(<ZoomControl />);
      fireEvent.click(zoomOut());
      expect(screen.getByText(/^90%/)).toBeInTheDocument();
      expect(document.documentElement.style.zoom).toBe("0.9");
      expect(zoomIn()).toBeEnabled();
      // Below the ceiling the limit is not what is stopping anyone.
      expect(screen.queryByText("nav.zoomLimit")).not.toBeInTheDocument();
    });

    it("shows the zoom actually in effect, not a saved one that does not fit", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");
      render(<ZoomControl />);
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(zoomIn()).toBeDisabled();
    });

    it("steps down from the effective zoom, not the unreachable saved one", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");
      render(<ZoomControl />);
      fireEvent.click(zoomOut());
      // 100 -> 90, not 150 -> 125 (which the screen would clamp straight back to 100).
      expect(screen.getByText(/^90%/)).toBeInTheDocument();
      expect(window.localStorage.getItem(ZOOM_STORAGE_KEY)).toBe("90");
    });
  });

  it("re-reads the ceiling when the screen is resized while it is open", () => {
    render(<ZoomControl />);
    expect(zoomIn()).toBeEnabled();

    setViewportWidth(390);
    fireEvent(window, new Event("resize"));

    expect(zoomIn()).toBeDisabled();
    expect(screen.getByText("nav.zoomLimit")).toBeInTheDocument();
  });

  describe("label placement", () => {
    it("stacked (default): the label sits above the stepper", () => {
      render(<ZoomControl />);
      expect(screen.getByText("nav.zoom")).toBeInTheDocument();
    });

    it("inline: the label sits beside the stepper", () => {
      render(<ZoomControl label="inline" />);
      expect(screen.getByText("nav.zoom")).toBeInTheDocument();
      expect(zoomIn()).toBeInTheDocument();
      expect(zoomOut()).toBeInTheDocument();
    });

    it("none: the stepper alone, so a caller can draw its own label", () => {
      render(<ZoomControl label="none" />);
      expect(screen.queryByText("nav.zoom")).not.toBeInTheDocument();
      expect(zoomIn()).toBeInTheDocument();
    });
  });
});
