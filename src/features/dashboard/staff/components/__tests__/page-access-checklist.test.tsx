import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ROLE_DEFAULT_PAGES } from "@/config/staff-permissions.config";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => (k === "pages.staffTemplateHint" ? "Using the {role} template" : k),
  }),
}));

import { PageAccessChecklist } from "../page-access-checklist";

describe("PageAccessChecklist", () => {
  it("defaults to the read-only template summary when value matches the role's defaults", () => {
    render(
      <PageAccessChecklist role="CASHIER" value={ROLE_DEFAULT_PAGES.CASHIER} onChange={vi.fn()} />
    );
    const toggle = screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" });
    expect(toggle).not.toBeChecked();
    // Summary mode: page names render as plain rows, not as checkboxes.
    expect(screen.getByText("nav.pos")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "nav.pos" })).toBeNull();
  });

  it("Back Office group shows the empty state for a Cashier (POS-only role)", () => {
    render(
      <PageAccessChecklist role="CASHIER" value={ROLE_DEFAULT_PAGES.CASHIER} onChange={vi.fn()} />
    );
    expect(screen.getByText("pages.staffAccessNone")).toBeInTheDocument();
  });

  it("auto-expands to the editable checklist when value already diverges from the role's template", () => {
    render(
      <PageAccessChecklist
        role="CASHIER"
        value={[...ROLE_DEFAULT_PAGES.CASHIER, "/finance"]}
        onChange={vi.fn()}
      />
    );
    const toggle = screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" });
    expect(toggle).toBeChecked();
    // Editable mode: every grantable page is now a real checkbox.
    expect(screen.getByRole("checkbox", { name: "nav.finance" })).toBeInTheDocument();
  });

  it("checking 'Customize access' reveals the full editable checklist", () => {
    render(
      <PageAccessChecklist role="KITCHEN" value={ROLE_DEFAULT_PAGES.KITCHEN} onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" }));
    expect(screen.getByRole("checkbox", { name: "nav.posKds" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "nav.finance" })).not.toBeChecked();
  });

  it("toggling a checkbox in custom mode calls onChange with the updated page list", () => {
    const onChange = vi.fn();
    render(
      <PageAccessChecklist role="KITCHEN" value={ROLE_DEFAULT_PAGES.KITCHEN} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "nav.finance" }));
    expect(onChange).toHaveBeenCalledWith([...ROLE_DEFAULT_PAGES.KITCHEN, "/finance"]);
  });

  it("unchecking 'Customize access' resets value back to the role's template", () => {
    const onChange = vi.fn();
    render(
      <PageAccessChecklist
        role="CASHIER"
        value={[...ROLE_DEFAULT_PAGES.CASHIER, "/finance"]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" }));
    expect(onChange).toHaveBeenCalledWith(ROLE_DEFAULT_PAGES.CASHIER);
  });

  describe("templatePages override (job titles like Bartender)", () => {
    const bartenderPages = ["/pos", "/pos/orders", "/tables", "/pos/kds", "/pos/schedule"];

    it("treats a job-title template as the non-customized baseline, not bare role defaults", () => {
      render(
        <PageAccessChecklist
          role="CASHIER"
          value={bartenderPages}
          templatePages={bartenderPages}
          templateLabel="Bartender"
          onChange={vi.fn()}
        />
      );
      // Bartender's pages differ from bare Cashier defaults, but since
      // templatePages says THIS is the baseline, it should stay collapsed.
      const toggle = screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" });
      expect(toggle).not.toBeChecked();
      expect(screen.getByText("nav.posKds")).toBeInTheDocument();
    });

    it("Reset to role defaults resets to templatePages, not ROLE_DEFAULT_PAGES[role]", () => {
      const onChange = vi.fn();
      render(
        <PageAccessChecklist
          role="CASHIER"
          value={[...bartenderPages, "/finance"]}
          templatePages={bartenderPages}
          templateLabel="Bartender"
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "pages.staffResetToRoleDefaults" }));
      expect(onChange).toHaveBeenCalledWith(bartenderPages);
    });

    it("uses templateLabel in the summary hint instead of the plain role label", () => {
      render(
        <PageAccessChecklist
          role="CASHIER"
          value={bartenderPages}
          templatePages={bartenderPages}
          templateLabel="Bartender"
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText(/Bartender/)).toBeInTheDocument();
    });
  });
});
