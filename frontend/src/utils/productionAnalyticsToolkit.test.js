import { describe, expect, it } from "vitest";

import {
  productionAnalyticsKpiDisplay,
  productionAnalyticsKpiIcon,
  productionAnalyticsKpiTone,
  PRODUCTION_ANALYTICS_KPI_TONES,
} from "./productionAnalyticsToolkit";

describe("productionAnalyticsToolkit", () => {
  it("cycles KPI tones like Project Timeline toolkit cards", () => {
    expect(PRODUCTION_ANALYTICS_KPI_TONES).toHaveLength(6);
    expect(productionAnalyticsKpiTone(0)).toBe("blue");
    expect(productionAnalyticsKpiTone(6)).toBe("blue");
  });

  it("derives compact KPI icons and formatted values", () => {
    expect(productionAnalyticsKpiIcon({ key: "oee" })).toBe("O");
    expect(productionAnalyticsKpiDisplay({ value: 1200, format: "number" })).toBe("1,200");
  });
});
