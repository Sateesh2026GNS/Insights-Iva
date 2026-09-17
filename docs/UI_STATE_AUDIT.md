# UI State Audit — Insights Iva

**Date:** 9 September 2026  
**Standard:** [UI_STATE_STANDARD.md](./UI_STATE_STANDARD.md)

Legend: ✓ Implemented · ⚠ Needs improvement · ✗ Missing

| Page / Module | Loading | Empty | Success | Error | No Internet | Permission | Partial Data | Validation | Session Expired |
|---------------|---------|-------|---------|-------|-------------|------------|--------------|------------|-----------------|
| **Global infrastructure** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard (reference) | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ | ⚠ | — | ✓ |
| Sales Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Customers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| My Job Cards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sales Orders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ⚠ | ✓ |
| Quotations / Invoices | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ✓ | — | ⚠ | ✓ |
| ResourcePage modules (7) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ |
| Inventory v2 | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓ | — | ⚠ | ✓ |
| HR module | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ✓ | — | ⚠ | ✓ |
| Production / Work Orders | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ✓ | — | ⚠ | ✓ |
| Maintenance | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ✓ | — | ⚠ | ✓ |
| Analytics | ✓ | ⚠ | ✓ | ⚠ | ⚠ | ✓ | — | — | ✓ |
| Settings | ✓ | — | ✓ | ⚠ | ⚠ | ✓ | — | ⚠ | ✓ |
| Auth (Login/Register) | ✓ | — | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |

## Centralized components added

| Component | Path |
|-----------|------|
| `AsyncPageBody` | `frontend/src/components/common/states/AsyncPageBody.jsx` |
| `LoadingState` | `frontend/src/components/common/states/LoadingState.jsx` |
| `NetworkErrorState` | `frontend/src/components/common/states/NetworkErrorState.jsx` |
| `PermissionDeniedState` | `frontend/src/components/common/states/PermissionDeniedState.jsx` |
| `PartialDataState` | `frontend/src/components/common/states/PartialDataState.jsx` |
| `SuccessState` | `frontend/src/components/common/states/SuccessState.jsx` |
| `FieldError` | `frontend/src/components/common/states/FieldError.jsx` |

Barrel export: `frontend/src/components/common/states/index.js`  
Design system: `frontend/src/design-system/index.js`

## API error utilities extended

`frontend/src/utils/apiError.js`:

- `isNetworkError`, `isPermissionError`, `isAuthError`, `isConflictError`, `isValidationError`
- `classifyApiError` — routes errors to UI state types
- `mapValidationErrorsToFields` — FastAPI validation → field map
- `applyBackendFieldErrors` — merge backend errors into React form state

## High-impact fixes in this pass

1. **Customers** — `AsyncPageBody`, proper empty/no-results, network retry, no toast-only failure
2. **Sales Dashboard** — removed `localStorage` fake KPI fallback; error + empty states
3. **My Job Cards** — `AsyncPageBody`, `PartialDataState` for workflow meta failure
4. **Add Customer form** — field-level validation errors from backend
5. **ResourcePage** — `classifyApiError` for load failures

## Remaining work (lower priority)

- Migrate ~100 hand-rolled list pages to `AsyncPageBody` or `useAsyncResource`
- Replace `AnalyticsErrorState` / `MaintenanceErrorState` duplicates with `ErrorState`
- Wire `markRequestStart/End` on all data fetches for slow-network banner
- Document forms: adopt `FieldError` + `applyBackendFieldErrors` consistently
- Dashboard partial-data banners for multi-KPI fetches

## Verification

```bash
cd frontend
npm run build
npm test
```
