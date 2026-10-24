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
    expect(screen.getByText("nav.posAndOrders")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "nav.posAndOrders" })).toBeNull();
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

describe("PageAccessChecklist — master (owner) mode", () => {
  // The owner's own StaffMember row: requireOwnerOnly/requireStaffPageAccess
  // bypass allowedPages entirely for role OWNER, so an editable checklist
  // there would be pure decoration — and worse, a partial stored value (as a
  // seeded row can have) must not read as "the owner is restricted".
  it("labels the section MASTER and drops the customize / reset controls", () => {
    render(<PageAccessChecklist role="OWNER" value={[]} onChange={vi.fn()} master />);
    expect(screen.getByText("pages.staffAccessMasterBadge")).toBeInTheDocument();
    expect(screen.getByText("pages.staffAccessMasterHint")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "pages.staffCustomAccessToggle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "pages.staffResetToRoleDefaults" })).toBeNull();
  });

  it("shows every page granted and locked, whatever partial value was stored", () => {
    render(
      <PageAccessChecklist role="OWNER" value={["/pos", "/dashboard"]} onChange={vi.fn()} master />
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(10);
    for (const box of boxes) {
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
    // Both shells are listed, not just the one the stored value happened to cover.
    expect(screen.getByRole("checkbox", { name: "nav.posAndOrders" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "nav.finance" })).toBeChecked();
  });

  it("can't be changed by clicking", () => {
    const onChange = vi.fn();
    render(<PageAccessChecklist role="OWNER" value={[]} onChange={onChange} master />);
    fireEvent.click(screen.getByRole("checkbox", { name: "nav.finance" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("doesn't change how a normal (non-master) checklist behaves", () => {
    render(
      <PageAccessChecklist role="CASHIER" value={ROLE_DEFAULT_PAGES.CASHIER} onChange={vi.fn()} />
    );
    expect(screen.queryByText("pages.staffAccessMasterBadge")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" })).toBeEnabled();
  });

  describe("POS & Orders — the cashier screen and the Order Queue as one row", () => {
    const openCustom = () =>
      fireEvent.click(screen.getByRole("checkbox", { name: "pages.staffCustomAccessToggle" }));

    it("lists one row in place of POS Cashier and Order Queue", () => {
      render(
        <PageAccessChecklist role="KITCHEN" value={ROLE_DEFAULT_PAGES.KITCHEN} onChange={vi.fn()} />
      );
      openCustom();
      expect(screen.getByRole("checkbox", { name: "nav.posAndOrders" })).not.toBeChecked();
      expect(screen.queryByRole("checkbox", { name: "nav.pos" })).toBeNull();
      expect(screen.queryByRole("checkbox", { name: "nav.posOrders" })).toBeNull();
    });

    it("ticking it grants both pages, unticking removes both", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <PageAccessChecklist
          role="KITCHEN"
          value={ROLE_DEFAULT_PAGES.KITCHEN}
          onChange={onChange}
        />
      );
      openCustom();
      fireEvent.click(screen.getByRole("checkbox", { name: "nav.posAndOrders" }));
      const granted = onChange.mock.calls.at(-1)![0] as string[];
      expect(granted).toEqual([...ROLE_DEFAULT_PAGES.KITCHEN, "/pos", "/pos/orders"]);

      rerender(<PageAccessChecklist role="KITCHEN" value={granted} onChange={onChange} />);
      expect(screen.getByRole("checkbox", { name: "nav.posAndOrders" })).toBeChecked();
      fireEvent.click(screen.getByRole("checkbox", { name: "nav.posAndOrders" }));
      expect(onChange.mock.calls.at(-1)![0]).toEqual(ROLE_DEFAULT_PAGES.KITCHEN);
    });

    it("shows a row saved with only one of the two as part-granted, and ticking completes it", () => {
      const onChange = vi.fn();
      render(<PageAccessChecklist role="CASHIER" value={["/pos/orders"]} onChange={onChange} />);
      const row = screen.getByRole("checkbox", { name: "nav.posAndOrders" }) as HTMLInputElement;
      expect(row.checked).toBe(false);
      expect(row.indeterminate).toBe(true);
      fireEvent.click(row);
      expect(onChange).toHaveBeenCalledWith(["/pos/orders", "/pos"]);
    });
  });
});
