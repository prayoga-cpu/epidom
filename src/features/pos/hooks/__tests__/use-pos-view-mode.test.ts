import { describe, it, expect, beforeEach } from "vitest";
import { usePosViewMode } from "../use-pos-view-mode";

beforeEach(() => {
  localStorage.clear();
  usePosViewMode.setState({ viewMode: "grid" });
});

describe("usePosViewMode", () => {
  it("defaults to the image grid", () => {
    expect(usePosViewMode.getState().viewMode).toBe("grid");
  });

  it("persists the choice per device under epidom-pos-view-mode", () => {
    usePosViewMode.getState().setViewMode("list");
    expect(usePosViewMode.getState().viewMode).toBe("list");
    const stored = JSON.parse(localStorage.getItem("epidom-pos-view-mode") ?? "null");
    expect(stored.state.viewMode).toBe("list");
  });

  it("restores a saved mode", async () => {
    localStorage.setItem(
      "epidom-pos-view-mode",
      JSON.stringify({ state: { viewMode: "columns" }, version: 0 })
    );
    await usePosViewMode.persist.rehydrate();
    expect(usePosViewMode.getState().viewMode).toBe("columns");
  });

  it("ignores a value it doesn't recognise instead of rendering nothing", async () => {
    localStorage.setItem(
      "epidom-pos-view-mode",
      JSON.stringify({ state: { viewMode: "carousel" }, version: 0 })
    );
    await usePosViewMode.persist.rehydrate();
    expect(usePosViewMode.getState().viewMode).toBe("grid");
  });
});
