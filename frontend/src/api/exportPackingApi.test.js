import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./axiosConfig", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "./axiosConfig";
import { getExportPackingDashboard } from "./exportPackingApi";

describe("exportPackingApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: {} });
  });

  it("defaults dashboard load to seed_demo=false", async () => {
    await getExportPackingDashboard();
    expect(api.get).toHaveBeenCalledWith("/export/packing-lists/dashboard", {
      params: { seed_demo: false },
    });
  });

  it("passes seed_demo=true when loading demonstration data", async () => {
    await getExportPackingDashboard(null, { seedDemo: true });
    expect(api.get).toHaveBeenCalledWith("/export/packing-lists/dashboard", {
      params: { seed_demo: true },
    });
  });

  it("includes packing_list_id when selecting a list", async () => {
    await getExportPackingDashboard(42);
    expect(api.get).toHaveBeenCalledWith("/export/packing-lists/dashboard", {
      params: { seed_demo: false, packing_list_id: 42 },
    });
  });
});
