# Insights Iva — Frontend UI/UX Audit Report

**Date:** 24 August 2026  
**Scope:** React frontend (`frontend/src`)  
**Goal:** Premium, consistent, accessible ERP UI using the Insights Iva design system — without breaking architecture, APIs, routes, or business logic.

---

## Executive Summary

Insights Iva uses a **centralized design system** with CSS tokens in `index.css`, a JavaScript barrel at `design-system/`, and domain shells for accounts, inventory, and settings. Brand primary is **forest green** (`#036f71`) on canvas `#f2f7f5`.

August 2026 work hardened shared components, migrated high-traffic modules, integrated **Settings into the main ERP shell**, added **shared date/calendar controls**, and completed an **action-based button consistency pass** (24 Aug) covering toolbar Add/Create CTAs, table row actions, and semantic color roles.

**Build status:** `npm run build` passes. **Button tests:** `Button.test.jsx` covers primary, add, view, and edit variants.

---

## Design System

### Token layers

| Layer | Location | Purpose |
|-------|----------|---------|
| CSS tokens | `frontend/src/index.css` | Colors, typography, `.ui-*` button utilities |
| Class tokens | `design-system/classes.js` | `inputClass`, `selectClass`, `tableWrapClass` |
| Barrel | `design-system/index.js` | Single import for tokens + components |
| ERP forms | `design-system/erpFormControls.jsx` | `SoftInput`, `SoftSelect`, `FieldLabel`, `Pill` |
| Date/time | `design-system/dateControls.jsx` | `DatePicker`, `DateRangePicker`, `FloatingDate` |
| Date helpers | `utils/dateUtils.js` | `todayIso()`, timezone-safe ISO |
| Status | `design-system/statusTone.js` | `resolveStatusTone()` |

### Brand palette

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Brand primary | `--color-primary` | `#036f71` | Submit/Save, focus, nav active, links |
| **Add CTA** | `--color-add` | `#0f5f78` | Toolbar/list “+ Add …” / “Create …” |
| Add hover / active | `--color-add-hover` / `-active` | `#0a4d63` / `#083f52` | Add button states |
| View / approve | `--color-action-view` | `#2e9b72` | View, Open, Approve, Confirm |
| Edit / update | `--color-action-edit` | `#3182ce` | Edit, Update |
| Danger | `--color-danger` | `#e24a4a` | Delete, Remove |
| Canvas | `--color-bg` | `#f2f7f5` | Page background |
| Primary soft | `--color-primary-soft` | `#e6f4f4` | Section headers, KPI wells |

---

## Button Action System (24 Aug 2026)

### Principle

**Color communicates intent, not decoration.** One shared `Button` component; no page-level hex for standard actions.

### Variants

| Variant | Visual | When to use |
|---------|--------|-------------|
| `add` | Teal-blue `#0F5F78`, white text, Plus icon, 40px × 8px radius | Page header “+ Add New”, “Create Bill”, “Add Vendor”, empty-state CTA |
| `primary` | Brand green `#036F71` | Form Submit, Save, Confirm workflow step, Issue Material |
| `secondary` | White + border | Cancel, Back, Close |
| `view` | Green `#2E9B72` | View, Open, Approve, Acknowledge |
| `edit` | Blue `#3182CE` | Edit, Save Changes (existing record) |
| `danger` | Red `#E24A4A` | Delete, Remove, Finalize destructive |
| `warning` | Amber | Hold, Pending, Review Required |
| `outline` / `ghost` | Border / minimal | Export, filters, icon chrome |

### Components

| Component | Path | Notes |
|-----------|------|-------|
| `Button` | `components/common/Button.jsx` | All variants; `forwardRef`; Link/`to`/`href` support; loading spinner |
| `AddButton` | Same file | Defaults `variant="add"` + Plus icon |
| `TableActionButtons` | `components/common/TableActionButtons.jsx` | `[View] [Edit] [Delete]` with Eye/Pencil/Trash |
| `RowActionMenu` | `components/common/RowActionMenu.jsx` | Portal menu; tones via `rowActionTone.js` |
| `EmptyState` | `components/common/EmptyState.jsx` | Uses `AddButton` for create CTA |
| `ResourcePage` | `components/common/ResourcePage.jsx` | Header create uses `AddButton` |

### CSS specification (`add` variant)

| Property | Value |
|----------|-------|
| Background | `#0F5F78` |
| Hover | `#0A4D63` |
| Active | `#083F52` |
| Height | 40px (`2.5rem`) |
| Padding | 0 16px |
| Border radius | 8px |
| Font | 14px / weight 600 |
| Icon gap | ~7px |
| Shadow | Subtle only — no gradient or glow |

### Migration coverage (24 Aug)

| Module | Status |
|--------|--------|
| Sales (customers, bills, orders, invoices, quotations, credit/debit notes, challans, refunds) | Toolbar + empty states → `add` |
| Procurement (vendors, POs, RFQ, GRN, material requests, vendor bills) | Migrated |
| Inventory (items, warehouses, RM, FG, transfer, adjustment, stock in/return) | Migrated |
| Accounts (ledger add customer/vendor, COA, journals, budget, cost allocation, AP) | Migrated |
| HR (employees, shifts, assets, documents, training, payroll, leave, recruitment, dashboard) | Migrated |
| Production (machines, work orders, schedules, job cards, daily reports) | Migrated |
| Maintenance (schedule, preventive, breakdown, equipment) | Migrated |
| Admin (users, roles) | Migrated |
| Documents, alerts, settings delivery locations | Migrated |
| Quality (inspection empty CTAs) | Migrated |

