/**
 * Vite dev-server bypass for `/auth` proxy: API routes → backend; legacy slide PNGs → public.
 */

export const AUTH_API_PATH_RE =
  /^\/auth\/(login|register|refresh|logout|csrf|verify-email|forgot-password|reset-password|me|profile|2fa|oauth)(\/|$|\?)/i;

export function isAuthStaticAssetRequest(req) {
  const url = (req?.url || "").split("?")[0];
  return /^\/auth\/slide-\d+\.png$/i.test(url) || /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url);
}

/**
 * @param {{ url?: string, headers?: { accept?: string } }} req
 * @returns {string | undefined} Return a path to serve locally, or undefined to proxy.
 */
export function authProxyBypass(req) {
  const url = (req?.url || "").split("?")[0];

  if (isAuthStaticAssetRequest(req)) {
    return url;
  }

  if (AUTH_API_PATH_RE.test(url)) {
    return undefined;
  }

  if (req?.headers?.accept?.includes("text/html")) {
    return "/index.html";
  }

  return undefined;
}
