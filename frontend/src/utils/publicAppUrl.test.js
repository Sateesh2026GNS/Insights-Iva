import { describe, expect, it } from "vitest";

import {
  applyQuotationPublicQrUrls,
  buildEQuotationPublicUrl,
  extractEQuotationToken,
  isLoopbackOrigin,
} from "./publicAppUrl";

describe("publicAppUrl", () => {
  it("detects loopback origins", () => {
    expect(isLoopbackOrigin("http://localhost:5173/e-quotation/abc")).toBe(true);
    expect(isLoopbackOrigin("http://192.168.1.50:5173/e-quotation/abc")).toBe(false);
  });

  it("extracts token from qr_url", () => {
    expect(extractEQuotationToken("http://localhost:5173/e-quotation/my-token-123")).toBe(
      "my-token-123"
    );
  });

  it("applyQuotationPublicQrUrls leaves non-loopback url unchanged", () => {
    const doc = {
      doc_type: "quotation",
      qr_url: "https://erp.example.com/e-quotation/tok",
    };
    expect(applyQuotationPublicQrUrls(doc).qr_url).toBe(doc.qr_url);
  });
});
