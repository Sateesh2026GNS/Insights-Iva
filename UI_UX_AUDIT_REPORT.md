# Insights Iva — Frontend UI/UX Audit Report

**Date:** 21 August 2026  
**Scope:** React frontend (`frontend/src`)  
**Goal:** Premium, consistent, accessible ERP UI using the Insights Iva forest green brand — without breaking architecture, APIs, routes, or business logic.

---

## Executive Summary

Insights Iva uses a **centralized design system** with CSS tokens in `index.css`, a JavaScript barrel at `design-system/`, and domain shells for accounts, inventory, and settings. Brand primary is **forest green** (`#036f71`) on canvas `#f2f7f5`.

August 2026 work hardened shared components, migrated high-traffic modules, integrated **Settings into the main ERP shell**, added **shared date/calendar controls**, and refactored key procurement forms. **Build status:** `npm run build` passes.

---

## Design System

### Token layers

| Layer | Location | Purpose |
|-------|----------|---------|
| CSS tokens | `frontend/src/index.css` | Colors, typography, `.ui-*` utilities |
| Class tokens | `design-system/classes.js` | `inputClass`, `selectClass`, `tableWrapClass` |
| Barrel | `design-system/index.js` | Single import for tokens + components |
| ERP forms | `design-system/erpFormControls.jsx` | `SoftInput`, `SoftSelect`, `FieldLabel`, `Pill` |
| Date/time | `design-system/dateControls.jsx` | `DatePicker`, `DateRangePicker`, `FloatingDate`, … |
| Date helpers | `utils/dateUtils.js` | `todayIso()`, timezone-safe ISO, range presets |
| Status | `design-system/statusTone.js` | `resolveStatusTone()` |

### Brand palette

| Role | Token | Use |
|------|-------|-----|
| Primary | `--color-primary` `#036f71` | Buttons, focus, nav active, links |
| Primary soft | `--color-primary-soft` | Section headers, KPI backgrounds |
| Canvas | `--color-bg` `#f2f7f5` | Page background |
| Info | `--color-info` | Workflow in-progress (blue, not brand) |
| Success / Warning / Danger | Semantic greens, amber, red | Status badges, alerts |

---

## Components Improved

### Shared

| Component | Notes |
|-----------|-------|
| `Button.jsx` | Canonical variants via `.ui-btn--*` |
| `FormField.jsx` | `Input`, `Select`, `Textarea`; date types get single calendar trigger |
| `FilterBar.jsx` | Finance, Quality, Maintenance filters |
| `RowActionMenu.jsx` | Portal + viewport flip |
| `LiveIndicator.jsx` | Workflow hub live badge |
| `PermissionGate.jsx` | Available; use via `usePermissions()` |

### Date & calendar (21 Aug 2026)

| Item | Detail |
|------|--------|
| Root cause (fixed) | Global CSS had hidden all `::-webkit-calendar-picker-indicator` — broke native pickers app-wide |
| Shared module | `dateControls.jsx` — native `showPicker()` + one custom calendar button |
| Duplicate icons (fixed) | Native indicator hidden on `.ui-date-input` (custom button present); spin/clear chrome hidden |
| Timezone | `todayIso()` replaces `toISOString().slice(0,10)` in migrated forms |
| Remaining | ~120 files still use raw `type="date"` with native picker (single icon after CSS fix) |

### Settings UI (Aug 2026)

| Change | Detail |
|--------|--------|
| Shell | Settings routes stay inside main ERP layout (sidebar + navbar visible) |
| Dark theme | Navy hero/background only when dark theme (moon icon) active |
| Components | `SettingsPageShell`, `SettingsHero`, grouped list rows, mobile nav |
| Search | Reduced hero search bar size; token-aligned colors |

### Domain shells

| Shell | Covers |
|-------|--------|
| Accounts | `accountsDesignSystem.jsx` — page shell, tables, inputs |
| Inventory | `inventoryDesignSystem.jsx` — tabs, pagination, tables |
| Settings | `settingsUi.jsx`, `settingsCatalog.js` |

### Manufacturing workflow UI

- `ManufacturingWorkflowHub`, `SalesJobCardPage`, `CreateSalesOrder` — 2-column reference layout, brand green accents.
- Admin hub simplified per spec (no Refresh, 16-card grid, or activity feed).

### Manufacturing UX pass (21 Aug 2026 — IA + workflow)

