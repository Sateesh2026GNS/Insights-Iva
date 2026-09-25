import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LIST_PAGE_SEARCH_BAR_CLASS, SearchBar } from "./SearchFilter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => opts?.defaultValue || key,
  }),
}));

describe("SearchBar", () => {
  it("uses vendors list layout class by default", () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} placeholder="Search vendors..." />);
    const wrap = container.querySelector(".ui-search-wrap");
    expect(wrap?.className).toContain(LIST_PAGE_SEARCH_BAR_CLASS.split(" ")[0]);
  });

  it("clears value when clear button is clicked", () => {
    const onChange = vi.fn();
    render(<SearchBar value="acme" onChange={onChange} placeholder="Search" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
