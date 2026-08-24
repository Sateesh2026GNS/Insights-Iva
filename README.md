# Insights Iva

**Insights Iva** is a full-stack manufacturing ERP and business intelligence platform. It unifies production, inventory, procurement, sales, finance/accounting, HR, quality, maintenance, meetings (Google Calendar & Meet), alerts, documents, and analytics in a multi-tenant SaaS application.

**Tagline:** Business Intelligence • Analytics • AI

Security hardening (auth lockout, email verification, refresh tokens, RBAC, tenant isolation, headers) is documented in [SECURITY_REPORT.md](./SECURITY_REPORT.md). **Full security audit + hardening pass (16 Aug 2026)** — summary in [Security Audit & Hardening](#security-audit--hardening-aug-2026) below. **Frontend UI/UX audit + design system migration (18 Aug 2026; button action system 24 Aug 2026)** — [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md). **Wireframe-first UI/UX standard** for new pages — [Wireframe-first UI/UX standard](#wireframe-first-uiux-standard). Architecture and recent analysis: [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md).

**Latest pass (24 Aug 2026):** **Action-based button system** — centralized `Button` variants (`add`, `primary`, `secondary`, `view`, `edit`, `warning`, `danger`), `AddButton` / `TableActionButtons`, and app-wide migration of list/toolbar Add/Create CTAs to teal-blue `#0F5F78` — see [UI design system](#ui-design-system-colors--buttons) and [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

**Prior pass (21 Aug 2026):** End-to-end **RBAC** for seven roles (Admin, Sales Manager, Production Manager, Store Manager, HR Manager, Accountant, Operator) — permissions, sidebar, routes, and JWT role preserved on refresh — see [Role-Based Access Control](#role-based-access-control). **Shared date/calendar controls** (`dateControls.jsx`, `dateUtils.js`) and duplicate calendar icon fix — see [UI design system](#ui-design-system-colors--buttons). **Store Manager** dedicated sidebar with full Purchases menu. **Settings** integrated into main ERP shell (dark navy theme in dark mode only). **Manufacturing workflow engine (18 Aug 2026):** role-based Sales → Job Card → Inventory → Production → Quality → Packing → Billing — see [Manufacturing Workflow Engine](#manufacturing-workflow-engine). **Design system rebrand (18 Aug 2026):** forest green brand, `frontend/src/design-system/` — see [UI design system](#ui-design-system-colors--buttons). **HR module dashboards (Aug 2026):** mockup-aligned UI — see [HR & Employee Management](#hr--employee-management). See [Stability Audit & Validation](#stability-audit--validation-aug-2026) and [Security Audit & Hardening](#security-audit--hardening-aug-2026).

## Branding & Assets

| Item | Location | Usage |
|------|----------|--------|
| **Product name** | — | **Insights Iva** (browser title, sidebar, login, landing, i18n) |
| **Tagline** | `frontend/src/locales/en.json` → `nav.tagline` | Business Intelligence • Analytics • AI |
| **Logo** | `frontend/public/logo.png` | Favicon + UI branding |
| **Auth hero image** | `frontend/public/auth/slide-1.png` | Login/Register slider + landing hero background |
| **Brand component** | `frontend/src/components/common/BrandLogo.jsx` | Reusable logo with `sm` / `md` / `lg` / `xl` / `hero` sizes |

### Where the logo appears

- **Landing page** — navigation bar, hero section, footer
- **Login & Register** — header above the form title
- **Sidebar** — app header (logo only when collapsed)
- **Loading screen** — shown while the app bootstraps (`main.jsx`)
- **Browser tab** — favicon via `<link rel="icon" href="/logo.png">` in `index.html`

### Auth slider images

The sign-in / sign-up right panel (`AuthSlider.jsx`) rotates background slides:

| File | Slide | Fallback |
|------|-------|----------|
| `frontend/public/auth/slide-1.png` | Insights Iva (installed) | — |
| `frontend/public/auth/slide-2.png` | Analytics | Themed gradient if missing |
| `frontend/public/auth/slide-3.png` | Inventory | Themed gradient if missing |

### Replace the logo

1. Save your image as `frontend/public/logo.png` (PNG recommended; keep a wide aspect ratio).
2. Refresh the app — `BrandLogo` loads from `/logo.png` with no code changes.

**Note:** Demo tenant emails (`@smrt.local`) are sample data, not the product brand.

To add or replace slides, drop PNG/JPG files into `frontend/public/auth/` using the names above. See `frontend/public/auth/README.txt` for copy commands.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **Frontend:** React 18, Vite, React Router, Axios, Tailwind CSS, React i18next

### Frontend performance

- **Route-level code splitting** – Each page is loaded on demand (`lazyPages.jsx` + `React.lazy`), so the initial JS bundle stays small (~77 KB gzip for the main entry vs. a single 500+ KB chunk before).
- **Localized Suspense** – While a chunk loads, a **light inline fallback** (`RouteFallback`) appears in the main area only; the sidebar/nav stay mounted so navigation doesn’t feel like a full reload.
- **Vendor chunking** – `vite.config.js` splits **recharts**, **react-vendor**, **i18n**, **axios**, and **export-libs** (xlsx/jspdf) so the browser can cache them and load them in parallel only when needed.
- **Dashboard** – Chart code lives in the `recharts` chunk and is fetched only when the user opens the dashboard.

### UI design system (colors & buttons)

Central tokens live in `frontend/src/index.css` (`:root` + `.ui-*` utilities). Import shared classes and components from **`frontend/src/design-system/index.js`** — prefer CSS variables and design-system exports over page-specific hex.

#### Button action system (Aug 2026)

Use **`Button`** from `components/common/Button.jsx` (or `design-system/index.js`). Do not hand-roll button colors on pages.

| Action | Variant | Color | Typical use |
|--------|---------|-------|-------------|
| **Add New / Create (toolbar)** | `add` | `#0F5F78` teal-blue | + Add New, Add Customer, Create Bill, New Order — compact 40px ERP CTA |
| **Submit / Save** | `primary` | `#036F71` brand green | Form save, confirm workflow, issue material |
| **Cancel / Back / Close** | `secondary` | Light + border | Dismiss modals, navigate back |
| **View / Open / Approve** | `view` | `#2E9B72` | Row View, Open Job Card, Approve, Confirm Received |
| **Edit / Update** | `edit` | `#3182CE` | Row Edit, Save Changes (existing record) |
| **Delete / Remove** | `danger` | `#E24A4A` | Row Delete, destructive confirm |
| **Hold / Pending / Review** | `warning` | Amber | Pending status actions |
| **Low priority** | `outline` / `ghost` | Border / transparent | Export, filter chrome, icon-only |

**Helpers:**

| Component | Purpose |
|-----------|---------|
| `AddButton` | Toolbar “+ Add …” with default Plus icon (`variant="add"`) |
| `TableActionButtons` | Inline row group: View (green) · Edit (blue) · Delete (red) |
| `RowActionMenu` + `rowActionTone.js` | Kebab menus with semantic item colors |
| `AccountsAddButton` / `InventoryAddButton` | Domain wrappers for list-page create CTAs |

**CSS classes:** `.ui-btn--add`, `.ui-btn--primary`, `.ui-btn--view`, `.ui-btn--edit`, `.ui-btn--danger`, etc.

#### Color tokens (non-button)

| Role | Token / class | Typical use |
|------|---------------|-------------|
| Primary (brand) | `--color-primary` (`#036F71`) | Focus rings, nav active, links, form submit |
| Add CTA | `--color-add` (`#0F5F78`) | List/toolbar create buttons only |
| Primary soft | `--color-primary-soft` (`#E6F4F4`) | Section headers, active pills, KPI backgrounds |
| Page canvas | `--color-bg` (`#F2F7F5`) | App background — light green-gray BI canvas |
| View / approve | `--color-action-view` (`#2E9B72`) | Success-style actions (not brand primary) |
| Edit | `--color-action-edit` (`#3182CE`) | Update actions |
| Info / in-progress | `--color-info` | Workflow in-progress (blue — not brand) |
| Warning / CTA yellow | `--color-cta` / `ui-btn-warning` | Warnings & attention — use selectively |
| Danger | `--color-danger` (`#E24A4A`) | Delete / destructive |

**Design-system modules:**

| Module | Path | Exports |
|--------|------|---------|
| Barrel | `design-system/index.js` | Tokens, `Button`, `AddButton`, `TableActionButtons`, `FormField`, layouts |
| Class tokens | `design-system/classes.js` | `inputClass`, `selectClass`, `tableWrapClass`, typography |
| ERP forms | `design-system/erpFormControls.jsx` | `SoftInput`, `SoftSelect`, `FieldLabel`, `Pill` |
| Date/time | `design-system/dateControls.jsx` | `DatePicker`, `DateRangePicker`, `FloatingDate` |
| Date helpers | `utils/dateUtils.js` | `todayIso()`, timezone-safe ISO, range presets |
| Status tones | `design-system/statusTone.js` | `resolveStatusTone()` for badges |
| Accounts shell | `components/accounts/accountsDesignSystem.jsx` | Page shell, tables, `AccountsAddButton` |
| Inventory shell | `components/inventory/inventoryDesignSystem.jsx` | Page shell, tabs, `InventoryAddButton` |

JS mirrors: `frontend/src/theme/colors.js`, `frontend/src/styles/theme.js`. Legacy alias: `ActionButton.jsx` re-exports `Button`.

Full migration status: [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

### Wireframe-first UI/UX standard

Mandatory process for **all new pages and major UI changes**. Cursor rule: [`.cursor/rules/wireframe-first-ui.mdc`](./.cursor/rules/wireframe-first-ui.mdc).

**Principle:** STRUCTURE → VALIDATE UX → DESIGN SYSTEM → VISUAL HIERARCHY → INTERACTION → CONSISTENCY AUDIT

**"Structure before style. Think first, design later."**

Do **not** change backend APIs, database logic, auth, RBAC, or business workflows unless explicitly requested.

#### 1. Structure first

Build wireframe/layout before visual styling. Define:

- Page hierarchy, sections, primary/secondary actions, empty/loading/error states
- Grid, spacing, responsive structure (stack mobile → columns at `sm:`/`lg:`)
- Shell: standard pages = `ui-page ui-stack`; full-bleed editors = `App.jsx` `isInvoiceEditor`
- Title in **Navbar** (`getPageTitle`); `PageHeader` = subtitle + actions (`showTitle={false}` default)

**Do not** add colors, gradients, shadows, or decorative animations in this phase.

#### 2. Validate UX

Before styling, confirm: scannable info, obvious primary action, clear flow, grouped related items, appropriate density, consistency with sibling pages in the same module, all states covered.

#### 3. Apply design system

Reuse from `frontend/src/design-system` and `components/common/`:

| Need | Component / token |
|------|-------------------|
| Buttons | `Button` |
| Forms | `FormField`, `Input`, `Select`, `Textarea`, `DatePicker` |
| Page shell | `StandardPageLayout` |
| Cards | `ui-card`, settings `SectionCard`, `SettingsActionLink` |
| Tables | `Table`, `DataTable`, `FilterBar` |
| States | `Loader`, `SkeletonTable`, `EmptyState`, `ErrorState`, `OfflineState` |
| Brand | `var(--color-primary)` — no one-off hex palettes |

No duplicate components. No `#6b4eff` / random purple unless an established document-editor pattern.

#### 4. Visual hierarchy + responsive

Navbar title > section heading > supporting text. Primary actions dominant; secondary subtle. Status via `StatusBadge` and semantic tokens. Intentional whitespace. Reflow at breakpoints — do not only shrink.

#### 5. Interactions

Only: hover, focus-visible, active, disabled, loading, validation, success/error (toasts). No decorative animation.

#### 6. Consistency audit

Before finishing, compare with a reference page in the same module: header, spacing, typography, buttons, forms, tables, cards, filters, status, responsive behavior, colors.

**Reference pages:**

- List/CRUD: `ResourcePage.jsx`
- Standard list: `PaymentTracking.jsx` — `StandardPageLayout` + `ui-card` + `Table`
- Settings: `settingsUi.jsx` — `PanelShell`, `SectionCard`, `SettingsActionLink`
- Full-bleed forms: invoice/payment receipt editors

**Date inputs:** Prefer `DatePicker` from `design-system/dateControls.jsx` over raw `type="date"`. Custom fields use one calendar button (`.ui-date-input`); native webkit indicator is hidden to prevent duplicate icons. Use `todayIso()` instead of `toISOString().slice(0, 10)` for local calendar dates.

**Global search** (navbar): `GlobalSearch` — nested input wrapper (icon does not jump when results open), clear control, Escape / click-outside.

#### Numeric typography

Figures (KPI values, money, quantity columns) use a dedicated font token so amounts such as `₹ 3,24,50,600` stay legible and column-aligned.

| Token / class | Applies to |
|---------------|------------|
| `--font-numeric` (IBM Plex Sans) | Digit-heavy text; falls back to Inter |
| `.ui-kpi__value` | KPI card values — weight 600, tabular lining figures |
| `.ui-num`, `.tabular-nums` | Table cells for money, quantity, codes |

#### Shared table robustness

`DataTable` and `Table` (`frontend/src/components/common/`) normalize their `data` prop with `asArray` (`frontend/src/utils/apiError.js`). A non-array API payload renders the empty state instead of throwing, so a single malformed response cannot blank out a list page. Page loaders should also pass list responses through `asArray` before `setState`.

`StatusBadge` maps unknown tones to a safe default; valid tones are `success`, `info`, `progress`, `pending`, `primary`, `warning`, `danger`, `error`, `neutral`.

## Role-Based Access Control

Seven registerable roles share one permission matrix. Backend: `backend/app/core/rbac_constants.py`. Frontend mirror: `frontend/src/config/permissions.js`.

| Role | Dashboard redirect | Sidebar |
|------|-------------------|---------|
| Admin | `/` (workflow hub) | Full catalog |
| Sales Manager | `/sales/dashboard` | Sales, Masters, Analytics, Meetings |
| Production Manager | `/production/planning` | Narrow allowlist (production, quality, inventory subset) |
| Store Manager | `/inventory/dashboard` | Custom nav (`storeManagerNavConfig.js`) — Purchases, Inventory, Ledger, Expense |
| HR Manager | `/hr` | HR sections only |
| Accountant | `/accounts/dashboard` | Accounts, billing docs, analytics |
| Operator | `/production/job-card` | Execution paths (job card, factory monitor, alerts) |

**Flow:** Login selects role → JWT carries `role` / `role_id` → `GET /auth/me` returns permissions for **that role only** → `usePermissions()` filters sidebar → `ProtectedRoute` checks `userCanAccessPath()`.

**Store Manager Purchases menu:** Stock In, Purchase Requisitions, Purchase, Payments Made, Debit Note, Purchase Order, GRN, Supplier Payments. Subscription, My Account, and Log Out are not in the store sidebar (logout remains in the global header).

**Manufacturing workflow teams** map from ERP roles in `workflow_constants.py` — see [Manufacturing Workflow Engine](#manufacturing-workflow-engine).

Security details: [SECURITY_REPORT.md](./SECURITY_REPORT.md). Architecture: [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md).

## Features

### Production Management
- Production planning (orders, scheduling)
- MRP (material requirement planning) with links to production planning
- Work orders
- **Shop-floor Job Card** (`/production/job-card`) — document view over live work orders (list + detail); create via quick work order
- Batch tracking
- Machine status monitoring
- Daily production reports

### Manufacturing Workflow & Sales Job Card

End-to-end order workflow from confirmed sales order through billing. Live PostgreSQL data only — no mock job cards or fake timeline entries.

| Page | Route | Contents |
|------|-------|----------|
| Admin workflow hub | Dashboard (`/`) | Stage pipeline, **Live** indicator with silent 30s auto-refresh |
| Team workflow board | `/manufacturing/workflow` | Role-filtered queue; team actions (material check, production, quality, packing, billing) |
| Sales Order Job Card | `/sales/orders/:id/job-card`, `/manufacturing/job-card/:orderId` | Summary panel, editable details form, 7-step workflow stepper, timeline |

**Seven job-card workflow stages (UI stepper):** Sales Orders → Inventory Check → Production → Quality Check → Packing & Dispatch → Billing → Completed.

**User flow:** Create sales order → add product lines → **Confirm → MRP & Production** → **Open Job Card** on the order detail page → fill customer/product/qty/delivery/priority → **Create Job Card** → Inventory team runs material check → Production assigns operator → Quality approves → Packing completes → Billing creates invoice.

**Sales Job Card layout:** Header (Save / Cancel / status badge) · left column — **Job Card Summary** + **Job Card Details** form · right column — **Workflow Status** stepper + **Timeline** (actor + timestamp).

**RBAC teams** (mapped from ERP roles in `workflow_constants.py`): sales, inventory, production, operator, quality, packing, billing, admin. Transitions enforce the required team; Admin may act on all stages.

**Persistence:**
- `sales_job_cards` — job card document (draft / created)
- `sales_order_material_checks` + lines — inventory verification
- `manufacturing_workflow_transitions` — audit trail
- `sales_orders.workflow_status` — canonical machine state (`SALES_CONFIRMED`, `MATERIAL_CHECK_PENDING`, … `COMPLETED`)

**Migrations:** `d1e2f3a4b5c6_manufacturing_workflow_engine.py`, `e2f3a4b5c6d7_sales_job_cards_table.py` — run `alembic upgrade head` from `backend/`.

See [Manufacturing Workflow Engine](#manufacturing-workflow-engine) for API endpoints, code map, and tests.

### Inventory & Raw Material Management

Eight inventory screens share one layout language: page header with date + warehouse scope, KPI row, filter bar, then the main table or form.

| Page | Route | Contents |
|------|-------|----------|
| Store Dashboard | `/inventory/dashboard` | 7 KPIs, stock-status donut, recent movements, low stock, recent transfers, quick actions |
| Raw Materials | `/inventory/raw-materials` | 5 KPIs, search/filters, item table with stock status, View / Edit |
| Finished Goods | `/inventory/finished-goods` | Same pattern as Raw Materials, FG SKUs |
| Stock Transfer | `/inventory/stock-transfer` | 3-step form (Details → Items → Review) with summary panel, recent transfers |
| Stock Adjustment | `/inventory/stock-adjustment` | 2-step form, increase/decrease with live `Current ± Adj = New` preview |
| Stock Ledger | `/inventory/stock-ledger` | Date/item/warehouse/type filters, 5 KPIs, movement table, Excel export |
| Warehouses | `/inventory/warehouses` | 5 KPIs, primary tag, location, utilization bar, create/edit/deactivate |
| Inventory Settings | `/inventory/settings` | Tabbed sections: General, Stock Rules, Reorder, Warehouse, Adjustment, Transfer |

- **Create Item** (`/inventory/items/create?type=raw_material|finished_good`) — tabbed form (Basic Information, Units & Pricing, Tax & Accounting, Inventory Details, Additional Information) with image upload preview and a sticky footer (Item is Active, Cancel, Save & Create Item). Posts to `POST /inventory/items`; presentation-only fields (HSN/SAC, brand, GST, MRP, min/max stock) are stored as description metadata since the item model does not have columns for them.
- Sidebar label for `/inventory/dashboard` is **Store Dashboard**; the breadcrumb uses the same label.
- Low stock alerts; barcode scan/manual lookup; stock movements.
- Sidebar **Inventory** (`/inventory`) opens the products/items list UI (same component as Masters → Products, titled Inventory).

**Preview data:** when a tenant has no records yet, these pages render mockup rows so the layout is reviewable. As soon as the API returns rows, live data replaces the preview — no toggle or seed step is needed.

Inventory settings persist under the `inventory_settings` feature-settings key (`GET`/`PUT /biz/feature-settings/inventory_settings`); legacy keys are preserved when saving.

### Masters (Customers / Vendors / Products)
- **Customers** (`/sales/customers`) — list, create/edit modal, export; bulk import at `/sales/customers/bulk-import`
  - API validation on create/update: company name required (must include a letter), contact person optional with letter check, email format, 10-digit phone, uppercase GSTIN (15 chars)
- **Vendors** (`/procurement/vendors`) — list, create/edit modal, export; full form at `/procurement/vendors/create`; bulk import at `/procurement/vendors/bulk-import`
- **Products** (`/masters/products`) — list, create/edit modal; create form at `/masters/products/create`; bulk import at `/masters/products/bulk-import`
- Deep-link create for customers: `/sales/customers/create` → opens the create modal on the list page

### Purchases & Procurement
- **Purchases** sidebar: Purchase (`/purchases`), Payments Made, Debit Note, Purchase Order, GRN, Supplier Payments
- **Store Manager** sees the full Purchases group via dedicated sidebar config
- Purchase orders, material requests, goods receipt (GRN), supplier payments
- **Enterprise Vendor Master** (`/procurement/vendors`) on the existing `suppliers` table
  - Company, contact, GST, address (PIN auto-fill), bank & procurement terms
  - Auto vendor codes (`VEN-0001` style), soft delete
  - Detail route `/procurement/vendors/:id` (overview, purchase history, products, payments, documents, performance, audit)
  - **Bank verification:** Account Number + IFSC via lookup API; bank name/branch auto-fill
- Roles with vendor access/write: Admin, Purchase Manager, Procurement Manager, Store Manager (Production Manager may see write UI where permitted)

### HR & Employee Management

The HR sidebar is split into expandable sections (Attendance, Leave Management, Payroll, Performance, Recruitment, Training, Reports, HR Settings). Dashboard-style pages follow a shared layout: KPI cards, filters, Recharts widgets, data tables with `InventoryRowActionsMenu` (⋮), and a right-hand summary column where the mockup specifies it.

| Page | Route | Highlights |
|------|-------|------------|
| HR Dashboard | `/hr` | KPIs, attendance bar chart, department donut, birthdays, recent joins, leave requests, quick links |
| Attendance | `/hr/attendance` (+ daily, calendar, leave-summary, reports sub-routes) | KPIs, filters, donut summary, calendar, today’s overview, records table with S.No. |
| Leave Management | `/hr/leave` | KPIs, tabs, filters, requests table, status donut, leave balance bars, upcoming holidays |
| Payroll | `/hr/payroll` | KPIs, payroll runs table, recent payslips, summary donut, quick links, create payroll modal |
| Performance | `/hr/performance` | Trend chart, rating distribution, top performers, recent reviews, insights, upcoming reviews |
| Recruitment | `/hr/recruitment` | KPIs, funnel, job openings, recent applicants, source analytics donut |
| Training | `/hr/training` | KPIs, overview donut, completion trend, categories, ongoing/upcoming programs, certifications |
| HR Settings | `/hr/settings` | General settings form, system/security/privacy toggles, category sidebar |
| Employees, Shifts, Documents | `/hr/employees`, `/hr/shifts`, `/hr/documents` | Existing CRUD/list flows |

**Preview / merge pattern:** HR dashboard pages call live APIs (`hrApi.js`) when data exists. Empty or partial responses fall back to curated demo payloads in `frontend/src/data/hrMasterData.js` via `merge*Dashboard()` helpers (same approach as Quality Dashboard) — so layouts stay reviewable without seeding the database.

**Accounts fix (related):** Chart of Accounts (`/accounts/chart-of-accounts`) dedupes duplicate GL rows at the API and UI layer; list fetches retry transient connection resets during backend hot-reload (`chartOfAccountsSync.js`).

Core HR APIs remain under `/hr/` — employees, shifts, attendance (clock-in/out), leave, payroll, performance. Create flows: `/hr/employees/create`, `/hr/leave/create`, `/hr/payroll/create`, `/hr/performance/create`, etc.

### Sales & Billing Module
- Tax invoices, quotations, payment receipts, refund vouchers, proforma / export invoices, delivery challans, credit & debit notes
- **Sales orders** — create at `/sales/orders/create`; confirm runs MRP and advances workflow; confirmed orders expose **Open Job Card**
- e-Invoice and E-Waybill login helpers; digital signature page
- GST billing (SGST, CGST, IGST); payment tracking
- Customer management (Masters → Customers)

### Accounts & Reports
- Ledger, expense, expense settings, chart of accounts, manual journal entries
- Journal entries accept `ref`/`desc` or `reference`/`description` in the POST body; create returns **201 Created**
- Balance sheet, profit & loss, accounting reports, restore deleted documents
- Export to Excel / PDF where supported
- Legacy finance views (AP/AR/payment tracking/general ledger) remain routed under `/finance/*` where applicable

### Quality Control
- Quality inspection
- Defect tracking
- Batch quality reports
- Compliance logs

### Maintenance
- Machine maintenance
- Preventive maintenance
- Breakdown reports
- Maintenance schedule

### Analytics
- Production analytics
- Machine efficiency
- Inventory analytics
- Profit analysis

### Alerts & Notifications
- Low stock alerts
- Machine failure alerts
- Production delay alerts
- Maintenance reminders

### Notification Management (In-App Bell)
- Notification bell in the top navigation bar with live unread badge
- Per-user notifications stored in SQLite (`erp_notifications`)
- Types: Information, Success, Warning, Error, Production, Inventory, Quality, Maintenance, Sales, HR, Finance, System
- Priorities: Low, Medium, High, Critical
- Actions: open (auto mark-read), mark as read, mark all as read, delete, clear all (with confirmation)
- Optimistic UI updates — badge decrements instantly (e.g. 5 → 4 → 0) without page refresh
- Paginated notification list with infinite scroll in the dropdown
- Demo notifications seeded for each user on first backend start

### Meetings & Google Calendar

Google Calendar–style **Meetings** module with OAuth, event sync, and Google Meet link generation. Live data only — no fake calendar events or Meet URLs.

| Page | Route | Contents |
|------|-------|----------|
| Meetings Calendar | `/meetings` | Week view (Google Calendar UI), mini calendar, Create dropdown (Event / Task / Appointment schedule), calendar filters, list toggle |
| Meeting Details | `/meetings/:id` | Full details, Google Meet section, Join Meeting, Open in Google Calendar, Create Google Meet |

**User flow:** Connect Google Calendar (sidebar) → OAuth consent → Create event with optional **Create Google Meet** → Calendar event + Meet link stored in SQLite → participant invites via Google Calendar → edit/delete syncs back to Google.

**Security:** `GOOGLE_CLIENT_SECRET` and refresh tokens stay on the backend only. The React app never receives OAuth secrets or refresh tokens.

See [Meetings & Google Calendar Integration](#meetings--google-calendar-integration) for setup and API details.

### Multi-Language Support
- **Languages:** English, Hindi (हिन्दी), Tamil (தமிழ்), Telugu (తెలుగు)
- Language selector in top navigation bar
- Full UI translation (sidebar, pages, buttons, labels, messages)
- Selection persisted in localStorage across page refresh

## User Flows (High-Level)

All flows follow the pattern: **Select → Enter → Save → View**. Tasks complete in **3 steps max**.

### 1. Overall Insights Iva Flow
Login → Dashboard → Choose Module → Perform Action → Save Data → View Reports

### 2. Production Management
Dashboard → Production Module → **Create Work Order** (3 fields: Product, Quantity, Machine) → Assign Machine → Start Production → Track Status → Complete Production → Move to Inventory

- **Quick Create Work Order:** Dashboard → Click "Create Work Order" → Fill 3 fields → Save → Done ✅

### 3. Inventory
Store Dashboard → Raw Materials / Finished Goods → **Add Raw Material / Add Finished Good** (Create Item form) → Stock Transfer or Adjustment → Stock Ledger for the audit trail → Low Stock Alert → Reorder. Products list also available under Masters → Products and sidebar Inventory (`/inventory`).

### 3b. Vendor Master (Procurement)
Vendors → Create Vendor (modal or `/procurement/vendors/create`) → Fill company & contact → Optional bank verify → Save → Detail / PO. Bulk import: `/procurement/vendors/bulk-import`.

### 4. Sales
Customers (create modal or `/sales/customers/create`) → Create sales order → add product lines → Confirm (MRP + production) → **Open Job Card** → Invoice / Quotation / Receipt flows → Receive payment. Bulk buyers: `/sales/customers/bulk-import`.

### 4b. Manufacturing Workflow (order spine)
Sales order confirmed → **Sales Job Card** (`/sales/orders/:id/job-card`) → Inventory material check → Production assign/start/complete → Quality approve → Packing dispatch → Billing invoice → **Completed**. Team queues at `/manufacturing/workflow`; admin hub on main dashboard with stage pipeline.

### 5. HR (Employee)
HR Dashboard → Attendance / Leave / Payroll / Performance modules → Create employee or leave/payroll/review as needed → Track attendance → Process payroll → View reports under HR Reports. Settings at `/hr/settings`.

### 6. Machine Monitoring
Add Machine → Track Status → Detect Issue → Create Maintenance Task → Fix Machine → Update Status

### 7. Reports & Analytics
Dashboard → Select Report → Apply Filters → View Data → Export (PDF/Excel)

### 8. User / Admin
Login → Admin Panel → Create User → Assign Role → Set Permissions

### 9. Meetings & Google Calendar
Meetings (`/meetings`) → **Connect Google Calendar** (OAuth) → **Create → Event** → Set date, time, participants, enable **Create Google Meet** → Save → Event appears on week grid + Google Calendar → **Join Meeting** or **Open in Google Calendar** from details. Edit or delete updates/cancels the linked Google event when connected.

## Meetings & Google Calendar Integration

Enterprise meetings with **Google OAuth**, **Calendar API** event sync, and **Google Meet** conference links. Tokens are stored server-side per user (`google_calendar_credentials`); meetings store linked event IDs and Meet URLs (`meetings` table).

### Architecture

```
React (MeetingsCalendarView) → meetingsApi.js → FastAPI (/meetings, /integrations/google/calendar)
  → meeting_service.py / google_calendar_service.py → Google Calendar API → SQLite
```

| Layer | Location |
|-------|----------|
| Models | `backend/app/models/meeting.py` — `Meeting`, `MeetingParticipant`, `GoogleCalendarCredential` |
| Schemas | `backend/app/schemas/meeting.py` |
| Services | `backend/app/services/meeting_service.py`, `google_calendar_service.py` |
| API | `backend/app/api/meetings.py` |
| Migration | `backend/alembic/versions/a1b2c3d4e5f6_add_meetings_google_calendar.py` |
| Frontend pages | `frontend/src/pages/meetings/MeetingsList.jsx`, `MeetingDetail.jsx` |
| Frontend components | `MeetingsCalendarView`, `CreateDropdown`, `MeetingFormModal`, `GoogleCalendarSetupPanel` |
| Frontend API | `frontend/src/api/meetingsApi.js` |
| RBAC module | `meetings` — Admin, Sales Manager, Production Manager, HR Manager, Accountant |

### Database

**`meetings`**

| Column | Notes |
|--------|-------|
| `title`, `meeting_type`, `meeting_date`, `start_time`, `end_time`, `timezone` | Core scheduling |
| `organizer`, `location`, `agenda`, `description`, `reminder_minutes` | Metadata |
| `create_google_meet_requested` | Whether Meet was requested at creation |
| `status` | e.g. `scheduled`, `cancelled` |
| `google_calendar_event_id` | Google event ID (internal sync) |
| `google_calendar_event_url` | `htmlLink` for Open in Calendar |
| `google_meet_url` | Join URL (never hardcoded) |
| `google_conference_id` | Internal only; not shown in UI |
| `google_meet_status` | `available`, `pending`, `failed` |

**`meeting_participants`** — `meeting_id`, `email` (unique per meeting)

**`google_calendar_credentials`** — per `tenant_id` + `user_id`: encrypted-at-rest pattern via server-only storage of `access_token`, `refresh_token`, `token_expiry`, `google_account_email`

### Google Cloud setup (required once)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable **[Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Add **Authorized redirect URI** (must match exactly):

   ```text
   http://localhost:8000/integrations/google/calendar/callback
   ```

   For production, use your backend URL, e.g. `https://api.yourdomain.com/integrations/google/calendar/callback`.

5. Copy **Client ID** and **Client secret** into `backend/.env` (see below).
6. If using **Google Workspace**, ensure OAuth consent screen is configured and test users are added while the app is in testing mode.

### Backend environment variables

Add to `backend/.env` (see also `backend/.env.example`):

```env
# Google Calendar + Google Meet
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/integrations/google/calendar/callback
GOOGLE_CALENDAR_DEFAULT_TIMEZONE=Asia/Kolkata
FRONTEND_BASE_URL=http://localhost:5173
```

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (**never** expose to frontend) |
| `GOOGLE_OAUTH_REDIRECT_URI` | Must match Google Console redirect URI |
| `GOOGLE_CALENDAR_DEFAULT_TIMEZONE` | Default IANA timezone for new events |
| `FRONTEND_BASE_URL` | OAuth callback redirects here after connect |

**Python packages** (included in `requirements.txt`):

```text
google-auth
google-auth-oauthlib
google-api-python-client
```

Install: `pip install -r requirements.txt`

Apply migration (optional if `create_all` already ran):

```bash
cd backend
alembic upgrade head
```

Restart the backend after changing `.env`.

### API endpoints

All meeting routes require JWT and the `meetings` module permission.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/meetings` | List meetings + Google connection status |
| `POST` | `/meetings` | Create meeting; syncs to Google Calendar when connected |
| `GET` | `/meetings/{id}` | Meeting details |
| `PUT` | `/meetings/{id}` | Update meeting + linked Google event |
| `DELETE` | `/meetings/{id}` | Delete meeting + cancel Google event |
| `POST` | `/meetings/{id}/google-meet` | Add Meet link to existing calendar event |

**Google integration**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/integrations/google/calendar/status` | Connected?, account email, configured?, redirect URI |
| `GET` | `/integrations/google/calendar/connect` | Returns `{ authorization_url }` for OAuth |
| `GET` | `/integrations/google/calendar/callback` | Google OAuth redirect (no JWT; uses signed `state`) |
| `DELETE` | `/integrations/google/calendar/disconnect` | Revoke local tokens for current user |

### OAuth flow

1. User clicks **Connect** on `/meetings` → `GET /integrations/google/calendar/connect` → browser redirects to Google.
2. User consents → Google redirects to backend callback with `code` + `state`.
3. Backend exchanges code for tokens, stores refresh token server-side, redirects to `{FRONTEND_BASE_URL}/meetings?google_connected=1`.
4. On failure: `?google_error=...` with a user-friendly message.

Development uses `OAUTHLIB_INSECURE_TRANSPORT=1` automatically when `ENVIRONMENT=development` (localhost HTTP).

### Create meeting with Google Meet

When Google Calendar is connected and **Create Google Meet** is checked:

1. Meeting row is saved locally.
2. Google Calendar event is created on the user's **primary** calendar (`conferenceDataVersion=1`, unique `requestId` per event).
3. Meet join URL and event `htmlLink` are stored on the meeting record.
4. Attendee emails receive calendar invitations (`sendUpdates=all`).
5. Duplicate participant emails are deduplicated before the API call.

If Google is not connected, the meeting is still saved locally with a warning toast — no fake Meet links.

### Frontend UI

- **Week view** — Google Calendar–style grid with color-coded events by meeting type, current-time indicator, S.No. in list mode.
- **Create dropdown** — Event, Task, Appointment schedule (same as Google Calendar Create menu).
- **Setup panel** — Shown when OAuth is not configured; lists exact redirect URI and `.env` keys.
- **Settings → Integrations** — Google Calendar & Meet status with link to `/meetings`.

### Try it

1. Complete [Google Cloud setup](#google-cloud-setup-required-once) and set `backend/.env`.
2. Restart backend: `uvicorn app.main:app --reload --port 8000`
3. Log in as a user with `meetings` permission (Admin, HR Manager, etc.).
4. Open **Meetings** in the sidebar → **Connect** → sign in with Google.
5. **Create → Event** → fill title, date/time, participants → enable **Create Google Meet** → **Create Event**.
6. Confirm the event on the week grid, in Google Calendar, and **Join Meeting** on the detail page.

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Connect button disabled | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`; restart backend |
| `redirect_uri_mismatch` | Redirect URI in Google Console must exactly match `GOOGLE_OAUTH_REDIRECT_URI` |
| No refresh token | Revoke app at [Google Account permissions](https://myaccount.google.com/permissions) and connect again (`prompt=consent`) |
| Meet link pending/failed | Ensure Calendar API is enabled; retry **Create Google Meet** on meeting details |
| 503 on `/connect` | Install Google Python packages: `pip install -r requirements.txt` |

Tests: `python -m pytest tests/test_meetings_api.py -q`

## Project Structure

```
Insights Iva/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration, DB init
│   │   ├── core/                # Config, database, seed_tenant, seed_roles, seed_users, seed_products
│   │   ├── models/              # SQLAlchemy: user, tenant, role, production, inventory, erp_notification, …
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── repositories/        # Data access layer (e.g. notification_repository)
│   │   ├── services/            # Business logic layer (incl. meeting_service, google_calendar_service)
│   │   ├── routers/             # /api/notifications, /api/dashboard, /api/production, …
│   │   └── api/                 # Legacy module routers: auth, sales, inventory, meetings, alerts, …
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── public/
│   │   ├── logo.png             # Insights Iva product logo (favicon + UI)
│   │   └── auth/
│   │       ├── slide-1.png      # Auth slider / landing hero background
│   │       ├── slide-2.png      # Optional (gradient fallback if missing)
│   │       └── slide-3.png      # Optional (gradient fallback if missing)
│   ├── src/
│   │   ├── api/                 # axiosConfig, notificationService, productionApi, salesApi, workflowApi, …
│   │   ├── components/          # layout (Navbar, Sidebar), notifications, common, accounts/, inventory/, manufacturing/
│   │   ├── design-system/       # index.js, classes.js, erpFormControls.jsx, statusTone.js
│   │   ├── context/             # AuthContext, ToastContext, SettingsContext
│   │   ├── hooks/               # useAuth, useNotifications
│   │   ├── pages/               # auth, dashboard, production, inventory, procurement, sales, accounts, hr, manufacturing, meetings, …
│   │   └── routes/              # AppRoutes, lazyPages (code-split)
│   ├── package.json
│   └── .env
│
├── README.md
├── SECURITY_REPORT.md
├── PROJECT_ANALYSIS_REPORT.md
└── UI_UX_AUDIT_REPORT.md
```
### Backend Code Map

| Module | API (`app/api/`) | Service (`app/services/`) | Models |
|--------|------------------|---------------------------|--------|
| Auth | auth.py | auth_service.py, security_service.py | user, tenant, role; security tokens |
| Production | production.py / production_api | production_service.py, job_card_service.py, workflow_state_service.py, workflow_team_service.py | production, product, machine, work orders; manufacturing_workflow (SalesJobCard, material checks, transitions) |
| Inventory | inventory.py | inventory_service.py | inventory (Warehouse, Supplier/Vendor, Item, StockLevel, StockMovement) |
| Procurement | procurement.py | procurement_service.py, vendor_service.py, bank_lookup_service.py | procurement (PurchaseOrder, MaterialRequest, GoodsReceipt, SupplierPayment); VendorProduct; Supplier enterprise fields |
| Sales | sales.py | sales_service.py | sales (Customer, SalesOrder, Invoice, Payment) |
| Manufacturing Workflow | manufacturing_workflow_api.py | workflow_state_service.py, workflow_team_service.py, job_card_service.py | manufacturing_workflow (SalesJobCard, SalesOrderMaterialCheck, ManufacturingWorkflowTransition) |
| Accounts | accounts.py | accounts_service.py | accounts (Income, Expense) |
| HR | hr.py | hr_service.py | hr (Employee, Shift, Attendance, Payroll, Performance) |
| Analytics | analytics.py | analytics_service.py | aggregates from other modules |
| Quality | quality.py | quality_service.py | quality (Inspection, Defect, BatchReport, Compliance) |
| Maintenance | maintenance.py | maintenance_service.py | maintenance (Record, Preventive, Breakdown, Schedule) |
| Alerts | alerts.py | alert_service.py | alert |
| Notifications | routers/notifications_api.py | notification_management_service.py | erp_notification |
| Admin | admin.py | admin_service.py | admin (AccessLog) |
| Documents | documents.py | document_service.py | document |
| Meetings | meetings.py | meeting_service.py, google_calendar_service.py | meeting (Meeting, MeetingParticipant, GoogleCalendarCredential) |

### Frontend Code Map

| Area | Pages | API Client |
|------|-------|------------|
| Auth | Login, Register | authApi, `BrandLogo`, `AuthSlider` |
| Design system | Shared across all modules | `design-system/index.js`, `classes.js`, `erpFormControls.jsx`; `accountsDesignSystem`, `inventoryDesignSystem` |
| Dashboard | Dashboard (KPIs, charts), ManufacturingWorkflowHub | productionApi, inventoryApi, hrApi, analyticsApi, accountsApi, workflowApi |
| Production | Planning, MRP, WorkOrders, JobCard, BatchTracking, MachineStatus, DailyReports, CreateProduction, CreateMachine | productionApi |
| Manufacturing Workflow | RoleWorkflowBoard, TeamWorkflowJobCards, SalesJobCardPage, WorkflowOrderActions, ManufacturingWorkflowHub | workflowApi |
| Inventory | InventoryDashboard, RawMaterials, FinishedGoods, StockTransfer, StockAdjustment, StockLedger, Warehouses, InventorySettingsV2, CreateItem | inventoryApi, bizDocumentsApi (settings) |
| Masters | Customers, BulkImportBuyer; VendorManagement, BulkImportSeller, CreateVendor, VendorDetail; ProductsMaster, BulkImportProduct, CreateProduct; BomMaster, DepartmentManagement | salesApi, procurementApi, productsApi |
| Procurement / Purchases | PurchaseOrders, MaterialRequests, GoodsReceipt, SupplierPayments; Purchases, PaymentsMade, DebitNotes (+ create pages) | procurementApi, bizDocumentsApi |
| Sales | Invoices, Quotations, PaymentReceipts, Customers, SalesOrderDetail, CreateSalesOrder, document forms | salesApi, workflowApi |
| Accounts | Ledger, Expense, ChartOfAccounts, ManualJournal, BalanceSheet, ProfitLoss, Reports | accountsApi |
| HR | HRDashboard, Attendance, Leave, Payroll, Performance, Recruitment, Training, HRSettings, Shifts, Employees + create pages | hrApi |
| Quality, Maintenance, Analytics, Alerts | Inspection, Defects, BatchReports, Compliance; MachineMaintenance, Preventive, Breakdowns, Schedule; Production/Machine/Inventory/Profit analytics; AllAlerts, LowStock, etc. | quality/maintenance/analytics/alert APIs |
| Admin, Documents, Settings | UserManagement, RolesPermissions, AccessLogs; Purchase/Production/Quality/Reports docs; Settings sub-pages | adminApi, document APIs |
| Meetings | MeetingsList (calendar week view), MeetingDetail; CreateDropdown, GoogleCalendarSetupPanel | meetingsApi |
| Notifications (navbar bell) | NotificationBell, NotificationDropdown, NotificationItem | notificationService |

## Manufacturing Workflow Engine

Role-based manufacturing order pipeline: confirmed sales order → job card → inventory check → production → quality → packing → billing → completed. State is stored on `sales_orders.workflow_status` with a full transition audit trail.

### Architecture

```
React (SalesJobCardPage, RoleWorkflowBoard, ManufacturingWorkflowHub)
  → workflowApi.js
  → FastAPI /manufacturing/workflow/*
  → workflow_state_service / workflow_team_service / job_card_service
  → PostgreSQL (sales_job_cards, sales_order_material_checks, manufacturing_workflow_transitions)
```

| Layer | Location |
|-------|----------|
| Constants & state machine | `backend/app/core/workflow_constants.py` |
| Models | `backend/app/models/manufacturing_workflow.py` |
| Job card builder | `backend/app/services/job_card_service.py` |
| State / counts / backfill | `backend/app/services/workflow_state_service.py` |
| Team actions & transitions | `backend/app/services/workflow_team_service.py` |
| API | `backend/app/api/manufacturing_workflow_api.py` |
| Migrations | `backend/alembic/versions/d1e2f3a4b5c6_manufacturing_workflow_engine.py`, `e2f3a4b5c6d7_sales_job_cards_table.py` |
| Backfill script | `backend/scripts/backfill_workflow_status.py` |
| Frontend API | `frontend/src/api/workflowApi.js` |
| Config (teams, spine steps) | `frontend/src/config/manufacturingWorkflow.js` |
| Job card page | `frontend/src/pages/manufacturing/SalesJobCardPage.jsx` |
| Components | `frontend/src/components/manufacturing/JobCardSummary.jsx`, `JobCardWorkflowStatus.jsx`, `JobCardTimeline.jsx` |
| Admin hub | `frontend/src/components/dashboard/ManufacturingWorkflowHub.jsx`, `LiveIndicator.jsx` |
| Team board | `frontend/src/pages/manufacturing/RoleWorkflowBoard.jsx`, `TeamWorkflowJobCards.jsx` |

### Database tables

| Table | Purpose |
|-------|---------|
| `sales_job_cards` | Sales-order job card document (customer, product, qty, delivery, priority, notes); unique per tenant + sales order |
| `sales_order_material_checks` | Inventory verification header linked to sales order |
| `sales_order_material_check_lines` | Per-material required vs available qty |
| `manufacturing_workflow_transitions` | Audit log: action, previous/new status, user, team, linked work order / inspection / invoice |

`sales_orders.workflow_status` holds the canonical workflow state (e.g. `SALES_CONFIRMED`, `MATERIAL_CHECK_PENDING`, `PRODUCTION_IN_PROGRESS`, `COMPLETED`).

### Workflow teams & RBAC

ERP roles map to workflow teams in `ROLE_TO_TEAMS` (`workflow_constants.py`):

| Team | Typical roles | Example actions |
|------|---------------|-----------------|
| sales | Sales Manager, Admin | Confirm order, create job card |
| inventory | Store Manager, Purchase/Procurement Manager | Submit material check |
| production | Production Manager | Assign operator to work order |
| operator | Operator | Start / update / complete production |
| quality | Production Manager | Approve or reject quality check |
| packing | Store Manager | Complete packing & dispatch |
| billing | Accountant | Create invoice from packed order |
| admin | Admin | All stages; workflow backfill |

Invalid transitions are rejected by the state machine (`transition_allowed`); tests in `backend/tests/test_workflow_state_machine.py`.

### API endpoints

All endpoints require JWT. Prefix: **`/manufacturing/workflow`**.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hub` | Dashboard hub: stage counts + recent activity |
| GET | `/queue` | Team-filtered order queue (`team`, `status` query params) |
| GET | `/job-cards` | List sales job cards |
| POST | `/sales-orders/{id}/confirm` | Confirm sales order + MRP (sales team) |
| GET | `/sales-orders/{id}/job-card` | Job card payload (summary, form, workflow steps, timeline) |
| POST | `/sales-orders/{id}/job-card` | Create / finalize job card |
| PATCH | `/sales-orders/{id}/job-card` | Save job card draft |
| GET | `/sales-orders/{id}/context` | Full workflow context for team actions |
| GET | `/sales-orders/{id}/material-check` | Material check document |
| POST | `/sales-orders/{id}/material-check` | Submit inventory verification |
| POST | `/production/job-cards/{work_order_id}/assign-operator` | Assign operator + machine |
| POST | `/production/job-cards/{work_order_id}/start` | Start production |
| PATCH | `/production/job-cards/{work_order_id}/progress` | Update produced/rejected qty |
| POST | `/production/job-cards/{work_order_id}/complete` | Complete production |
| POST | `/quality/checks/{inspection_id}/approve` | Quality approve/reject |
| POST | `/packing/{order_id}/complete` | Complete packing & dispatch |
| POST | `/billing/invoices` | Create billing invoice |
| POST | `/backfill?dry_run=` | Backfill legacy orders missing `workflow_status` (admin) |

### Frontend routes

| Route | Component |
|-------|-----------|
| `/sales/orders/:id/job-card` | `SalesJobCardPage` |
| `/manufacturing/job-card/:orderId` | `SalesJobCardPage` (alias) |
| `/manufacturing/workflow` | `RoleWorkflowBoard` — team queues and actions |
| `/` (admin dashboard) | `ManufacturingWorkflowHub` in reference dashboard |

Entry point from **Sales Order Detail** → **Open Job Card** (confirmed orders only).

### Admin dashboard hub UX

`ManufacturingWorkflowHub` on the main dashboard shows:
- **Live** pulsing indicator (auto-refresh every 30s; no manual Refresh button on the hub)
- Stage pipeline with **Live** indicator (auto-refresh every 30s)
- Admin-only **Preview backfill** / **Backfill legacy** for orders predating the workflow engine

### Setup

```bash
# From backend/ — apply workflow migrations
alembic upgrade head

# Optional — preview then apply legacy status backfill
python scripts/backfill_workflow_status.py --dry-run
python scripts/backfill_workflow_status.py
```

### Tests

```bash
cd backend
python -m pytest tests/test_workflow_state_machine.py -q
```

## Notification Management System

Enterprise in-app notifications for authenticated users. Each user sees only their own notifications (scoped by `tenant_id` + `user_id`).

### Architecture

```
React (NotificationBell) → notificationService.js → FastAPI Router → Service → Repository → SQLite
```

| Layer | Location |
|-------|----------|
| Model | `backend/app/models/erp_notification.py` |
| Repository | `backend/app/repositories/notification_repository.py` |
| Service | `backend/app/services/notification_management_service.py` |
| API | `backend/app/routers/notifications_api.py` |
| Seed | `backend/app/core/seed_notifications.py` |
| Frontend API | `frontend/src/api/notificationService.js` |
| Hook | `frontend/src/hooks/useNotifications.js` |
| Components | `frontend/src/components/notifications/` |

### Database (`erp_notifications`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer | Primary key |
| `tenant_id` | integer | FK → tenants |
| `user_id` | integer | FK → users (recipient) |
| `title` | string | Notification title |
| `message` | text | Body text |
| `type` | string | information, success, warning, error, production, inventory, quality, maintenance, sales, hr, finance, system |
| `priority` | string | low, medium, high, critical |
| `module` | string | ERP module source |
| `action_url` | string | Optional deep-link (e.g. `/production/work-orders`) |
| `is_read` | boolean | Read status |
| `created_by` | string | Display name of creator |
| `created_at` | datetime | Auto-set |
| `updated_at` | datetime | Auto-set |

**Indexes:** `user_id`, `is_read`, `created_at`

### API Endpoints

All endpoints require JWT (`Authorization: Bearer <token>`).

Every response uses the standard envelope:

```json
{
  "success": true,
  "message": "",
  "data": {},
  "errors": null,
  "timestamp": "2026-07-12T08:53:00+00:00"
}
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | Paginated list (`page`, `page_size`) |
| `GET` | `/api/notifications/unread-count` | Unread count only |
| `PUT` | `/api/notifications/{id}/read` | Mark one notification as read |
| `PUT` | `/api/notifications/read-all` | Mark all unread as read |
| `DELETE` | `/api/notifications/{id}` | Delete one notification |
| `DELETE` | `/api/notifications/clear` | Delete all notifications for the current user |

**Business rules**
- Unread count is always derived from `is_read = false` rows for the logged-in user.
- Opening a notification automatically marks it as read (badge decrements immediately).
- Marking an already-read notification again does not change the count.
- Clear/delete operations affect only the current user's notifications.

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `NotificationBell` | Bell icon + badge in navbar; wires dropdown and actions |
| `NotificationBadge` | Unread count badge (caps at `9+`) |
| `NotificationDropdown` | Scrollable list, mark-all, clear-all, load-more |
| `NotificationItem` | Single row with type/priority styling, read vs unread |
| `ConfirmationDialog` | Reusable confirm modal (used for clear-all) |

### Try It

1. Start backend and frontend (see Setup below).
2. Register a tenant admin and log in with your own company email.
3. Click the bell icon in the top bar — demo notifications are created for local testing.
4. Open notifications one by one; the badge count drops instantly (5 → 4 → … → 0).
5. Use **Mark all read**, **Clear** (confirmation dialog), or per-item delete/mark-read actions.

## Settings API (Users, Roles, Permissions, Audit Logs)

Backend support for the **Settings** sidebar pages. Requires JWT and **Admin** role.

### Architecture

```
React (Settings pages) → /admin/* or /api/settings/* → SettingsService → rbac_service → SQLite
```

| Layer | File |
|-------|------|
| Service | `backend/app/services/settings_service.py` |
| RBAC logic | `backend/app/services/rbac_service.py` |
| Legacy router | `backend/app/api/admin.py` → `/admin/*` (flat JSON) |
| Enterprise router | `backend/app/routers/settings_api.py` → `/api/settings/*` (envelope) |

### Endpoints

**Users** (`/admin/users` or `/api/settings/users`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users with roles |
| GET | `/users/stats` | Total, active, administrator counts |
| GET | `/users/{id}` | Single user |
| POST | `/users` | Create user |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |

**Roles** (`/admin/roles` or `/api/settings/roles`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roles` | List roles with permission summary & user count |
| GET | `/roles/{id}` | Single role |
| POST | `/roles` | Create role |
| PUT | `/roles/{id}` | Update role name, description, permissions |
| PUT | `/roles/{id}/permissions` | Update permissions only (`/admin` only) |
| DELETE | `/roles/{id}` | Delete role |

**Permissions** (`/admin/permissions/*` or `/api/settings/permissions/*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/permissions/modules` | Module catalogue for checkboxes |
| GET | `/permissions/matrix` | Default role → module matrix |
| GET | `/permissions` | All roles with permissions (`/api/settings` only) |
| PUT | `/permissions/{role_id}` | Update role permissions (`/api/settings` only) |

**Audit Logs** (`/admin/access-logs` or `/api/settings/audit-logs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/access-logs` | Activity list (flat array, legacy) |
| GET | `/audit-logs` | Paginated logs with `search`, `page`, `page_size` |

Login events are recorded automatically via `POST /auth/login`.

### User Accounts

The application uses registration and tenant-based user management. There are no default seeded users with production credentials.

## Prerequisites

- Python 3.10+
- Node.js 18+

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` (optional):

```env
DATABASE_URL=sqlite:///./smrt.db
FRONTEND_BASE_URL=http://localhost:5173

# Google Calendar + Meet (Meetings module) — see Meetings section
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/integrations/google/calendar/callback
GOOGLE_CALENDAR_DEFAULT_TIMEZONE=Asia/Kolkata
```

No extra database server is required. The SQLite file `backend/smrt.db` is created automatically on first backend start.

### DB Browser for SQLite

- **File location:** `backend/smrt.db` (relative to the backend folder when you run uvicorn from `backend/`)
- **Open the database:** Use [DB Browser for SQLite](https://sqlitebrowser.org/) to inspect tables and data
- **Important:** Stop the backend before opening the file in DB Browser — SQLite uses file locking while the app is running
- The first administrative user is created through `POST /auth/register`.

Run the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs (title: **Insights Iva API**)

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Run the frontend:

```bash
npm run dev
```

App: http://localhost:5173 (title: **Insights Iva**)

### Docker (optional)

```bash
docker compose up --build
```

| Service | URL | Notes |
|---------|-----|--------|
| Frontend | http://localhost:8080 | Nginx serves the built app + proxies API routes |
| Backend | http://localhost:8000 | SQLite persisted in Docker volume `smrt_data` |

The frontend image is built with `VITE_API_BASE_URL=""` so API calls use same-origin routing through nginx.

## Auth API (Login & Registration)

Base URL: `http://localhost:8000` (or your `VITE_API_BASE_URL`).

### POST `/auth/login`

**Request (JSON):**

| Field      | Type   | Required |
|-----------|--------|----------|
| `email`   | string | Yes      |
| `password`| string | Yes      | Min **12** characters on register / reset |

**Response (200):** JWT pair + user (includes `refresh_token` when issued).

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "Admin User",
    "tenant_id": 1,
    "tenant_name": "Company Name",
    "role": "Admin"
  }
}
```

**Errors:** `401` — `"Invalid Credentials"` (generic); `429` — account lockout.

### POST `/auth/register`

**Request (JSON):**

| Field           | Type   | Required | Notes        |
|----------------|--------|----------|--------------|
| `company_name` | string | Yes      | New tenant   |
| `full_name`    | string | Yes      |              |
| `email`        | string | Yes      | Valid email  |
| `password`     | string | Yes      | Min **12** chars |

**Response (200):** Same shape as login in development (auto-verified). In production, email verification may be required before login — see [SECURITY_REPORT.md](./SECURITY_REPORT.md).

**Errors:** `409` — Email already registered.

### Frontend

- **Login** (`/login`): `POST /auth/login`, stores `smrt-token` / `smrt-refresh-token` / `smrt-user`. Axios refreshes on 401.
- **Register** (`/register`): `POST /auth/register`.
- **Forgot / reset / verify:** `/forgot-password`, `/reset-password`, `/verify-email`.

Optional `backend/.env` (security-related — copy from `backend/.env.example`; full list in [SECURITY_REPORT.md](./SECURITY_REPORT.md)):

```env
JWT_SECRET_KEY=your-long-random-secret-min-32-chars
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=change-me-strong-password
```

Never commit real `.env` files or use example placeholder passwords in production.

## Usage

1. **Login:** API login with your registered company email and password.
2. **Language:** Click the Language button (🌐) in the top bar to switch between English, Hindi, Tamil, or Telugu.
3. **Notifications:** Click the bell icon (🔔) in the top bar to view in-app notifications. Unread items are highlighted; opening one marks it read and updates the badge without refreshing the page.
4. **Dashboard:** View production, inventory, HR, and machine status summaries. Use the top **search** bar to jump to pages.
5. **Production:** Create production orders, work orders, machines; open **Shop-floor Job Card** (`/production/job-card`) for operator views; track batches and daily reports. Tables support search, sorting, pagination.
6. **Manufacturing workflow:** Confirm a sales order → open **Sales Order Job Card** from the order detail page → create job card → advance through team queues at `/manufacturing/workflow`. Admin dashboard shows live workflow hub with stage pipeline.
7. **Inventory / Materials:** Store Dashboard, raw materials, finished goods, stock transfer, adjustment, ledger, warehouses, and inventory settings. Create stock items with **Add Raw Material** / **Add Finished Good** on the list pages (or **Add Item** from the dashboard quick actions); products are also available under Masters → Products.
8. **Masters:** Customers, Vendors, Products — create/edit via modals; bulk import pages for each.
9. **Purchases / Procurement:** Purchases, payments made, debit notes, Vendor Master, purchase orders, material requests, GRN, supplier payments.
10. **Sales:** Sales orders (create → confirm → job card), invoices, quotations, payment receipts, and related sales documents.
11. **HR:** Dashboard, attendance, leave, payroll, performance, recruitment, training, employees, shifts; HR Settings at `/hr/settings`.
12. **Accounts:** Ledger, expenses, chart of accounts, journals, P&L, balance sheet, reports.
13. **Meetings:** Open `/meetings` → connect Google Calendar → create events with optional Google Meet → join from detail page or week grid.
14. **Settings:** Theme, language, company profile, invoice/format/template/sector/sequence settings where enabled; **Integrations** shows Google Calendar status.

## API Overview

| Prefix | Endpoints |
|--------|-----------|
| `/auth/` | `POST /login`, `POST /register`, `POST /refresh`, `POST /logout`, verify-email, forgot/reset-password |
| `/production/` | products, orders, work-orders, **job-cards** (list/detail), batches, machines, machine-status, daily-reports, MRP-related endpoints as exposed |
| `/inventory/` | warehouses, suppliers, items, items/barcode/{barcode}, dashboard, stock-levels, stock-movements |
| `/biz/feature-settings/{key}` | Per-tenant module settings (`GET`/`PUT`), e.g. `inventory_settings` |
| `/procurement/` | purchase-orders, **vendors** (CRUD, soft-delete, bulk-status, summary, export, purchase-history, products, bank-lookup), material-requests, goods-receipt, supplier-payments |
| `/hr/` | dashboard, employees, shifts, attendance (clock-in, clock-out), leave, payroll, performance; UI routes also include `/hr/recruitment`, `/hr/training`, `/hr/settings` |
| `/sales/` | customers, sales-orders, invoices, invoices/{id}, payments |
| `/manufacturing/workflow/` | hub, queue, job-cards, sales-orders/{id}/job-card, confirm, material-check, production/quality/packing/billing actions, backfill |
| `/accounts/` | ledger/accounting APIs as exposed by accounts router; income/expenses where enabled |
| `/analytics/` | production-trend, machine-efficiency, inventory-turnover, worker-performance, profit, dashboard |
| `/quality/` | inspection, defects, batch-reports, compliance |
| `/maintenance/` | records, preventive, breakdowns, schedule |
| `/alerts/` | list, create, acknowledge |
| `/api/notifications` | list, unread-count, mark read, mark all read, delete, clear (JWT) |
| `/admin/` | users, users/stats, roles, permissions/modules, access-logs (Admin JWT) |
| `/api/settings/` | users, roles, permissions, audit-logs (Admin JWT, envelope) |
| `/documents/` | list, create |
| `/meetings/` | list, create, get, update, delete; `POST /{id}/google-meet` |
| `/integrations/google/calendar/` | status, connect, callback, disconnect |

All list endpoints accept `tenant_id` as a query parameter (default: 1 for demo). Interactive API docs: http://localhost:8000/docs (development only; disabled when `ENVIRONMENT=production`).

---

## Stability Audit & Validation (Aug 2026)

End-to-end audit across frontend routes, sidebar navigation, API integration, RBAC, and automated tests. **RBAC alignment (21 Aug 2026):** seven roles, active-role permissions, JWT role on refresh, HR routes registered, Store Manager purchases nav. **HR UI pass (15 Aug 2026):** mockup-aligned dashboards without schema changes.

### Verification summary

| Check | Command / scope | Result |
|-------|-----------------|--------|
| Frontend production build | `npm run build` | Pass |
| Frontend unit tests | `npm test -- --run` | Pass |
| Backend RBAC tests | `pytest tests/test_rbac.py tests/test_permission_fallback.py` | Pass |
| Backend API tests | `pytest` | Pass (some pre-existing auth/logout failures may remain) |
| Sidebar → route mapping | Sidebar links vs `AppRoutes` | HR routes + Store Manager purchases aligned |
| RBAC refresh | Login as role → refresh browser | Menu unchanged (JWT role on `/auth/me`) |

### Navigation coverage

All sidebar entries in `frontend/src/config/sidebarNav.js` resolve to registered routes, including:

- **Masters** — Customers, Vendors, Products
- **Inventory** — Store Dashboard, Raw Materials, Finished Goods, Transfer, Adjustment, Ledger, Warehouses, Settings (`/inventory` → products list UI)
- **Production** — Planning, MRP, Work Orders, Shop-floor Job Card, Schedule, Machine Allocation, Daily Reports
- **Manufacturing workflow** — `/manufacturing/workflow` (team board), Sales Order Job Card routes, dashboard hub
- **Purchases & Sales** — Purchase flows, sales orders + job card, invoices, quotations, e-Invoice, E-Waybill login, digital signature
- **HR** — Hub, Attendance, Leave, Payroll, Performance, Recruitment, Training, Reports, Settings (`/hr/settings`); candidates/interviews and training sessions remain placeholders on sub-routes
- **Meetings** — `/meetings` (Google Calendar week view + list), `/meetings/:id` (details, Join Meet, Open Calendar)

Legacy redirects remain (e.g. `/inventory/items` → `/inventory/raw-materials`, `/settings/expense-settings` → `/accounts/expenses/settings`).

### Backend fixes applied

| Area | File | Change |
|------|------|--------|
| Customer validation | `backend/app/schemas/sales.py` | Name, contact, email, 10-digit phone, GSTIN validators on create/update |
| Journal entries | `backend/app/schemas/accounts.py` | Map `reference`/`description` → `ref`/`desc` before persist |
| RBAC permissions | `backend/app/core/rbac_constants.py`, `auth_service.py` | Active-role-only permissions; JWT role on `/auth/me` |
| Chart of Accounts | `backend/app/api/accounts.py`, `chartOfAccountsSync.js` | Dedupe GL codes per tenant; transient retry on list fetch |
| HR RBAC menu | `rbac_constants.py`, `sidebarNav.js`, `AppRoutes.jsx` | HR module + 19 routes |
| Store Manager nav | `storeManagerNavConfig.js`, `permissions.js` | Full Purchases menu; trimmed account/subscription items |
| Date controls | `dateControls.jsx`, `dateUtils.js`, `index.css` | Shared pickers; duplicate calendar icon fix |

### Global refresh UX

The bottom-right **Refresh** control (`GlobalRefreshButton`) re-fetches registered page loaders via `usePageRefresh` — no full browser reload. While refreshing: spinner, disabled button, cache-bust on GETs; on success: brief “Updated just now” message.

### Run tests locally

```bash
# Backend (from backend/ with venv active)
python -m pytest -q

# Frontend (from frontend/)
npm test
npm run build
```

### HR dashboard pass (15 Aug 2026)

| Page | Key files |
|------|-----------|
| HR Hub | `frontend/src/pages/hr/HRDashboard.jsx`, `hrMasterData.js` (`mergeHrHub`) |
| Attendance | `frontend/src/pages/hr/Attendance.jsx`, `mergeAttendanceDashboard()` |
| Leave | `frontend/src/pages/hr/Leave.jsx`, `mergeLeaveDashboard()` |
| Payroll | `frontend/src/pages/hr/Payroll.jsx`, `mergePayrollDashboard()` |
| Performance | `frontend/src/pages/hr/Performance.jsx`, `mergePerformanceDashboard()` |
| Recruitment | `frontend/src/pages/hr/Recruitment.jsx`, `DEMO_RECRUITMENT_DASHBOARD` |
| Training | `frontend/src/pages/hr/Training.jsx`, `DEMO_TRAINING_DASHBOARD` |
| HR Settings | `frontend/src/pages/hr/HRSettings.jsx` (client-side form; no persist API yet) |

Shared UX: purple accent (`#6366f1`), KPI cards, Recharts donuts/line/area charts, `SerialNumberCell`, row actions via `InventoryRowActionsMenu`, `usePageRefresh` on all dashboard pages.

### Manufacturing workflow pass (18 Aug 2026)

| Area | Key files |
|------|-----------|
| State machine | `backend/app/core/workflow_constants.py` |
| Models & migrations | `backend/app/models/manufacturing_workflow.py`, Alembic `d1e2f3a4b5c6_*`, `e2f3a4b5c6d7_*` |
| Job card service | `backend/app/services/job_card_service.py` |
| Workflow API | `backend/app/api/manufacturing_workflow_api.py` |
| Sales Job Card UI | `frontend/src/pages/manufacturing/SalesJobCardPage.jsx` |
| Workflow components | `frontend/src/components/manufacturing/JobCard*.jsx` |
| Admin hub | `frontend/src/components/dashboard/ManufacturingWorkflowHub.jsx` |
| Team board | `frontend/src/pages/manufacturing/RoleWorkflowBoard.jsx` |
| Tests | `backend/tests/test_workflow_state_machine.py` |

Verification: `npm run build` (frontend), `pytest tests/test_workflow_state_machine.py` (backend state machine).

### UI/UX & design system pass (18 Aug 2026)

Forest green rebrand and shared component migration — **styling only**; no API, route, or business-logic changes.

| Area | Key files |
|------|-----------|
| CSS tokens | `frontend/src/index.css` — `:root`, `.ui-input`, `.ui-table-wrap`, `.ui-badge-*` |
| Design system barrel | `frontend/src/design-system/index.js`, `classes.js`, `erpFormControls.jsx`, `statusTone.js` |
| Accounts UI | `accountsDesignSystem.jsx`; LedgerV2, ChartOfAccountsV2, ExpenseV2, NewJournalEntryV2, modals |
| Inventory UI | `inventoryDesignSystem.jsx`; InventoryV2, RawMaterials, FinishedGoods, StockTransfer, Warehouses |
| Sales modals & forms | AddParty, AddItem, AddNote, PaymentReceiptForm, CreateBill, RefundVouchers, etc. |
| ERP document forms | QuotationForm, TaxInvoiceForm, CreditNoteForm, PurchaseForm, CreatePurchaseOrder, … (via `erpFormControls`) |
| Manufacturing UI | `ManufacturingWorkflowHub`, `SalesJobCardPage`, `JobCard*.jsx`, `CreateSalesOrder.jsx` |
| Shared filters | `FilterBar.jsx` — Finance, Quality, Maintenance filters |

Verification: `npm run build` passes; `erpFormControls` code-split chunk. Details: [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

### Button action system pass (24 Aug 2026)

Action-based button consistency across list pages and modals — **styling only**; no API, route, RBAC, or business-logic changes.

| Area | Key files |
|------|-----------|
| Button variants | `frontend/src/components/common/Button.jsx` — `add`, `primary`, `secondary`, `view`, `edit`, `warning`, `danger` |
| CSS tokens | `frontend/src/index.css` — `--color-add`, `.ui-btn--add`, `.ui-btn--view`, `.ui-btn--edit` |
| Toolbar create | `AddButton` — teal-blue `#0F5F78` for + Add New / Create … |
| Table rows | `TableActionButtons.jsx` — View (green) · Edit (blue) · Delete (red) |
| Row menus | `RowActionMenu.jsx` + `rowActionTone.js` |
| Domain wrappers | `AccountsAddButton`, `InventoryAddButton` |
| Tests | `frontend/src/components/common/Button.test.jsx` |

**Convention:** toolbar/list **create** → `variant="add"`; form **Save/Submit** → `variant="primary"` (brand green). Details: [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

### Known limitations (not bugs)

- **E-Invoice / E-Waybill / Digital Signature** — UI routes exist; live submission requires user-configured external portal credentials.
- **Settings → Alerts feedback link** — placeholder `href="#"` until a feedback URL or form is configured.
- **Vite bundle size** — `export-libs` chunk may exceed 900 kB; optional future code-splitting only.
- **HR demo fallbacks** — Dashboard pages show `hrMasterData.js` preview when APIs return empty; live data replaces preview automatically when records exist.
- **HR Settings** — UI-only; Save/Reset toasts do not persist to backend yet. Two-factor toggle is not enforced by auth.
- **Recruitment / Training sub-routes** — `/hr/recruitment/candidates`, `/hr/training/sessions`, and some Performance/Leave/Payroll secondary tabs are placeholders.
- **Residual purple accents** — Some payment forms and inline document “+ Add Item” links still use legacy styling; migration tracked in UI_UX_AUDIT_REPORT.

---

## Security Audit & Hardening (Aug 2026)

Authorized full-stack security review of Insights Iva (React + FastAPI + SQLite). Scope: authentication, RBAC/IDOR, API validation, CORS/headers, secrets, error handling, frontend session handling, print XSS, and PostgreSQL migration readiness. **No destructive testing.** Full findings: [SECURITY_REPORT.md](./SECURITY_REPORT.md).

### Security model (baseline)

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | bcrypt passwords; JWT access (30 min) + refresh (7 days) with rotation/revocation; login lockout (5 attempts / 30 min); session inactivity timeout |
| **Authorization** | RBAC via `require_permission`, `require_admin`, `tenant_scope`; action-level checks (`require_action`) on accounts mutations |
| **Multi-tenant** | `tenant_id` scoping on services and queries — users cannot access another tenant’s records by ID alone |
| **API** | Pydantic validation; generic 500/DB errors (no stack traces); JWT required on business routes |
| **Headers** | `X-Content-Type-Options`, `X-Frame-Options`, CSP, HSTS (production), `Referrer-Policy` |
| **CORS** | Explicit `CORS_ORIGINS`; localhost regex allowed **development only** |
| **Frontend** | `ProtectedRoute` + path RBAC (UX); session requires JWT + user profile; axios auto-refresh on 401 |

Backend authorization is **authoritative**. Frontend route checks improve UX only — never rely on them alone.

### Critical fixes applied (16 Aug 2026)

| Issue | Fix |
|-------|-----|
| Any authenticated user could clear/seed tenant data | `/api/system/*` — **Admin only** + **blocked in production** |
| Client auth bypass via forged `localStorage` user | Session requires `smrt-token`; 401 clears all auth keys |
| Tenant JWT overwrote platform `Authorization` | Axios skips tenant token on `/platform/*` routes |
| Finance writes used module-only RBAC | Accounts create/update/delete use `require_action` |
| Demo passwords reset every startup | Seed scripts skip password overwrite in production |
| Real credentials in `.env.example` | Replaced with placeholders |
| Platform login without rate limit | Rate limiting on `/platform/auth/login` |
| OpenAPI exposed in production | `/docs`, `/openapi.json`, `/redoc` disabled when `ENVIRONMENT=production` |
| XSS in print templates | HTML escaping on dynamic fields in dispatch challan + production print utils |

### Verification (16 Aug 2026)

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| `test_auth.py`, `test_rbac.py`, `test_tenant_isolation.py`, `test_journal_entries_api.py` | Pass |
| Full backend pytest | Some pre-existing repository-layer failures (documented in SECURITY_REPORT) |

### Production deployment checklist

1. Set `ENVIRONMENT=production`
2. Set strong `JWT_SECRET_KEY` (min 32 chars — e.g. `openssl rand -hex 32`)
3. Set `CORS_ORIGINS` to your production frontend URL only (no wildcards)
4. Configure `SMTP_*` for email verification and password reset
5. Set `FRONTEND_BASE_URL` to the public frontend URL
6. Set unique `SUPER_ADMIN_*` credentials (never use `.env.example` placeholders)
7. Deploy behind HTTPS (reverse proxy); HSTS is set automatically in production
8. Keep `backend/smrt.db` out of version control; restrict filesystem permissions on the DB file

### Remaining security TODOs

| Priority | Item |
|----------|------|
| High | Extend `require_action` to DELETE/PUT on inventory, sales, HR, procurement, documents |
| High | Move JWT from `localStorage` to httpOnly Secure cookies |
| Medium | Encrypt Google OAuth / e-waybill credentials at rest (`field_crypto.py`) |
| Medium | Redis or edge rate limiting for multi-instance deployments |
| Medium | Replace or isolate `xlsx` export dependency (known npm advisories, no upstream fix) |
| Low | Wire HR Settings security toggles (2FA, session policy) to backend |
| Low | Alembic-only migrations before PostgreSQL cutover |

### PostgreSQL migration notes

SQLite-specific items to address before migration: `require_sqlite` in `config.py`, startup `ALTER TABLE` in `main.py`, boolean/JSON/datetime column types, and concurrent-write patterns. See [SECURITY_REPORT.md](./SECURITY_REPORT.md) for the full compatibility checklist.

---

## Future Upgrades (Roadmap)

| Feature | Description |
|---------|-------------|
| **IoT Machine Integration** | Real-time machine data feeds, sensor connectivity, OEE metrics |
| **AI Production Prediction** | Demand forecasting, production optimization, anomaly detection |
| **Mobile App (React Native)** | Native mobile app for on-floor data entry, approvals, and notifications |

---

## License

Private / Internal Use
