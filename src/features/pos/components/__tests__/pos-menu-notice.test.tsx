import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => "/store/s1/data",
  useRouter: () => ({ replace: nav.replace }),
}));

const menu = vi.hoisted(() => ({ data: undefined as undefined | { total: number } }));
vi.mock("../../hooks/use-pos-menu", () => ({
  usePosMenu: () => ({ data: menu.data }),
}));

import { PosMenuNotice } from "../pos-menu-notice";

beforeEach(() => {
  nav.search = "from=pos&tab=materials";
  nav.replace.mockReset();
  menu.data = { total: 0 };
});

describe("PosMenuNotice", () => {
  it("renders nothing on a visit that didn't come from the POS", () => {
    nav.search = "tab=materials";
    const { container } = render(<PosMenuNotice storeId="s1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("an empty till: says the POS needs a menu, with this page's way to add it", () => {
    render(<PosMenuNotice storeId="s1" action={<button type="button">go</button>} />);
    expect(screen.getByText("pos.menuNotice.requiredTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "go" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "pos.menuNotice.openPos" })).toBeNull();
  });

  it("before the till's menu has loaded, it still reads as the empty case it was sent for", () => {
    menu.data = undefined;
    render(<PosMenuNotice storeId="s1" />);
    expect(screen.getByText("pos.menuNotice.requiredTitle")).toBeInTheDocument();
  });

  it("once the till has items, it turns into Open the POS", () => {
    menu.data = { total: 3 };
    render(<PosMenuNotice storeId="s1" action={<button type="button">go</button>} />);
    expect(screen.getByText("pos.menuNotice.readyTitle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "pos.menuNotice.openPos" })).toHaveAttribute(
      "href",
      "/store/s1/pos"
    );
    expect(screen.queryByRole("button", { name: "go" })).toBeNull();
  });

  it("closing it drops only ?from=pos", () => {
    render(<PosMenuNotice storeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "pos.menuNotice.dismiss" }));
    expect(nav.replace).toHaveBeenCalledWith("/store/s1/data?tab=materials", { scroll: false });
  });
});
