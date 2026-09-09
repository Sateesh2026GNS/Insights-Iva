# Insights Iva — UI State Standard (Mandatory)

Every API-driven screen must communicate one of these states clearly:

| # | State | Component | When |
|---|--------|-----------|------|
| 1 | Loading | `LoadingState`, `Loader`, `SkeletonTable`, `AsyncPageBody` | Fetching data, saving, processing |
| 2 | Empty | `EmptyState` | API succeeded, zero records |
| 3 | Success | `SuccessState` + `useToast` | Create/update/delete/approve succeeded |
| 4 | Error | `ErrorState` | Server/unexpected failure |
| 5 | No Internet | `NetworkErrorState`, `OfflineState`, `OfflineBanner` | Network failure / offline |
| 6 | Permission | `PermissionDeniedState`, `AccessDenied` | HTTP 403 / RBAC block |
| 7 | Partial Data | `PartialDataState` | Some sections loaded, others failed |
| 8 | Validation | `FieldError`, `applyBackendFieldErrors()` | Form field / 400 / 422 |
| 9 | Session Expired | `SessionExpiredModal` | HTTP 401 after refresh fails |

## Import surface

```js
import {
  AsyncPageBody,
  LoadingState,
  EmptyState,
  ErrorState,
  NetworkErrorState,
  PermissionDeniedState,
  PartialDataState,
  SuccessState,
  FieldError,
  NoResultsState,
} from "../components/common/states";
// or from "../design-system"
```

## Async list / page pattern

```jsx
const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState("");
const [loadErrorObj, setLoadErrorObj] = useState(null);

// In fetch catch:
const classified = classifyApiError(err, "Could not load data.");
setLoadError(classified.message);
setLoadErrorObj(err);

<AsyncPageBody
  loading={loading}
  error={loadError}
  errorObj={loadErrorObj}
  online={online}
  onRetry={reload}
  loadingVariant="skeleton"
>
  {/* table or content */}
</AsyncPageBody>
```

## API error helpers (`utils/apiError.js`)

- `classifyApiError(err)` — routes to correct UI state type
- `apiErrorMessage(err)` — user-facing message (never raw Axios text)
- `httpStatusMessage(err)` — status-aware message for interceptors
- `mapValidationErrorsToFields(err)` — FastAPI 422 → `{ field: message }`
- `applyBackendFieldErrors(err, setFieldErrors, fieldMap)` — merge into form state
- `isNetworkError(err)` — connectivity detection

## HTTP mapping

| Status | UI |
|--------|-----|
| 200/201/204 | Success (toast or `SuccessState`) |
| 400/422 | Field validation (`FieldError`) |
| 401 | `SessionExpiredModal` (axios + AuthContext) |
| 403 | `PermissionDeniedState` / `AccessDenied` |
| 404 | Friendly not-found message |
| 409 | Business conflict message from API envelope |
| 5xx | `ErrorState` — never expose stack traces |
| Network | `NetworkErrorState` — not generic error |

## Rules

- Never show blank white screens during load
- Never show raw `Request failed with status code …`
- Never use mock/sample data to hide empty states
- Preserve form data on validation/network errors
- Use `Button` `loading` prop to prevent duplicate submits
- Session handling stays in existing auth architecture

See [UI_STATE_AUDIT.md](./UI_STATE_AUDIT.md) for module-by-module status.
