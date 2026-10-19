import { describe, expect, it } from "vitest";

import { DOCUMENTS_TOOLKIT_KPIS, formatDocumentsKpiValue } from "./documentsToolkit";

describe("documentsToolkit", () => {
  it("defines six Department Operating Plan–style KPI cards", () => {
    expect(DOCUMENTS_TOOLKIT_KPIS).toHaveLength(6);
    expect(DOCUMENTS_TOOLKIT_KPIS[0].field).toBe("total_documents");
  });

  it("formats summary KPI values", () => {
    expect(formatDocumentsKpiValue({ total_documents: 42 }, DOCUMENTS_TOOLKIT_KPIS[0])).toBe("42");
    expect(formatDocumentsKpiValue(null, DOCUMENTS_TOOLKIT_KPIS[0], { loading: true })).toBe("—");
  });
});