**Intentionally unchanged:**

- Form **Save/Submit** buttons — remain `primary` green
- **Toggle switches**, KPI card accent colors, tab pill active states
- Inline **“+ Add Item”** text links inside invoice/document line editors (secondary inline pattern)
- **Report Incident** (HR) — red safety CTA
- AI chat FAB launcher — floating action, not standard toolbar button

---

## Components Improved (prior passes)

### Shared

| Component | Notes |
|-----------|-------|
| `FormField.jsx` | Input, Select, Textarea; date types get single calendar trigger |
| `FilterBar.jsx` | Finance, Quality, Maintenance filters |
| `LiveIndicator.jsx` | Workflow hub live badge |
| `PermissionGate.jsx` | Via `usePermissions()` |

### Date & calendar (21 Aug 2026)

| Item | Detail |
|------|--------|
| Root cause (fixed) | Global CSS had hidden all `::-webkit-calendar-picker-indicator` |
| Shared module | `dateControls.jsx` — native `showPicker()` + one custom calendar button |
| Duplicate icons (fixed) | Native indicator hidden on `.ui-date-input` |
| Remaining | ~120 files still use raw `type="date"` (functional after CSS fix) |

### Settings UI (Aug 2026)

- Settings routes inside main ERP layout (sidebar + navbar visible).
- Dark navy hero/background only when dark theme active.

### Manufacturing UX (21 Aug 2026)

- 9-step pipeline; `WorkflowStagePipeline`, `RoleWorkflowBoard`, admin hub KPIs from live data.

### Store Manager sidebar (21 Aug)

- Full Purchases group; Subscription/Logout removed from store sidebar (logout in global header).

---

## Modules Migrated (summary)

| Module | Status |
|--------|--------|
| Accounts (Ledger, COA, journals, reports) | Shell + tokens + add buttons |
| Inventory (V2, FG, RM, transfer, adjustment) | Shell + add buttons |
| ERP document forms (10) | `erpFormControls.jsx` |
| Sales/procurement list pages | `add` variant CTAs |
| HR dashboards | Mockup UI + `AddButton` headers |
| Table row actions (high-traffic lists) | `TableActionButtons` / semantic variants |

---

## Functional UX Fixes

| Issue | Fix |
|-------|-----|
| Inconsistent green Add buttons | Unified `add` variant (#0F5F78) |
| Mixed View/Edit/Delete colors | `TableActionButtons` + row menu tones |
| Two calendar icons on date fields | Hide native indicator when custom button present |
| Settings felt disconnected | Moved into ERP shell |
| Store Manager missing purchase pages | Full Purchases group in store nav |
| Row menus clipped in tables | Portal positioning |

**No routing, API contract, or database schema changes for UI-only work.**

---

## Responsive & Accessibility

- Tables: horizontal scroll via `ui-table-wrap`
- Forms: labels via `FormField`; focus rings on inputs and buttons (`:focus-visible`)
- Buttons: `aria-busy` when loading; icon buttons use `aria-label`
- Menus: `aria-expanded`, Escape to close
- Route fallback: `role="status"` spinner
- Skip link: `App.jsx` uses accessible skip-to-content control

---

## RBAC & Navigation UX (21 Aug)

| Check | Behavior |
|-------|------------|
| Sidebar | Module-tagged items filtered by role |
| Unauthorized URL | `AccessDenied` page |
| Refresh | JWT role → `/auth/me` restores correct menu |
| Role login redirect | `roleRedirect.js` per role |

---

## Testing

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| `npm test -- --run src/components/common/Button.test.jsx` | Pass (primary, add, view, edit, loading, link) |
| `pytest test_workflow_state_machine` | Pass |
| Playwright E2E | Not configured — recommended |
| Visual regression | No baseline in repo |

### Recommended next steps

1. Playwright: login per role → sidebar snapshot → one forbidden URL.
2. Migrate high-traffic raw date inputs to `DatePicker`.
3. HR dashboards → shared `KpiCard` + tokens (reduce inline indigo).
4. Optional: inline form “+ Add Item” links → shared link-button component.

---

## Remaining Issues

| Priority | Issue |
|----------|-------|
| Low | Inline “+ Add Item” / “+ Add Buyer” links in document forms still use legacy link styling |
| Medium | HR KPI cards use inline indigo instead of shared `KpiCard` |
| Medium | ~120 files still on raw `type="date"` (functional; not fully standardized) |
| Medium | `SettingsContext.dateFormat` not wired to pickers/display |
| Low | 50+ modals duplicate footer button rows (could use shared modal footer) |
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
| 2026-08-21 | Manufacturing IA pass; 9-step pipeline; Store Manager nav; date controls |
| 2026-08-24 | **Action-based button system:** `add`/`view`/`edit` variants, `AddButton`, `TableActionButtons`, 80+ page Add/Create migration; button unit tests |
