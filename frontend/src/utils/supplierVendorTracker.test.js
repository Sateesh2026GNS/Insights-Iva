import { describe, expect, it } from "vitest";

import { filterSuppliers, isCompliantSupplier, paginateSuppliers, sortSuppliers } from "./supplierVendorTracker";

const rows = [
  { id: 1, name: "Harbor", vendor_type: "Raw Material Supplier", country: "Germany", contact: "Ada", email: "a@h.test", phone: "1", payment_terms: "Net 30", status: "active", approval_status: "approved", rating: 4, gstin: "22AAAAA0000A1Z5" },
  { id: 2, name: "Coastal", vendor_type: "Service Provider", country: "India", contact: "Lin", email: "l@c.test", phone: "2", payment_terms: "Advance", status: "inactive", approval_status: "pending", rating: 2 },
];

describe("supplierVendorTracker list helpers", () => {
  it("filters by search, type, and compliance", () => {
    expect(filterSuppliers(rows, { search: "ada" }).map((row) => row.id)).toEqual([1]);
    expect(filterSuppliers(rows, { vendorType: "Service Provider" })).toHaveLength(1);
    expect(filterSuppliers(rows, { compliantOnly: true }).map((row) => row.name)).toEqual(["Harbor"]);
    expect(isCompliantSupplier(rows[1])).toBe(false);
  });

  it("sorts and paginates", () => {
    const sorted = sortSuppliers(rows, "rating", "desc");
    expect(sorted.map((row) => row.name)).toEqual(["Harbor", "Coastal"]);
    const page = paginateSuppliers(sorted, 2, 1);
    expect(page.pages).toBe(2);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].name).toBe("Coastal");
  });
});
