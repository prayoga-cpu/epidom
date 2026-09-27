/**
 * The lazy Help sheet when its chunk can't load (offline, never fetched on this
 * device): it must close with a toast, not throw to the POS shell's error
 * boundary and swap the whole till for an error screen.
 */
import { Component, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// What a chunk that can't be fetched looks like to the importer.
vi.mock("../help-sheet", () => {
  const error = new Error("Failed to load chunk /_next/static/chunks/help.js from module 1");
  error.name = "ChunkLoadError";
  throw error;
});

import { LazyHelpSheet } from "../help-sheet-loader";

/** Stands in for the POS shell's ErrorBoundary / the route's error.tsx. */
class ShellBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    return this.state.crashed ? <p>shell crashed</p> : this.props.children;
  }
}

function Till() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p>till screen</p>
      <button type="button" onClick={() => setOpen(true)}>
        help
      </button>
      <span data-testid="open-state">{String(open)}</span>
      {open && <LazyHelpSheet storeId="s1" open={open} onOpenChange={setOpen} />}
    </div>
  );
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  toast.error.mockReset();
  // React reports the caught error on the console; that is expected here.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe("LazyHelpSheet — a chunk that can't load", () => {
  it("closes with a toast and leaves the till on screen", async () => {
    render(
      <ShellBoundary>
        <Till />
      </ShellBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "help" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("helpCenter.loadFailed"), {
      timeout: 5000,
    });
    expect(screen.queryByText("shell crashed")).toBeNull();
    expect(screen.getByText("till screen")).toBeInTheDocument();
    expect(screen.getByTestId("open-state")).toHaveTextContent("false");
  });

  it("tries again on the next tap instead of staying stuck", async () => {
    render(
      <ShellBoundary>
        <Till />
      </ShellBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "help" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1), { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: "help" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(screen.queryByText("shell crashed")).toBeNull();
  });
});
