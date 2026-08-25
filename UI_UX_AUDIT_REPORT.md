# Insights Iva — Frontend UI/UX Audit Report

**Date:** 25 August 2026 (updated)  
**Scope:** React frontend (`frontend/src`)  
**Goal:** Premium, consistent, accessible ERP UI using the Insights Iva design system — without breaking architecture, APIs, routes, or business logic.

---

## Executive Summary

Insights Iva uses a **centralized design system** with CSS tokens in `index.css`, a JavaScript barrel at `design-system/`, and domain shells for accounts, inventory, and settings. Brand primary is **forest green** (`#036f71`) on canvas `#f2f7f5`.

August 2026 work hardened shared components, migrated high-traffic modules, integrated **Settings into the main ERP shell**, added **shared date/calendar controls**, completed an **action-based button consistency pass** (24 Aug), and standardized **list and embedded search bars** (25 Aug) using the Vendors page as the visual reference.

**Build status:** `npm run build` passes. **Button tests:** `Button.test.jsx` covers primary, add, view, and edit variants.

---

## Search Bar System (25 Aug 2026)

### Principle

**One search component, two sizes.** The **Vendors page** search bar is the reference for all main list/table toolbars. Embedded contexts (dropdowns, forms, filters, autocomplete) use the same brand styling at **`size="compact"`** — smaller height and padding, identical pill shape, icon, focus, and theme tokens.

### Reference design (default)

| Property | Value |
|----------|-------|
| Component | `SearchBar` in `components/common/SearchFilter.jsx` |
| Wrap | `relative ui-search-wrap min-w-[10rem] flex-1` |
| Input | `ui-input w-full !rounded-full !pl-10` |
| Icon | Lucide `Search`, `left-3.5`, `text-[var(--color-text-icon)]` |
| Clear | Optional `X` when value present |
| Theme | `--color-*` tokens only — no hardcoded white/black backgrounds |

### Compact variant (`size="compact"`)

| Property | Value |
|----------|-------|
| Use when | Dropdown filter search, form party/item pickers, settings column filters, combobox/autocomplete |
| **Do not use for** | Main page/table toolbar search (keep default size) |
| Height | `--control-h-sm` via `.ui-search-input--compact` |
| CSS | `.ui-search-wrap--compact` in `index.css` |

### Shared components & wrappers

| Component | Path | Role |
|-----------|------|------|
| `SearchBar` | `components/common/SearchFilter.jsx` | Canonical search UI |
| `SearchFilter` / `FilterBar` | Same + `FilterBar.jsx` | Toolbar search + filter rows |
| `DataTable` | `components/common/DataTable.jsx` | Built-in table search → `SearchBar` |
| `AccountsSearchInput` | `accountsDesignSystem.jsx` | Delegates to `SearchBar` |
| `InventorySearchInput` | `inventoryDesignSystem.jsx` | Delegates to `SearchBar` |
| `SettingsSearchInput` | `pages/settings/settingsUi.jsx` | Delegates to `SearchBar` |
| `SearchableSelect` | `components/common/SearchableSelect.jsx` | Dropdown list search → compact `SearchBar` |
| `AccountSearchSelect` | `components/accounts/AccountSearchSelect.jsx` | Journal combobox → compact `SearchBar` + portaled list |

Exported tokens: `SEARCH_BAR_*` and `SEARCH_BAR_COMPACT_*` via `design-system/index.js`.

### Migration coverage (25 Aug)

| Area | Status |
|------|--------|
| **Masters** — Vendors (reference), Products, Customers, BOM, Departments, Vendor Management | Default `SearchBar` |
| **Sales** — quotations, bills, invoices, credit/debit notes, challans, refunds, export/proforma, invoice dashboard, customers | Default `SearchBar` |
| **Purchases / procurement** — purchases, payments, debit notes, POs, create PO | Default + compact (filters/forms) |
| **Inventory** — RM, FG, warehouses, transfer, adjustment, stock ledger, stock in/return, InventoryV2 | Default `SearchBar` |
| **Production** — work orders, planning, schedule, machine allocation/status, task mgmt, daily reports, batch tracking | Default `SearchBar` |
| **Quality** — in-process/final/incoming QC, defect tracking, batch reports | Default toolbar + compact in `MultiSelectDropdown` |
| **Maintenance** — schedule, breakdown, machine history, equipment/spares | Default `SearchBar` |
| **Accounts / finance** — ledger, COA, journals, expense, reports, audit trail, restore deleted | Default + compact (filter dropdowns) |
| **HR list pages** | Via `DataTable` → `SearchBar` |
| **Settings** — home search, teams/package type column filters, my permissions, audit logs panel | Default or compact as appropriate |
| **Documents, alerts, job card filters** | Default `SearchBar` |
| **ERP forms (10+)** — buyer/vendor pickers, line-item cells | Compact `SearchBar` |
| **Pickers** — terms & conditions, dispatch address, payment receipt/make payment party search, refund party picker | Compact `SearchBar` |
| **Meetings** — calendar sidebar “meet with” search | Compact `SearchBar` |

**Intentionally unchanged:**

- **`GlobalSearch`** — navbar global search (separate component)
- **Login / auth** inputs — not list-search contexts

### Dark theme

All migrated search bars use `ui-input` and CSS variables (`--color-surface`, `--color-border`, `--color-text-placeholder`, `--color-focus-ring`). Legacy page-specific `bg-white` / `slate-*` search overrides were removed from maintenance and settings pages.

### Functional preservation

Search state, filtering logic, API parameters, pagination, combobox keyboard navigation, and portaled dropdown positioning were **not** changed — only component/UI wiring. `npm run build` passes after migration.

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
| `FilterBar.jsx` | Finance, Quality, Maintenance filters; uses `SearchBar` |
| `SearchFilter.jsx` | `SearchBar` (default + compact), `SearchFilter` wrapper |
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
| Inconsistent search bar styles across modules | Unified `SearchBar`; Vendors page as reference |
| Hardcoded light-only search on settings/maintenance | Theme tokens + `ui-input` |

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
| `npm run build` | Pass (includes search bar migration, 25 Aug) |
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
| 2026-08-25 | **Search bar standardization:** `SearchBar` default + `size="compact"`; Vendors reference; 40+ list pages + forms/dropdowns/comboboxes; dark theme tokens |
