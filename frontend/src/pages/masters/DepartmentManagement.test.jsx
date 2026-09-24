import { describe, expect, it, vi } from "vitest";

import {
  applyDepartmentFilters,
  buildDepartmentImportTemplateCsv,
  clearDepartmentFilters,
  defaultFilters,
  triggerDepartmentImportPicker,
} from "./DepartmentManagement";

describe("DepartmentManagement import/print helpers", () => {
  it("builds a CSV import template for departments", () => {
    const csv = buildDepartmentImportTemplateCsv();

    expect(csv).toContain("code,name,department_type,plant,branch,manager_name");
    expect(csv).toContain("DEP013");
  });

  it("opens the file picker instead of downloading a template", () => {
    const click = vi.fn();
    const toast = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement");

    spy.mockImplementation((tagName, options) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === "input") {
        Object.defineProperty(el, "click", { value: click, configurable: true });
      }
      return el;
    });

    triggerDepartmentImportPicker({ addToast: toast });

    expect(click).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalledWith("Template downloaded");
    spy.mockRestore();
  });

  it("applies and clears filter state without leaving stale values behind", () => {
    const nextDraft = {
      code: "DEP-01",
      name: "Production",
      department_type: "production",
      manager: "Rajesh",
      plant: "Plant 1",
      branch: "Hyderabad",
      status: "active",
    };

    const applied = applyDepartmentFilters(nextDraft, { ...defaultFilters });
    expect(applied.code).toBe("DEP-01");
    expect(applied.status).toBe("active");

    const cleared = clearDepartmentFilters({ ...applied });
    expect(cleared).toEqual({
      code: "",
      name: "",
      department_type: "",
      manager: "",
      plant: "",
      branch: "",
      status: "",
    });
  });
});