| Change | Detail |
|--------|--------|
| **Information architecture** | New top-level **Manufacturing** sidebar section (Workflow Board, stage-filter deep links); removed duplicate “Manufacturing Workflow” from Sales |
| **9-step pipeline** | `WorkflowStagePipeline` expanded to Sales → Inventory → Store → Prod. Mgr → Operator → Quality → Packing → Billing → Completed |
| **Tracker unification** | `JobCardWorkflowStatus` delegates to shared `WorkflowTracker` (blocked/rejected states everywhere) |
| **Workflow board** | `RoleWorkflowBoard` uses `ManufacturingPageHeader`, full 9-stage process map, priority badges, per-order tracker |
| **Admin dashboard** | `ManufacturingWorkflowHub` KPI cards from live PostgreSQL counts; live job cards with mini tracker; fixed missing `Link` import |
| **Store Manager** | Manufacturing nav group + `/manufacturing/*` route access for inventory/store workflow stages |
| **Administration nav** | Pending Approvals + Integrations linked in sidebar |

### Store Manager sidebar (21 Aug)

- Dedicated nav in `storeManagerNavConfig.js`.
- **Purchases:** Stock In, Requisitions, Purchase, Payments Made, Debit Note, PO, GRN, Supplier Payments.
- **Removed from sidebar:** Subscription, Contact Us (My Account), Logout (available from global header/user menu).

### Procurement form polish

- `CreateSupplierPayment.jsx` — design-system form, empty state for no vendors, `DatePicker`, role-appropriate layout.

---

## Modules Migrated (summary)

| Module | Status |
|--------|--------|
| Accounts (Ledger, COA, journals, reports) | Migrated to accounts shell + design tokens |
| Inventory (V2, FG, RM, transfer, adjustment) | Migrated to inventory shell |
| ERP document forms (10) | `erpFormControls.jsx` |
| Sales/procurement modals | `classes.js` input tokens |
| Reports filters | Shared `FloatingDate` / `DateRangePicker` |
| HR dashboards | Mockup UI; indigo KPI cards (not yet on shared `KpiCard`) |

---

## Functional UX Fixes

| Issue | Fix |
|-------|-----|
| Two calendar icons on date fields | Hide native indicator when custom `.ui-date-input` button present |
| Settings felt disconnected | Moved into ERP shell; dark navy only in dark mode |
| Store Manager missing purchase pages | Full Purchases group in store nav |
| Record supplier payment poor UX | Redesigned form + empty vendor state |
| Row menus clipped in tables | Portal positioning |
| Duplicate badge CSS | Single `.ui-badge` in `index.css` |
| Manufacturing hub legacy blue | Replaced with brand CSS variables |

**No routing, API contract, or database schema changes for UI-only work.**

---

## Responsive & Accessibility

- Tables: horizontal scroll via `ui-table-wrap`
- Forms: labels via `FormField` / `FieldLabel`; focus rings on inputs
- Menus: `aria-expanded`, Escape to close, keyboard-friendly row actions
- Date pickers: calendar button has `aria-label`; Escape blurs input
- Route fallback: `role="status"` spinner

---

## RBAC & Navigation UX (21 Aug)

| Check | Behavior |
|-------|------------|
| Sidebar | Module-tagged items filtered by role; Store Manager uses custom nav |
| Parent sections | Hidden when no visible children |
| Unauthorized URL | `AccessDenied` page (not blank, not 404) |
| Refresh | JWT role → `/auth/me` restores correct menu |
| Role login redirect | `roleRedirect.js` per role |

---

## Testing

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| `npm test -- --run` | Pass (when run) |
| `pytest test_workflow_state_machine` | Pass |
| Playwright E2E | Not configured — recommended |
| Visual regression | No baseline in repo |

### Recommended next steps

1. Playwright: login per role → sidebar snapshot → one forbidden URL.
2. Migrate high-traffic raw date inputs to `DatePicker`.
3. HR dashboards → shared `KpiCard` + tokens.
4. Remove residual purple link colors in sales/procurement lists.

---

## Remaining Issues

| Priority | Issue |
|----------|-------|
| Medium | Residual `#6b4eff` in PaymentReceipts, CreditNotes, list page links |
| Medium | HR KPI cards use inline indigo instead of `KpiCard` |
| Medium | ~120 files still on raw `type="date"` (functional; not fully standardized) |
| Medium | `SettingsContext.dateFormat` not wired to pickers/display |
| Low | 50+ modals duplicate footer button rows |
| Low | Some routes bypass `.ui-page` padding |
| Low | npm audit advisories on export libs (dependency, not UI) |

---

## Related Documentation

- [README.md](./README.md) — setup, RBAC, design system overview  
- [SECURITY_REPORT.md](./SECURITY_REPORT.md) — auth/session (separate from visual UX)  
- [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md) — architecture, RBAC flow  

---

## Change Log

| Date | Note |
|------|------|
| 2026-08-16 | Initial audit: badges, row menu, modal CSS, accounts shell |
| 2026-08-18 | Forest green rebrand; design-system module; ERP forms; manufacturing UI |
| 2026-08-21 | Manufacturing IA pass: nav section, 9-step pipeline, tracker unification, workflow board UX, admin hub KPIs |
