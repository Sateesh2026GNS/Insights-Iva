# Cookie domain plan: first-party API on `api.insightsiva.com`

## Problem

Today the SPA runs on `www.insightsiva.com` / Firebase hosts and the API on `insights-iva-api.onrender.com`. Session cookies (`iva_at`, `iva_rt`) and CSRF are **third-party** from the browser’s perspective. Safari ITP and Firefox strict tracking protection can block or partition those cookies, breaking login, refresh, and logout even with `SameSite=None; Secure`.

## Target architecture

| Item | Value |
|------|--------|
| SPA | `https://www.insightsiva.com` (unchanged) |
| API | `https://api.insightsiva.com` (Render **custom domain**) |
| Cookies | `AUTH_COOKIE_DOMAIN=.insightsiva.com`, `AUTH_COOKIE_SAMESITE=lax` (or `strict` for API-only subdomain) |
| CORS | `https://www.insightsiva.com`, `https://insightsiva.com`, Firebase hosts if still used |
| `ALLOWED_HOSTS` | `api.insightsiva.com`, … |
| Google OAuth redirect | `https://api.insightsiva.com/integrations/google/calendar/callback` |

First-party cookies: API and SPA share registrable domain `insightsiva.com`, so cookies set with `Domain=.insightsiva.com` are visible on credentialed XHR/fetch to `api.insightsiva.com` without third-party classification.

## Rollout order

1. Add DNS `CNAME` `api.insightsiva.com` → Render custom domain; verify TLS.
2. Deploy API with updated `CORS_ORIGINS`, `ALLOWED_HOSTS`, `FRONTEND_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URI` (staging first).
3. Set `AUTH_COOKIE_DOMAIN=.insightsiva.com`, `AUTH_COOKIE_SAMESITE=lax`, keep `AUTH_COOKIE_SECURE=true`.
4. Point frontend `VITE_API_BASE_URL` to `https://api.insightsiva.com`.
5. Re-test login, refresh, logout, file upload, Google Calendar connect.
6. Deprecate direct `onrender.com` API URL in docs after cutover.

## Rollback

- Revert frontend env to `onrender.com` API URL.
- Restore `AUTH_COOKIE_SAMESITE=none` and clear `AUTH_COOKIE_DOMAIN` on Render.
- Keep custom domain in place for a later retry.

## CSRF note

Cross-origin SPA must use **`csrf_token` in JSON** from `GET /auth/csrf` and login responses (not `document.cookie` on the SPA origin). Already implemented in axios memory store.

## Non-cookie fallback

`AUTH_COOKIE_MODE=dual` returns Bearer tokens in login JSON for clients that cannot use cookies (mobile, blocked third-party cookies). Production UI uses `cookie` mode; users with blocked cookies may see failed refresh until dual mode or first-party API domain is enabled—surface a clear “enable cookies or use supported browser” message (frontend follow-up).
