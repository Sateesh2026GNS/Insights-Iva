import { describe, expect, it } from "vitest";

import {
  checklistListParams,
  incidentListParams,
  issueListParams,
  incidentsEligibleForActions,
  toolkitRegisterEmptyMessage,
} from "./manufacturingToolkitWorkflows";

describe("manufacturingToolkitWorkflows", () => {
  it("builds incident list params from filter", () => {
    expect(incidentListParams("open")).toMatchObject({ open_only: true });
    expect(incidentListParams("high")).toMatchObject({ severity: "high" });
    expect(incidentListParams("all")).not.toHaveProperty("open_only");
  });

  it("builds issue list params from filter", () => {
    expect(issueListParams("open")).toMatchObject({ status: "open" });
    expect(issueListParams("critical")).toMatchObject({ priority: "critical" });
  });

  it("builds checklist list params from filter", () => {
    expect(checklistListParams("overdue")).toMatchObject({ overdue_only: true });
    expect(checklistListParams("pending")).toMatchObject({ pending_only: true });
  });

  it("returns empty message when loaded with zero rows", () => {
    expect(toolkitRegisterEmptyMessage("incident", true, null, 0)).toContain("No incident");
  });

  it("returns loading message when not loaded", () => {
    expect(toolkitRegisterEmptyMessage("issue", false, null, 0)).toContain("Loading");
  });

  it("prefers error over empty state", () => {
    expect(toolkitRegisterEmptyMessage("issue", true, "Failed", 0)).toBe("Failed");
  });

  it("filters incidents eligible for workflow actions", () => {
    const items = [
      { id: 1, status: "open" },
      { id: 2, status: "closed" },
      { id: 3, status: "under_investigation" },
    ];
    expect(incidentsEligibleForActions(items)).toHaveLength(2);
  });
});
