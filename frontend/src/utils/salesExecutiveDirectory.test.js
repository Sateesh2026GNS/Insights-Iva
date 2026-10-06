import { describe, expect, it } from "vitest";

import {
  executiveDisplayName,
  filterLeadExecutiveCandidates,
  findExecutiveByName,
} from "./salesExecutiveDirectory";

describe("salesExecutiveDirectory", () => {
  it("filters sales users and excludes HR", () => {
    const users = [
      { id: 1, full_name: "Vikram Sharma", role: "Sales Manager", is_active: true },
      { id: 2, full_name: "HR Person", role: "HR", is_active: true },
      { id: 3, full_name: "Ananya Roy", designation: "Sales Executive", is_active: true },
    ];
    const filtered = filterLeadExecutiveCandidates(users);
    expect(filtered.map((u) => u.id)).toEqual([3, 1]);
    expect(executiveDisplayName(filtered[0])).toBe("Ananya Roy");
  });

  it("finds executive by display name", () => {
    const users = [{ id: 5, full_name: "Kiran Reddy", role: "Sales Manager" }];
    expect(findExecutiveByName(users, "Kiran Reddy")?.id).toBe(5);
  });
});
