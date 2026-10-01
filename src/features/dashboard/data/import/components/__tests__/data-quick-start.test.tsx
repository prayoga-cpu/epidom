import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

// The dialog has its own flow; here it is a probe for when the card opens it and for what.
const dialog = vi.hoisted(() => ({ props: [] as any[] }));
vi.mock("../../smart-import-dialog", () => ({
  SmartImportDialog: (props: any) => {
    dialog.props.push(props);
    return props.open ? <div data-testid="import-dialog">{props.defaultEntityType}</div> : null;
  },
}));

import { DataQuickStart } from "../data-quick-start";
import { IMPORT_PROMPT_COLUMNS } from "../../lib/import-prompt";

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  dialog.props = [];
  localStorage.clear();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

const renderCard = (props: Partial<Parameters<typeof DataQuickStart>[0]> = {}) =>
  render(<DataQuickStart storeId="store-1" startOpen {...props} />);

describe("DataQuickStart", () => {
  it("an empty store sees the three steps; copying puts the products prompt on the clipboard", async () => {
    renderCard();

    expect(screen.getByText("import.quickStart.step1Title")).toBeInTheDocument();
    expect(screen.getByText("import.quickStart.step2Title")).toBeInTheDocument();
    expect(screen.getByText("import.quickStart.step3Title")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.copy$/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain(IMPORT_PROMPT_COLUMNS.product.join(","));
    expect(toast.success).toHaveBeenCalledWith("import.quickStart.copied");
  });

  it("preselects the prompt for the tab the page is on", async () => {
    renderCard({ defaultEntityType: "material" });

    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.copy$/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(IMPORT_PROMPT_COLUMNS.material.join(","));
  });

  it("when the clipboard is refused, shows the prompt selected instead of failing silently", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.copy$/ }));

    const prompt = await screen.findByLabelText("import.quickStart.promptLabel");
    expect((prompt as HTMLTextAreaElement).value).toContain(
      IMPORT_PROMPT_COLUMNS.product.join(",")
    );
    expect(toast.error).toHaveBeenCalledWith("import.quickStart.copyFailed");
  });

  it("opens Smart Import for the chosen type", () => {
    renderCard({ defaultEntityType: "recipe" });

    expect(screen.queryByTestId("import-dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.importCta/ }));

    expect(screen.getByTestId("import-dialog")).toHaveTextContent("recipe");
    expect(dialog.props.at(-1)).toMatchObject({ storeId: "store-1", open: true });
  });

  it("a store with data starts closed, still with Import one tap away, and remembers being opened", async () => {
    const { unmount } = renderCard({ startOpen: false });

    expect(screen.queryByText("import.quickStart.step1Title")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /import\.quickStart\.importCta/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.showSteps/ }));
    expect(screen.getByText("import.quickStart.step1Title")).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem("epidom-data-quickstart-store-1")).toBe('{"open":true}')
    );

    unmount();
    renderCard({ startOpen: false });
    expect(await screen.findByText("import.quickStart.step1Title")).toBeInTheDocument();
  });
});
