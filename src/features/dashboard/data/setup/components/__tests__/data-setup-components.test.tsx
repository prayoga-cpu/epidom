import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// The import flow has its own tests; here it is a probe for what this view opens.
const dialog = vi.hoisted(() => ({ props: [] as any[] }));
vi.mock("../../../import/smart-import-dialog", () => ({
  SmartImportDialog: (props: any) => {
    dialog.props.push(props);
    return props.open ? <div data-testid="import-dialog">{props.defaultEntityType}</div> : null;
  },
}));

import { DataSetupChooser } from "../data-setup-chooser";
import { DataSetupImport } from "../data-setup-import";
import { DataSetupGuide, DataSetupMenuReady } from "../data-setup-card";

beforeEach(() => {
  dialog.props = [];
});

describe("DataSetupChooser", () => {
  it("explains both ways in: how each works, what it gives, and its catch", () => {
    render(<DataSetupChooser onChoose={vi.fn()} onSkip={vi.fn()} />);

    for (const path of ["import", "guided"]) {
      const card = screen
        .getByRole("heading", { name: `import.setup.chooser.${path}.title` })
        .closest("article")!;
      for (const part of ["badge", "how", "get", "note", "cta"]) {
        expect(within(card).getByText(`import.setup.chooser.${path}.${part}`)).toBeInTheDocument();
      }
    }
  });

  it("puts the menu import first, as the recommended way (the POS needs the menu)", () => {
    render(<DataSetupChooser onChoose={vi.fn()} onSkip={vi.fn()} />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "import.setup.chooser.import.title",
      "import.setup.chooser.guided.title",
    ]);
    expect(screen.getByText("import.setup.chooser.import.badge")).toHaveClass("bg-primary");
    expect(screen.getByText("import.setup.chooser.guided.badge")).not.toHaveClass("bg-primary");
  });

  it("the guided way lists its three steps in order, raw materials first", () => {
    render(<DataSetupChooser onChoose={vi.fn()} onSkip={vi.fn()} />);
    const steps = within(
      screen.getByRole("list", { name: "import.setup.chooser.guided.stepsLabel" })
    ).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "1import.setup.guide.materials.title",
      "2import.setup.guide.recipes.title",
      "3import.setup.guide.menu.title",
    ]);
  });

  it("each button picks its way; skip leaves the choice", () => {
    const onChoose = vi.fn();
    const onSkip = vi.fn();
    render(<DataSetupChooser onChoose={onChoose} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: /import\.setup\.chooser\.import\.cta/ }));
    fireEvent.click(screen.getByRole("button", { name: /import\.setup\.chooser\.guided\.cta/ }));
    fireEvent.click(screen.getByRole("button", { name: "import.setup.chooser.skip" }));

    expect(onChoose.mock.calls).toEqual([["import"], ["guided"]]);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe("DataSetupImport", () => {
  it("shows the three import steps with Smart Import set to products (the menu)", () => {
    render(<DataSetupImport storeId="s1" onBack={vi.fn()} onAddManually={vi.fn()} />);

    expect(screen.getByText("import.quickStart.step1Title")).toBeInTheDocument();
    expect(screen.getByText("import.quickStart.step3Title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /import\.quickStart\.importCta/ }));
    expect(screen.getByTestId("import-dialog")).toHaveTextContent("product");
    expect(dialog.props.at(-1)).toMatchObject({ storeId: "s1", open: true });
  });

  it("goes back to the choice, or to typing the menu in", () => {
    const onBack = vi.fn();
    const onAddManually = vi.fn();
    render(<DataSetupImport storeId="s1" onBack={onBack} onAddManually={onAddManually} />);

    fireEvent.click(screen.getByRole("button", { name: /import\.setup\.importView\.back/ }));
    fireEvent.click(screen.getByRole("button", { name: "import.setup.importView.manual" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAddManually).toHaveBeenCalledTimes(1);
  });
});

const renderGuide = (counts: { products: number; materials: number; recipes: number }) => {
  const props = {
    onGoToTab: vi.fn(),
    onHide: vi.fn(),
    onSwitchToImport: vi.fn(),
  };
  render(<DataSetupGuide storeId="s1" counts={counts} {...props} />);
  return props;
};

describe("DataSetupGuide", () => {
  it("highlights the next step, ticks the done ones, and marks the menu as needed for the POS", () => {
    renderGuide({ products: 0, materials: 3, recipes: 0 });

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("import.setup.guide.done");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).not.toHaveAttribute("aria-current");
    expect(within(steps[2]).getByText("import.setup.guide.posBadge")).toBeInTheDocument();
  });

  it("each step's button opens its tab: materials, recipes, products", () => {
    const { onGoToTab } = renderGuide({ products: 0, materials: 0, recipes: 0 });
    for (const id of ["materials", "recipes", "menu"]) {
      fireEvent.click(screen.getByRole("button", { name: `import.setup.guide.${id}.cta` }));
    }
    expect(onGoToTab.mock.calls).toEqual([["materials"], ["recipes"], ["products"]]);
  });

  it("offers the menu import instead only while every list is empty", () => {
    const { onSwitchToImport } = renderGuide({ products: 0, materials: 0, recipes: 0 });
    fireEvent.click(screen.getByRole("button", { name: "import.setup.guide.switchToImport" }));
    expect(onSwitchToImport).toHaveBeenCalled();
  });

  it("drops the switch once something is in a list", () => {
    renderGuide({ products: 0, materials: 1, recipes: 0 });
    expect(
      screen.queryByRole("button", { name: "import.setup.guide.switchToImport" })
    ).not.toBeInTheDocument();
  });

  it("all done: says so and offers the POS", () => {
    const { onHide } = renderGuide({ products: 2, materials: 3, recipes: 1 });

    expect(screen.getByText("import.setup.guide.allDoneTitle")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "import.setup.guide.openPos" })).toHaveAttribute(
      "href",
      "/store/s1/pos"
    );
    fireEvent.click(screen.getAllByRole("button", { name: "import.setup.guide.hide" })[0]);
    expect(onHide).toHaveBeenCalled();
  });
});

describe("DataSetupMenuReady", () => {
  it("offers the POS and the guided way for accurate costs", () => {
    const onContinueGuided = vi.fn();
    const onHide = vi.fn();
    render(<DataSetupMenuReady storeId="s1" onContinueGuided={onContinueGuided} onHide={onHide} />);

    expect(screen.getByRole("link", { name: "import.setup.menuReady.openPos" })).toHaveAttribute(
      "href",
      "/store/s1/pos"
    );
    fireEvent.click(screen.getByRole("button", { name: "import.setup.menuReady.next" }));
    fireEvent.click(screen.getByRole("button", { name: "import.setup.menuReady.hide" }));
    expect(onContinueGuided).toHaveBeenCalled();
    expect(onHide).toHaveBeenCalled();
  });
});
