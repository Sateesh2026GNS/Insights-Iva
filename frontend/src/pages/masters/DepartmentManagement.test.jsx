import { describe, expect, it, vi } from "vitest";

import { formatSimpleToastMessage, resolveToastVisualState } from "../../context/ToastContext";
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

  it("preserves the department import wording and uses orange warning styling without a loading bar", () => {
    const message = "Import the department data";

    expect(formatSimpleToastMessage(message, false, "warning")).toBe(message);
    expect(resolveToastVisualState("warning", message)).toEqual({
      isRed: false,
      isWarning: true,
      isUploadToast: true,
      accentColor: "#f59e0b",
      showLoadingBar: false,
    });
  });

  it("shows a success toast when a valid department CSV is uploaded", () => {
    const validCsv = "code,name,department_type,plant,branch,manager_name,manager_mobile,manager_email,status\nDEP001,IT,Support,Plant 1,Hyderabad,Rajesh,9999999999,rajesh@smrt.local,active";
    const toast = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement");
    const readSpy = vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (file) {
      this.onload?.({ target: { result: validCsv } });
      return file;
    });

    const file = new File([validCsv], "departments.csv", { type: "text/csv" });
    spy.mockImplementation((tagName, options) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === "input") {
        Object.defineProperty(el, "files", { value: [file], configurable: true });
        Object.defineProperty(el, "click", { value: () => {
          if (el.onchange) {
            el.onchange();
          }
        }, configurable: true });
      }
      return el;
    });

    triggerDepartmentImportPicker({ addToast: toast });

    expect(toast).toHaveBeenCalledWith("Department data imported successfully", "success");
    spy.mockRestore();
    readSpy.mockRestore();
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


