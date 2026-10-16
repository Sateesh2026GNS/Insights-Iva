import { describe, expect, it } from "vitest";

import { deviceIconKind, partitionSessions } from "./manageDevicesUtils";

describe("manageDevicesUtils", () => {
  it("maps device types", () => {
    expect(deviceIconKind("Mobile")).toBe("mobile");
    expect(deviceIconKind("Tablet")).toBe("tablet");
    expect(deviceIconKind("Desktop")).toBe("desktop");
  });

  it("partitions current and other sessions without leaking tokens", () => {
    const { current, others, total } = partitionSessions({
      current: { id: "a", device_name: "Chrome on Windows", is_current: true },
      others: [{ id: "b", device_name: "Safari on iOS" }],
      total_active: 2,
    });
    expect(current.id).toBe("a");
    expect(others).toHaveLength(1);
    expect(total).toBe(2);
    expect(JSON.stringify({ current, others })).not.toMatch(/refresh_token|access_token/);
  });
});
