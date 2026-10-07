import { describe, expect, it, vi } from "vitest";

import { applyDraftListFilters, clearListFilters } from "./listFilterState";

describe("listFilterState", () => {
  it("applyDraftListFilters copies draft into applied", () => {
    const setApplied = vi.fn();
    applyDraftListFilters({ status: "pending", customer: "Acme" }, setApplied);
    expect(setApplied).toHaveBeenCalledWith({ status: "pending", customer: "Acme" });
  });

  it("clearListFilters resets draft and applied", () => {
    const setDraft = vi.fn();
    const setApplied = vi.fn();
    const empty = { status: "", customer: "" };
    clearListFilters(empty, setDraft, setApplied);
    expect(setDraft).toHaveBeenCalledWith(empty);
    expect(setApplied).toHaveBeenCalledWith(empty);
  });
});
