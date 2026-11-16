import { describe, expect, it } from "vitest";

import { escapeHtml, formatAiMessageInline } from "./aiMessageFormat";

describe("aiMessageFormat", () => {
  it("escapes HTML before inline formatting", () => {
    const out = formatAiMessageInline('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).not.toMatch(/onerror/i);
  });

  it("blocks script tags and event handlers in stored AI content", () => {
    const payloads = [
      '<script>alert("xss")</script>',
      '"><svg/onload=alert(1)>',
      "javascript:alert(1)",
      "**bold** <iframe src=evil>",
    ];
    for (const raw of payloads) {
      const html = formatAiMessageInline(raw);
      expect(html).not.toContain("<script");
      expect(html).not.toContain("<iframe");
      expect(html).not.toMatch(/onload\s*=/i);
    }
  });

  it("linkifies http urls without allowing javascript urls", () => {
    const html = formatAiMessageInline("See https://example.com/report.");
    expect(html).toContain('href="https://example.com/report"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(formatAiMessageInline("javascript:alert(1)")).not.toContain("href=");
  });

  it("still applies bold and code after escaping", () => {
    expect(formatAiMessageInline("**Hello**")).toContain("<strong>Hello</strong>");
    expect(formatAiMessageInline("`x`")).toContain("<code");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
});
