import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

// The global setup's router mock builds a fresh push() per call, so it can't be asserted on.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const mockStores = vi.fn();
vi.mock("@/features/stores/stores/hooks/use-stores", () => ({
  useStores: () => mockStores(),
}));

vi.mock("../hooks/use-current-store", () => ({
  useCurrentStore: () => ({ store: { id: "store-001", name: "Alpha" }, storeId: "store-001" }),
}));

vi.mock("@/features/dashboard/profile/hooks/use-default-landing", () => ({
  useDefaultLanding: () => "dashboard",
}));

vi.mock("@/features/pos/hooks/use-pos-session", () => ({
  usePosSession: () => ({ isActive: false }),
}));

import { StoreSwitcher } from "../store-switcher";

const ALPHA = { id: "store-001", name: "Alpha", city: "Paris" };
const BETA = { id: "store-002", name: "Beta", city: null };

/** Radix opens a dropdown on pointer-down or Enter, never on a synthetic click. */
function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "dashboard.storeSelector.label" }), {
    key: "Enter",
  });
}

describe("StoreSwitcher", () => {
  beforeEach(() => {
    push.mockClear();
    mockStores.mockReturnValue({ data: [ALPHA, BETA], isLoading: false });
  });

  it("opens a plain list with no search field, so a phone doesn't raise its keyboard", () => {
    render(<StoreSwitcher />);
    openMenu();

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("menuitem", { name: /Alpha/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("menuitem", { name: /Beta/ })).not.toHaveAttribute("aria-current");
  });

  it("opens above the phone menu drawer (Sheet is z-[70]), not under it", () => {
    render(<StoreSwitcher />);
    openMenu();

    expect(screen.getByRole("menu").className).toContain("z-[80]");
    expect(screen.getByRole("menu").className).not.toMatch(/(^|\s)z-50(\s|$)/);
  });

  it("goes to the chosen store's default landing page", () => {
    render(<StoreSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Beta/ }));

    expect(push).toHaveBeenCalledWith("/store/store-002/dashboard");
  });

  it("keeps the create-store entry at the end of the list", () => {
    render(<StoreSwitcher />);
    openMenu();
    const items = screen.getAllByRole("menuitem");

    expect(items.at(-1)).toHaveTextContent("dashboard.storeSelector.createNew");
    fireEvent.click(items.at(-1)!);
    expect(push).toHaveBeenCalledWith("/stores");
  });
});
