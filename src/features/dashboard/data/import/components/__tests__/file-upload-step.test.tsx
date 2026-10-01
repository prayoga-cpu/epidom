import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FileUploadStep } from "../file-upload-step";
import { IMPORT_PROMPT_COLUMNS } from "../../lib/import-prompt";

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

const renderStep = (props: Partial<Parameters<typeof FileUploadStep>[0]> = {}) =>
  render(
    <FileUploadStep
      onFileSelect={vi.fn()}
      selectedEntityType={undefined}
      onEntityTypeChange={vi.fn()}
      isLoading={false}
      {...props}
    />
  );

describe("FileUploadStep", () => {
  // A failed analysis used to return here with nothing on screen.
  it("says why the last analysis failed", () => {
    renderStep({ error: "import.upload.analysisFailed" });

    expect(screen.getByRole("alert")).toHaveTextContent("import.upload.analysisFailed");
  });

  it("shows no alert when nothing went wrong", () => {
    renderStep();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers the prompt for whoever has no CSV yet, for the type being imported", async () => {
    renderStep({ selectedEntityType: "supplier" });

    expect(screen.getByText("import.quickStart.dialogHint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.copy$/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(IMPORT_PROMPT_COLUMNS.supplier.join(","));
  });

  it("on auto-detect, the prompt is the menu (products) one", async () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.copy$/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(IMPORT_PROMPT_COLUMNS.product.join(","));
  });
});
