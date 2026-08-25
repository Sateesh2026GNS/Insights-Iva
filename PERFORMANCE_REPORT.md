# Application Performance Optimization Report

**Date:** 2026-08-25  
**Scope:** Frontend route loading, API deduplication/caching, inventory search debouncing, backend N+1 query fixes  
**Constraint:** No business logic, API contracts, RBAC, or route changes beyond lazy-loading equivalents.

---

## 1. Major Bottlenecks Found (Before)

| Area | Issue | Impact |
|------|--------|--------|
| **Initial bundle** | Login, factory-monitor pages, and `AiChatWidget` (jspdf) loaded eagerly with app shell | Larger first paint / slower auth routes |
| **Reference data** | `getCustomers`, `getVendors`, `getWarehouses`, `getProducts`, `getCompanySettings` re-fetched on every form/page navigation | Duplicate network on Sales/Purchase/Inventory flows |
| **Store Stock In/Return** | Search keystroke re-fetched list **and** 4–5 reference APIs per character | Heavy API storm while typing |
| **Inventory lists (backend)** | `list_materials_enriched` / `list_finished_goods_enriched`: 3 SQL queries **per row** | Raw Materials / Finished Goods pages slow at scale |
| **Vendor list (backend)** | `list_vendors_enriched`: 3 SQL queries **per vendor** (outstanding + product IDs) | Vendors page slow at scale |
| **Route splitting** | Already strong (~96% lazy via `lazyPages.jsx`) | Low-hanging fruit was eager imports, not new routes |

---

## 2. Optimizations Implemented

### Frontend — Route navigation

- **Login** → lazy via `P.Login` (removed static import from `AppRoutes.jsx`)
- **Factory monitor** → `FactoryMonitorMachineStatus`, `FactoryMonitorProductionLines` added to `lazyPages.jsx`
- **AiChatWidget** → `React.lazy()` + `Suspense` in `App.jsx` (jspdf no longer in main app graph until chatbot opens)
- Removed unused `PlaceholderPage` import from `AppRoutes.jsx`

### Frontend — Reference data caching

New: `frontend/src/utils/referenceDataCache.js`

- In-memory TTL cache (3 min), tenant-scoped
- Integrated into:
  - `fetchCustomersWithFallback()` (`customerOptions.js`)
  - `fetchProductsWithFallback()` (`productOptions.js`)
  - `getWarehouses()` (`inventoryApi.js`)
  - `getVendors()` unfiltered list (`procurementApi.js`)
  - `getCompanySettings()` (`settingsApi.js`)
- Invalidated on: login/logout (`AuthContext`), global Refresh (`pageRefresh.js`), company settings update

### Frontend — Search / API debouncing

New: `frontend/src/hooks/useDebouncedValue.js` (350ms)

- **StoreStockIn.jsx** — split `loadReferenceData()` (once) vs `loadList()` (debounced search + filters)
- **StoreStockReturn.jsx** — same pattern

### Backend — Batch queries

**`inventory_extended_service.py`**

- `_batch_total_stock()` — single `GROUP BY item_id` query
- `_batch_primary_warehouse()` — batch warehouse lookup
- `_batch_suppliers()` — batch supplier fetch
- Applied to `get_materials_summary`, `list_materials_enriched`, `list_finished_goods_enriched`

**`vendor_service.py`**

- `_batch_outstanding_for_suppliers()` — 2 grouped queries for all vendors
- `_batch_product_ids()` — single query for all vendor product mappings
- `list_vendors_enriched()` uses batch maps (was N×3 queries)

---

## 3. What Was Preserved

- All API endpoints and response shapes unchanged
- RBAC / auth checks unchanged
- Client-side table search (SearchBar/DataTable) unchanged — already in-memory
- Route paths and permissions unchanged
- No localStorage as fake server persistence (cache is in-memory only, cleared on logout/refresh)

---

## 4. Verification

- `npm run build` — **passes**
- Python syntax check on modified backend services — **passes**

---

## 5. Remaining Slow Areas / Follow-up Recommendations

| Priority | Item | Notes |
|----------|------|-------|
| **High** | `invoice_v2_service.py` summary loads all invoices before pagination | SQL `GROUP BY` for summary; push `due` filter to SQL |
| **High** | `sales_extended_service.py` hub + enriched SO warehouse N+1 | Batch warehouse lookup |
| **Medium** | i18n — load only `en` at boot; lazy-load `hi`/`ta`/`te` | Reduces initial JS |
| **Medium** | Lazy-load Sidebar/Navbar on shell-less routes (`/login`) | Smaller login bundle |
| **Medium** | `useCompanySettings` in forms instead of raw `getCompanySettings()` per form | Partially addressed via API cache |
| **Medium** | Table virtualization for 1000+ row client-side pages | Only if profiling shows scroll jank |
| **Low** | PostgreSQL indexes on `sales_orders.status`, `invoices.issue_date`, `material_request_lines.material_request_id` | Add via migration after EXPLAIN analysis |
| **Low** | React Query / SWR | Larger refactor; current TTL cache covers main duplicate fetches |

---

## 6. Expected User Experience

- **Navigation:** Route chunks load on demand; shell (sidebar/nav) stays visible during transitions (`RouteFallback`)
- **Forms:** Customer/vendor/warehouse/product/company settings reuse cached data within session (3 min TTL)
- **Store Manager stock pages:** Typing in search no longer fires 6 API calls per keystroke
- **Inventory/Vendors lists:** Backend list endpoints scale with ~3 batch queries instead of 3×N per row

---

## 7. Manual Test Checklist

Test in browser (Network tab open):

1. Login → Dashboard — smaller initial chunk vs before (no jspdf until chatbot)
2. Dashboard → Sales → Inventory — no duplicate `/sales/customers` + cached `/procurement/vendors` within TTL
3. Store Stock In — type in search; verify debounced `/inventory/stock-ins` only (not warehouses/suppliers each key)
4. Raw Materials / Vendors — list loads; compare backend query count in logs
5. Global Refresh — reference cache clears; data refetches once
6. RBAC, dark mode, CRUD — unchanged behavior
