import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select, SelectTrigger, SelectValue } from "../select";

const trigger = (props: { className?: string; size?: "sm" | "default" }) => {
  render(
    <Select>
      <SelectTrigger aria-label="pick" {...props}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
    </Select>
  );
  return screen.getByRole("combobox", { name: "pick" });
};

describe("SelectTrigger height", () => {
  it("is 36px by default and 32px when small", () => {
    expect(trigger({}).className).toMatch(/(^|\s)h-9(\s|$)/);
  });

  it("small is h-8", () => {
    expect(trigger({ size: "sm" }).className).toMatch(/(^|\s)h-8(\s|$)/);
  });

  it("lets a caller's height win, for 40-44px tap targets", () => {
    const el = trigger({ className: "h-11" });
    expect(el.className).toMatch(/(^|\s)h-11(\s|$)/);
    expect(el.className).not.toMatch(/(^|\s)h-9(\s|$)/);
    expect(el.className).not.toMatch(/data-\[size=default\]:h-/);
  });
});
