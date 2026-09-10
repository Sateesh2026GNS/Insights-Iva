import { describe, expect, it } from "vitest";

import {
  buildEmptyGrants,
  emptyGrantRow,
  extraCodesForRow,
  fullGrantRow,
  getMorePermissions,
  grantsToPermissionCodes,
  isRowFullyGranted,
  permissionCodesToGrants,
  rowHasExtraGrants,
} from "./roleAccessModules";

describe("roleAccessModules extras", () => {
  it("maps selected extras to backend action codes", () => {
    const grants = buildEmptyGrants();
    grants.contacts.customers.extras.communication = true;
    grants.contacts.customers.extras.import = true;

    const codes = grantsToPermissionCodes(grants);
    expect(codes).toContain("masters:read");
    expect(codes).toContain("masters:create");
  });

  it("maps manufacturing downtime extra to report_breakdown", () => {
    const grants = buildEmptyGrants();
    grants.manufacturing.job_card.extras.downtime = true;

    expect(extraCodesForRow("production", grants.manufacturing.job_card, "manufacturing", "job_card")).toEqual([
      "production:report_breakdown",
    ]);
    expect(grantsToPermissionCodes(grants)).toContain("production:report_breakdown");
  });

  it("maps shop floor production entry to create_entry", () => {
    const grants = buildEmptyGrants();
    grants.manufacturing.shop_floor.extras.production_entry = true;

    expect(grantsToPermissionCodes(grants)).toContain("production:create_entry");
  });

  it("restores extras from granular permission codes", () => {
    const grants = permissionCodesToGrants(["masters:read", "masters:create"]);

    expect(grants.contacts.customers.extras.communication).toBe(true);
    expect(grants.contacts.customers.extras.import).toBe(true);
    expect(grants.contacts.customers.view).toBe(true);
    expect(grants.contacts.customers.create).toBe(true);
  });

  it("restores production report_breakdown on job card downtime extra", () => {
    const grants = permissionCodesToGrants(["production:report_breakdown"]);

    expect(grants.manufacturing.job_card.extras.downtime).toBe(true);
  });

  it("treats row as fully granted only when base and extras are complete", () => {
    const more = getMorePermissions("contacts", "customers");
    const partial = emptyGrantRow(more);
    partial.view = true;
    partial.create = true;
    partial.edit = true;
    partial.delete = true;
    partial.approve = true;
    partial.extras.communication = true;

    expect(rowHasExtraGrants(partial)).toBe(true);
    expect(isRowFullyGranted(partial, more)).toBe(false);

    const full = fullGrantRow(more);
    expect(isRowFullyGranted(full, more)).toBe(true);
  });
});
