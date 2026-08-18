# Insights Iva — Frontend UI/UX Audit Report

**Date:** 18 August 2026  
**Scope:** Full React frontend (`frontend/src`)  
**Goal:** Premium, consistent, accessible ERP UI using the Insights Iva forest green brand — without breaking architecture, APIs, routes, or business logic.

---

## Executive Summary

Insights Iva now has a **centralized design system** with CSS tokens in `frontend/src/index.css`, a JavaScript barrel at `frontend/src/design-system/`, and domain shells for accounts and inventory. The brand primary is **forest green** (`#036f71`) on a light green-gray canvas (`#f2f7f5`), with blue reserved for info/in-progress semantics and amber/red for warning/danger.

August 2026 passes **hardened shared components first**, then migrated high-traffic modules (accounts, inventory, sales modals, procurement create flows, ERP document forms, manufacturing workflow UI). No routing, API contract, or backend schema changes were made for styling work alone.

**Build status:** `npm run build` passes after the 18 Aug migration batch. Shared `erpFormControls` is code-split into its own Vite chunk.

---

## Design System

### Token layers

| Layer | Location | Purpose |
|-------|----------|---------|
| **CSS tokens** | `frontend/src/index.css` (`:root`) | Colors, typography, spacing, shadows, `.ui-*` utilities |
| **JS class tokens** | `frontend/src/design-system/classes.js` | `inputClass`, `selectClass`, `textareaClass`, `tableWrapClass`, typography shortcuts |
| **Barrel export** | `frontend/src/design-system/index.js` | Single import: tokens + `Button`, `FormField`, `FilterBar`, `StatusBadge`, domain shells |
| **ERP form primitives** | `frontend/src/design-system/erpFormControls.jsx` | `SoftInput`, `SoftSelect`, `FieldLabel`, `Pill`, `ERP_PRIMARY` / `ERP_PRIMARY_SOFT` |
| **Status semantics** | `frontend/src/design-system/statusTone.js` | `resolveStatusTone()` maps business statuses → badge tones |
| **Chart/theme mirrors** | `frontend/src/theme/colors.js`, `frontend/src/styles/theme.js` | Recharts and legacy JS color references |

### Brand palette (current)

| Role | Token | Value / use |
|------|-------|-------------|
| Primary | `--color-primary` | `#036f71` — buttons, focus rings, nav active, links |
| Primary soft | `--color-primary-soft` | `#e6f4f4` — section headers, active pills, KPI backgrounds |
| Canvas | `--color-bg` | `#f2f7f5` — page background |
| Success | `--color-success` | Green — completed, approved |
| Info / in-progress | `--color-info` | Blue — workflow in progress |
| Warning | `--color-warning` | Amber — pending, attention |
| Danger | `--color-danger` | Red — errors, destructive |
| Action teal / blue | `--color-action-teal`, `--color-action-blue` | Selective CTAs (purchases, invoices) where product spec requires |

### Utility classes

| Class | Use |
|-------|-----|
| `.ui-page`, `.ui-stack`, `.ui-card` | Page layout and vertical rhythm |
| `.ui-input`, `.ui-select`, `.ui-textarea` | Standard form controls with focus ring |
| `.ui-input.is-error`, `.is-success`, `:read-only` | Validation and disabled states |
| `.ui-table-wrap`, `.ui-table-wrap--scroll` | Horizontal scroll + row hover |
| `.ui-badge-*` | Semantic status badges |
| `.ui-page-title`, `.ui-section-title`, `.ui-label`, `.ui-hint` | Typography hierarchy |
| `.ui-btn--{variant}` | Button variants via `Button.jsx` |

---

## Components & Modules Improved

### Shared components

