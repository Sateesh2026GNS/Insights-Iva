import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

    fireEvent.click(screen.getByRole("button", { name: /select state/i }));

    const menu = screen.getByRole("listbox");
    expect(menu).toBeInTheDocument();
    expect(menu.parentElement).toHaveClass("top-full");
    expect(menu.parentElement).not.toHaveClass("bottom-full");
  });
});
