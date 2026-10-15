import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchableSelect from "./SearchableSelect";

describe("SearchableSelect", () => {
  it("opens the dropdown below the trigger", () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        options={["Andhra Pradesh", "Karnataka", "Kerala"]}
        placeholder="Select State"
      />
    );

    const trigger = screen.getByRole("button", { name: /select state/i });
    expect(trigger).toHaveClass("ui-searchable-select");

    fireEvent.click(trigger);

    const menu = screen.getByRole("listbox");
    expect(menu).toBeInTheDocument();
    const panel = menu.closest(".top-full");
    expect(panel).toBeTruthy();
    expect(panel).not.toHaveClass("bottom-full");
  });

  it("can open the dropdown above the trigger", () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        options={["Advance", "COD", "Net 30"]}
        placeholder="Payment terms"
        placement="top"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /payment terms/i }));

    const panel = screen.getByRole("listbox").closest(".bottom-full");
    expect(panel).toBeTruthy();
    expect(panel).toHaveClass("mb-1");
    expect(panel).not.toHaveClass("top-full");
  });

  it("shows clear control and footer action", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <SearchableSelect
        value="1"
        onChange={onChange}
        onClear={onClear}
        clearable
        clearAriaLabel="Clear assigned executive"
        options={[{ value: "1", label: "Vikram Sharma" }]}
        footerOptions={[{ value: "__add__", label: "+ Add New Name", ariaLabel: "Add new executive name" }]}
        placeholder="Select executive"
      />
    );

    fireEvent.click(screen.getByLabelText("Clear assigned executive"));
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /vikram sharma/i }));
    const footerBtn = screen.getByRole("button", { name: /add new executive name/i });
    expect(footerBtn).toBeInTheDocument();
    expect(footerBtn).toHaveTextContent("Add New Name");
    expect(footerBtn.textContent).not.toContain("+ +");
  });

  it("renders Add Vendor footer action with plus icon and primary style", () => {
    const onFooterPick = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={vi.fn()}
        options={[]}
        footerOptions={[{ value: "__create_vendor", label: "Add Vendor" }]}
        onFooterPick={onFooterPick}
        placeholder="Select vendor"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select vendor/i }));
    const footerBtn = screen.getByRole("button", { name: "Add Vendor" });
    expect(footerBtn).toBeInTheDocument();
    expect(footerBtn).toHaveTextContent("Add Vendor");
    expect(footerBtn.querySelector("svg")).toBeInTheDocument();
  });
});