| Component | Change |
|-----------|--------|
| `Button.jsx` | Primary/success/warning/danger variants aligned to CSS tokens |
| `StatusBadge.jsx` | Accepts `tone` or `status` (auto-resolves via `resolveStatusTone`) |
| `FilterBar.jsx` | **New** — consolidated filter UI; used by Finance, Quality, Maintenance filters |
| `RowActionMenu.jsx` | Portal + viewport flip; design tokens; ARIA menu roles |
| `Breadcrumbs.jsx`, `SearchFilter.jsx`, `SkeletonCard.jsx` | Token-aligned styling |
| `LiveIndicator.jsx` | **New** — pulsing live badge for workflow hub |
| `Modal.jsx` | `.ui-modal-backdrop` / `.ui-modal` CSS |

### Domain shells

| Shell | Location | Covers |
|-------|----------|--------|
| **Accounts** | `components/accounts/accountsDesignSystem.jsx` | `AccountsPageShell`, table tokens, `ACCOUNTS_INPUT_CLASS`, row actions |
| **Inventory** | `components/inventory/inventoryDesignSystem.jsx` | `InventoryPageShell`, tabs, search, pagination, table tokens |

### Manufacturing workflow UI

| Component / page | Notes |
|------------------|-------|
| `ManufacturingWorkflowHub.jsx` | Stage pipeline, Live indicator, 30s auto-refresh; simplified hub (no Refresh, 16-card grid, or activity feed) |
| `SalesJobCardPage.jsx` | 2-column reference layout: summary + form / stepper + timeline |
| `JobCardSummary.jsx`, `JobCardWorkflowStatus.jsx`, `JobCardTimeline.jsx`, `WorkflowStagePipeline.jsx` | Brand green accents (replaced legacy `#195CCF` blue) |
| `CreateSalesOrder.jsx` | Same 2-column layout as Job Card; summary three-dot menu |
| `ReferenceDashboard.jsx`, `ReferenceParts.jsx` | Light KPI cards, semantic colors, `ui-page` layout |
| `Sidebar.jsx` | Active nav uses `--color-nav-active` |

### Accounts module (migrated)

LedgerV2, ChartOfAccountsV2, ManualJournalEntriesV2, LedgerDetailsV2, JournalEntries, RecordIncome/Expense, ChartOfAccounts, CostAllocation, FixedAssets, BudgetActual, ExpenseV2, ReportViewerV2, RestoreDeletedDocV2, CreateAccountModal, RecordPaymentModal, AdjustBalanceModal, NewJournalEntryV2.

### Inventory module (migrated)

InventoryV2, FinishedGoods, RawMaterials, StockAdjustment, StockTransfer, Warehouses, WarehouseDetailModal, InventoryLineItems, and related filters — via `inventoryDesignSystem`.

### Sales & procurement (migrated)

**Modals/forms:** AddCashAccountModal, AddNewPartyModal, AddPaymentModeModal, AddInvoiceDiscountModal, AddBasicDetailsModal, AddTransporterDetailsModal, AddOtherChargesModal, EditCompanyDetailsModal, DispatchAddressPicker, SalesOrderFormModal, PaymentReceiptForm, MakePaymentForm, CreateBill, RefundVouchers, AddNoteModal, AddTermsAndConditionsModal, AddNewItemModal, AddPrefixModal.

**ERP document forms (10 files):** QuotationForm, TaxInvoiceForm, ProformaInvoiceForm, CreditNoteForm, DebitNoteForm, ExportInvoiceForm, DeliveryChallanForm, PurchaseForm, PurchaseDebitNoteForm, CreatePurchaseOrder — now import `SoftInput` / `SoftSelect` / `FieldLabel` / `Pill` from `erpFormControls.jsx`.

**Procurement/inventory create:** CreateWarehouse, CreateSupplier, CreateMaterialRequest, CreateGoodsReceipt, CreateSupplierPayment, CreateVendor, CreateCompany, CreateMachine, SettingsDeliveryLocation, CompanyAddressFields.

**Other pages:** AlertsDashboard, DocumentsDashboard, CreateLeadModal, DepartmentDetailModal, VendorDetailModal, AuditLogsPanel, and 40+ list pages received consistent filter/toolbar/table token updates.

---

## Functional Issues Fixed

