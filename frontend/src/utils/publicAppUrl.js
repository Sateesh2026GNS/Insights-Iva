/**
 * Public app origin for e-Quotation QR links (scannable from phones).
 * Never embed loopback hosts unless explicitly configured via VITE_PUBLIC_APP_URL.
 */

export function isLoopbackHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  return (
    !h ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h === "::1" ||
    h.endsWith(".local")
  );
}

export function isLoopbackOrigin(originOrUrl) {
  try {
    const url = new URL(String(originOrUrl || ""), typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return isLoopbackHostname(url.hostname);
  } catch {
    return true;
  }
}

/**
 * Origin used in QR codes. Prefer VITE_PUBLIC_APP_URL; else current page origin when not loopback.
 */
export function getPublicAppOriginForQr() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) {
    return configured;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    if (!isLoopbackHostname(window.location.hostname)) {
      return window.location.origin;
    }
  }
  return "";
}

/** @deprecated Use getPublicAppOriginForQr for QR; kept for non-QR callers. */
export function getPublicAppOrigin() {
  return getPublicAppOriginForQr();
}

export function buildEQuotationPublicPath(token) {
  const safe = String(token || "").trim();
  return `/e-quotation/${encodeURIComponent(safe)}`;
}

export function buildEQuotationPublicUrl(token) {
  const base = getPublicAppOriginForQr();
  const safe = String(token || "").trim();
  if (!base || !safe) {
    return "";
  }
  return `${base}${buildEQuotationPublicPath(safe)}`;
}

export function extractEQuotationToken(source) {
  if (!source) return "";
  if (typeof source === "string") {
    const match = source.match(/\/e-quotation\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  }
  const raw = source.qr_url || source.qr_value || source.qrValue || "";
  const match = String(raw).match(/\/e-quotation\/([^/?#]+)/);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  return String(source.public_view_token || "").trim();
}

/**
 * Rewrite qr_url/qr_value when the API returned localhost or a relative path.
 */
export function applyQuotationPublicQrUrls(doc) {
  if (!doc || (doc.doc_type && doc.doc_type !== "quotation")) {
    return doc;
  }
  const token = extractEQuotationToken(doc);
  if (!token) {
    return doc;
  }
  const rebuilt = buildEQuotationPublicUrl(token);
  if (!rebuilt) {
    return doc;
  }
  const current = String(doc.qr_url || doc.qr_value || "").trim();
  const needsReplace =
    !current ||
    current.startsWith("/") ||
    isLoopbackOrigin(current);
  if (!needsReplace) {
    return doc;
  }
  return {
    ...doc,
    qr_url: rebuilt,
    qr_value: rebuilt,
    public_view_token: token,
  };
}
