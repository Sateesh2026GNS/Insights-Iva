import { describe, expect, it } from "vitest";

import { filterClients, paginateClients, sortClients } from "./buyerCrmTracker";

const rows = [
  { id: 1, name: "Harbor", code: "CL-2", contact: "Ada", email: "ada@harbor.test", phone: "999", region: "Gujarat", status: "active" },
  { id: 2, name: "Coastal", code: "CL-1", contact: "Bea", email: "bea@coast.test", phone: "888", region: "Kerala", status: "inactive" },
];

describe("buyerCrmTracker filters", () => {
  it("searches name, code, and contact fields", () => {
    expect(filterClients(rows, { search: "ada@" })).toHaveLength(1);
    expect(filterClients(rows, { region: "Kerala", status: "inactive" }).map((row) => row.id)).toEqual([2]);
  });

  it("sorts and paginates", () => {
    const sorted = sortClients(rows, "code", "asc");
    expect(sorted.map((row) => row.code)).toEqual(["CL-1", "CL-2"]);
    expect(paginateClients(sorted, 2, 1).rows).toHaveLength(1);
  });
});