| Issue | Fix |
|-------|-----|
| Three-dot menus clipped in scrollable tables | `RowActionMenu` portal + viewport positioning |
| Inconsistent badge appearance (duplicate CSS) | Single `.ui-badge` definition in `index.css` |
| Accounts purple palette diverged from brand | Mapped to `--color-primary` forest green |
| Manufacturing hub used legacy blue `#195CCF` | Replaced with CSS brand variables |
| Page-local duplicate input class strings (100+ per form) | Centralized in `design-system/classes.js` and `erpFormControls.jsx` |
| `AddNewItemModal` / `WarehouseDetailModal` regressions during bulk edit | Restored constants; fixed broken `TABS` array |

**No routing, API, or backend business-logic changes for UI-only migration.**

---

## Responsive & Accessibility

- Row action menus flip above trigger when near bottom of viewport
- Accounts and inventory tables retain horizontal scroll via `ui-table-wrap`
- Form labels via `FormField` and `FieldLabel`; focus rings on `.ui-input:focus`
- `RowActionMenu`: `aria-expanded`, `aria-haspopup`, `role="menu"` / `menuitem`, Escape to close
- `RouteFallback`: `role="status"` + brand-colored spinner
- `LiveIndicator`: visual-only; does not replace accessible status text on workflow pages

---

## Testing

| Check | Result |
|-------|--------|
| **Frontend build** | Pass (`npm run build`) — includes `erpFormControls` chunk |
| **Backend workflow tests** | Pass (`pytest tests/test_workflow_state_machine.py`) |
| **Vitest** | Pass when run (`npm test -- --run`) |
| **Playwright** | Not configured — recommended for login → workflow → job card smoke |
| **Visual regression** | No baseline in repo |

### Recommended next test steps

1. Playwright smoke: login → dashboard hub → create SO → job card → team board action
2. Visual check: one accounts page + one ERP document form + Sales Job Card at mobile width
3. Accessibility audit on `SalesJobCardPage` stepper and timeline

---

## Remaining Issues (genuine)

| Priority | Issue |
|----------|-------|
| Medium | Residual `#6b4eff` purple in list pages (PaymentReceipts, CreditNotes, PurchaseOrders, etc.) — table link styling |
| Medium | `PaymentReceiptForm`, `MakePaymentForm`, `SignatureAndStampPanel`, `TermsAndConditionsPicker` — local `PURPLE` constant for toggles/links |
| Medium | HR dashboards still use inline indigo/violet KPI cards instead of shared `KpiCard` + tokens |
| Medium | `AnalyticsKpiCard`, `TemplateSettingsV2` template swatches — separate from design system |
| Low | Some pages import from `design-system/classes` directly instead of barrel `design-system` |
| Low | 50+ modals duplicate footer button rows instead of shared `ModalFooter` |
| Low | Full-bleed sales/accounts routes bypass `.ui-page` — padding varies slightly |
| Low | `xlsx` export chunk size / npm audit advisories (dependency, not UI) |

---

## Implementation Strategy Used

1. Define CSS tokens and `.ui-*` utilities in `index.css` (forest green rebrand)
2. Add `design-system/` barrel with class tokens, status tone resolver, ERP form controls
3. Migrate domain shells (accounts, inventory) then high-traffic modals and list pages
4. Extract duplicated ERP form helpers into `erpFormControls.jsx` (10 document forms)
5. Align manufacturing workflow UI to reference layouts and brand tokens
6. Run `npm run build` after each batch; fix regressions file-by-file

---

## Related Documentation

- [README.md](./README.md) — design system overview, manufacturing workflow, setup  
- [SECURITY_REPORT.md](./SECURITY_REPORT.md) — auth/session (separate from visual UX)  
- [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md) — architecture, live-data, workflow engine  

---

## Change Log

| Date | Note |
|------|------|
| 2026-08-16 | Initial audit: shared components (badges, row menu, modal CSS, accountsDesignSystem baseline) |
| 2026-08-18 | Forest green rebrand; `design-system/` module; accounts/inventory/sales/procurement migration; ERP form controls; manufacturing workflow UI alignment; build verified |
