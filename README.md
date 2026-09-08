# Insights Iva

**Insights Iva** is a full-stack manufacturing ERP and business intelligence platform. It unifies production, inventory, procurement, sales, finance/accounting, HR, quality, maintenance, meetings (Google Calendar & Meet), alerts, documents, and analytics in a multi-tenant SaaS application.

**Tagline:** Business Intelligence • Analytics • AI

Security hardening (auth lockout, email verification, refresh tokens, RBAC, tenant isolation, headers) is documented in [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md). **Full security audit + hardening pass (16 Aug 2026)** — summary in [Security Audit & Hardening](#security-audit--hardening-aug-2026) below. **Frontend UI/UX audit + design system migration (18 Aug 2026; button action system 24 Aug 2026)** — [README — UI design system](#ui-design-system-colors--buttons). **Wireframe-first UI/UX standard** for new pages — [Wireframe-first UI/UX standard](#wireframe-first-uiux-standard). Architecture and recent analysis: [README — Architecture overview](#architecture).

**Latest pass (Sep 2026):** **Full-stack HR module** — PostgreSQL schema (`k8l9m0n1o2p3`, `k9l0m1n2o3p4`), 60+ `/hr/*` APIs, organization setup, preboarding, expenses, payroll runs, MIS reports, role permissions, leave-balance workflow, API-only frontend (no `localStorage` fallbacks on operational pages) — see [HR Module](#hr-module-full-stack).

**Prior pass (24 Aug 2026):** **Action-based button system** — centralized `Button` variants (`add`, `primary`, `secondary`, `view`, `edit`, `warning`, `danger`), `AddButton` / `TableActionButtons`, and app-wide migration of list/toolbar Add/Create CTAs to teal-blue `#0F5F78` — see [UI design system](#ui-design-system-colors--buttons) and [README — UI design system](#ui-design-system-colors--buttons).

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

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic, **PostgreSQL** (production); SQLite allowed only for tests (`ALLOW_SQLITE_RUNTIME=1`)
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

Full migration status: [README — UI design system](#ui-design-system-colors--buttons).

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

Security details: [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md). Architecture: [README — Architecture overview](#architecture).

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

Multi-tenant HR module with live PostgreSQL data, JWT + RBAC (`require_permission("hr")`), and tenant isolation via `tenant_id`. Dashboard pages may still use `hrMasterData.js` merge helpers for empty-state previews; **operational pages** (employees, preboarding, expenses, payroll, organization setup, reports, roles) load and persist **only through the API**.

| Area | Route(s) | Highlights |
|------|----------|------------|
| HR Dashboard | `/hr` | Live KPIs from `GET /hr/dashboard` |
| Employees | `/hr/employees`, `/hr/employees/create`, `/hr/employees/offboarded` | Onboarding, enriched list, offboarding |
| Attendance | `/hr/attendance` (+ approval, overtime, adjusted-leave, settings) | Clock-in/out, regularization, reports |
| Leave | `/hr/leave` (+ approvals, holiday, adjustment, plans) | Requests, holidays, leave plans; balance deducted on approve |
| Payroll | `/hr/payroll` (+ salary/statutory components, breakup, on-hold, payslips, settings, create) | Components, PF/ESIC, payroll run generation |
| Expenses | `/hr/expenses`, `/hr/expenses/my`, `/hr/expenses/approvals` | Claims, approvals, overview |
| Site visits | `/hr/site-visits` | Field visit tracking |
| Assets | `/hr/assets` (+ mapped) | Company assets and allocations |
| Recruitment | `/hr/recruitment`, `/hr/recruitment/create` | Preboarding pipeline |
| Shifts | `/hr/shifts` (+ monthly, week-off, create) | Shift definitions and assignments |
| Reports (MIS) | `/hr/reports/*` | Attendance, leave, expense, site-visit, employee, PF, ESIC, salary, bank-template |
| Organization setup | `/hr/settings` | Leave types, designations, departments, employment types, expense categories, branches, geo-fencing |
| Roles & permissions | `/hr/roles` | Per-role permission toggles (`hr_role_permissions` table) |
| Performance, Training | `/hr/performance`, `/hr/training` | Dashboard-style pages (demo merge when API empty) |

**API client:** `frontend/src/api/hrApi.js` — mirrors backend routes under `/hr/`.

See [HR Module (full stack)](#hr-module-full-stack) for architecture, migrations, database tables, and tests.

### Sales & Billing Module
- Tax invoices, quotations, payment receipts, refund vouchers, proforma / export invoices, delivery challans, credit & debit notes
- **Sales orders** — create at `/sales/orders/create`; confirm runs MRP and advances workflow; confirmed orders expose **Open Job Card**
- e-Invoice and E-Waybill login helpers; digital signature page
- GST billing (SGST, CGST, IGST); payment tracking
- Customer management (Masters → Customers)

### Accounts & Reports
- Ledger, expense, expense settings, chart of accounts, manual journal entries
- Journal entries accept `ref`/`desc` or `reference`/`description` in the POST body; create returns **201 Created**
- Chart of Accounts dedupes duplicate GL rows at the API and UI layer; list fetches retry transient connection resets during backend hot-reload (`chartOfAccountsSync.js`)
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
HR Dashboard → Employees / Preboarding → Organization setup (`/hr/settings`) → Attendance & leave (approve deducts balance) → Expenses & site visits → Payroll (components → run) → MIS reports → Roles & permissions (`/hr/roles`).

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
│   │   ├── models/              # SQLAlchemy: user, tenant, role, hr, hr_module, production, …
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
├── backend/PRODUCTION_DEPLOYMENT.md
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
| HR | hr.py + hr_module.py | hr_service.py, hr_module_service.py | hr.py (Employee, Shift, Attendance, Leave, Payroll, …); hr_module.py (org setup, expenses, payroll runs, reports, hr_role_permissions) |
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
| HR | HRDashboard, OrganizationSetup (`/hr/settings`), Employees, Preboarding, Attendance, Leave, Payroll, Expenses, Site visits, Assets, Shifts, MIS reports, Roles & Permissions + create pages | hrApi |
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

## HR Module (full stack)

End-to-end HR for multi-tenant manufacturing ERP: organization master data, employee lifecycle, attendance, leave (with balance tracking), shifts, expenses, site visits, assets, payroll (components + statutory + runs), MIS reports, announcements, and UI-level role permissions. Reuses existing auth, tenants, users, and RBAC — no duplicate auth or company tables.

### Architecture

```
React (hr pages, hrApi.js)
  → FastAPI /hr/*
  → hr_service.py (core: employees, attendance, leave, shifts)
  → hr_module_service.py (org setup, preboarding, expenses, payroll, reports, role permissions)
  → PostgreSQL (tenant_id on every HR table)
```

| Layer | Location |
|-------|----------|
| Core models | `backend/app/models/hr.py` — Employee, Shift, AttendanceRecord, LeaveRequest, PayrollRecord, … |
| Extended models | `backend/app/models/hr_module.py` — org setup, preboarding, expenses, payroll runs, payslips, `HrRolePermission`, … |
| Core service | `backend/app/services/hr_service.py` — CRUD + leave balance on approve/reject |
| Module service | `backend/app/services/hr_module_service.py` — business logic for extended APIs |
| Helpers | `backend/app/services/hr_module_helpers.py` — pagination, audit, date coercion |
| API routers | `backend/app/api/hr.py` (includes `hr_module` router) |
| Frontend API | `frontend/src/api/hrApi.js` |
| Organization setup UI | `frontend/src/pages/hr/OrganizationSetup.jsx` (route `/hr/settings`) |
| Roles UI | `frontend/src/pages/hr/HRRolesPermissions.jsx` (route `/hr/roles`) |
| Sidebar nav | `frontend/src/config/hrSidebarNav.js` |
| Tests | `backend/tests/test_hr_module.py` |

### Database migrations (Alembic)

HR migrations are **idempotent** — they skip tables/columns that already exist, so `alembic upgrade head` is safe on databases that were partially provisioned.

| Revision | File | Purpose |
|----------|------|---------|
| `k8l9m0n1o2p3` | `k8l9m0n1o2p3_hr_module_complete.py` | HR org tables, preboarding, expenses, holidays, leave plans, payroll runs, reports; column extensions on `employees`, `shifts`, `attendance_records`, `leave_requests` |
| `k9l0m1n2o3p4` | `k9l0m1n2o3p4_hr_role_permissions.py` | `hr_role_permissions` (unique per `tenant_id` + `role_key`, FK → `tenants.id`) |

**Apply migrations (PostgreSQL):**

```bash
cd backend
# Ensure backend/.env has DATABASE_URL=postgresql+psycopg://...
alembic current          # check revision
alembic upgrade head     # apply pending only
alembic current          # should show k9l0m1n2o3p4 (head)
```

Re-running `alembic upgrade head` after head is a no-op. Existing rows are never deleted by these migrations.

### Key PostgreSQL tables

| Table | Purpose |
|-------|---------|
| `hr_org_leave_types`, `hr_org_designations`, `hr_org_departments`, `hr_org_employment_types` | Organization setup masters |
| `hr_org_branches`, `hr_org_expense_categories`, `hr_org_geo_fencing` | Branches, expense categories, geo-fences |
| `preboarding_candidates` | Recruitment / offers pipeline |
| `expense_claims`, `site_visits` | Employee expenses and field visits |
| `holidays`, `leave_plans`, `employee_leave_balances` | Leave calendar and balances |
| `salary_components`, `statutory_component_configs`, `payroll_settings` | Payroll configuration |
| `payroll_runs`, `payslips`, `salary_holds` | Payroll processing |
| `announcements`, `hr_report_runs` | Comms and generated MIS reports |
| `hr_role_permissions` | JSON permission toggles per HR role key (account, admin, employee, manager, top-management) |

Extended columns on core tables include `employees.lifecycle_status`, `employees.first_name` / `last_name`, `attendance_records.status`, `leave_requests.is_half_day`, etc.

### API surface (summary)

All routes require JWT. Mutations use `require_permission("hr")`. Tenant scope is enforced server-side (`tenant_id` from JWT — never trust `company_id` from the client).

| Group | Example endpoints |
|-------|-------------------|
| Dashboard | `GET /hr/dashboard` |
| Organization | `GET/POST/PUT/DELETE /hr/organization/leave-types`, `…/designations`, `…/departments`, `…/employment-types`, `…/expense-categories`, `…/branches`, `…/geo-fencing` |
| Employees | `GET /hr/employees/enriched`, `POST /hr/employees`, `GET /hr/employees/offboarded` |
| Preboarding | `GET/POST /hr/preboarding/candidates`, `POST …/archive` |
| Attendance & leave | `POST /hr/attendance/clock-in`, `GET /hr/leave`, `PATCH /hr/leave/{id}` (balance update on approve) |
| Holidays & plans | `GET/POST /hr/holidays`, `GET/POST /hr/leave/plans` |
| Expenses | `GET/POST /hr/expenses/my`, `GET /hr/expenses/approvals`, `POST /hr/expenses/approve` |
| Payroll | `GET/POST /hr/payroll/salary-components`, `PUT /hr/payroll/statutory/pf`, `POST /hr/payroll/generate` |
| Reports | `GET /hr/reports/{type}`, `POST /hr/reports/{type}/generate` |
| Roles | `GET/PUT /hr/roles/{roleId}/permissions`, `GET /hr/roles/{roleId}/users` |
| Announcements | `GET/POST /hr/announcements` |

Full client mirror: `frontend/src/api/hrApi.js`.

### RBAC & audit

- Module gate: `require_permission("hr")` on write endpoints.
- Fine-grained toggles (attendance.view, leave.my, payroll.manage, …) stored in `hr_role_permissions` for the HR roles UI; platform RBAC remains in `rbac_constants.py`.
- HR actions logged via `AuditLogService` (`audit_hr` helper) with `module_name="HR"`.

### Tests

```bash
cd backend
ALLOW_SQLITE_RUNTIME=1 python -m pytest tests/test_hr_module.py -q
```

Covers dashboard, org leave types CRUD, preboarding, expenses, holidays/leave plans, attendance report generation, announcements, and role permissions.

### Frontend build

```bash
cd frontend
npm run build
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

**Response (200):** Same shape as login in development (auto-verified). In production, email verification may be required before login — see [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md).

**Errors:** `409` — Email already registered.

### Frontend

- **Login** (`/login`): `POST /auth/login`, stores `smrt-token` / `smrt-refresh-token` / `smrt-user`. Axios refreshes on 401.
- **Register** (`/register`): `POST /auth/register`.
- **Forgot / reset / verify:** `/forgot-password`, `/reset-password`, `/verify-email`.

Optional `backend/.env` (security-related — copy from `backend/.env.example`; full list in [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md)):

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
11. **HR:** Dashboard, employees, preboarding, attendance, leave, payroll, expenses, site visits, assets, shifts, MIS reports, organization setup (`/hr/settings`), roles (`/hr/roles`). See [HR Module](#hr-module-full-stack).
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
| `/hr/` | Full HR module: dashboard, employees, shifts, attendance, leave, payroll, expenses, site visits, organization setup, reports, roles & permissions, announcements — see [HR Module](#hr-module-full-stack) |
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
- **HR** — Hub, Attendance, Leave, Payroll, Expenses, Site visits, Assets, Shifts, Employees, Preboarding, MIS Reports, Organization Setup (`/hr/settings`), Roles (`/hr/roles`); Training/Performance hub pages use demo merge when empty
- **Meetings** — `/meetings` (Google Calendar week view + list), `/meetings/:id` (details, Join Meet, Open Calendar)

Legacy redirects remain (e.g. `/inventory/items` → `/inventory/raw-materials`, `/settings/expense-settings` → `/accounts/expenses/settings`).

### Backend fixes applied

| Area | File | Change |
|------|------|--------|
| Customer validation | `backend/app/schemas/sales.py` | Name, contact, email, 10-digit phone, GSTIN validators on create/update |
| Journal entries | `backend/app/schemas/accounts.py` | Map `reference`/`description` → `ref`/`desc` before persist |
| RBAC permissions | `backend/app/core/rbac_constants.py`, `auth_service.py` | Active-role-only permissions; JWT role on `/auth/me` |
| Chart of Accounts | `backend/app/api/accounts.py`, `chartOfAccountsSync.js` | Dedupe GL codes per tenant; transient retry on list fetch |
| HR RBAC menu | `rbac_constants.py`, `sidebarNav.js`, `hrSidebarNav.js`, `AppRoutes.jsx` | HR module + 50+ routes |
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

### HR module pass (Sep 2026)

| Area | Key files |
|------|-----------|
| Models | `backend/app/models/hr_module.py`, extensions in `hr.py` |
| Migrations | `k8l9m0n1o2p3_hr_module_complete.py`, `k9l0m1n2o3p4_hr_role_permissions.py` |
| Services | `hr_module_service.py`, `hr_module_helpers.py`, `hr_service.py` (leave balance) |
| API | `backend/app/api/hr_module.py` (included from `hr.py`) |
| Organization setup | `frontend/src/pages/hr/OrganizationSetup.jsx`, `organizationSetup.css` |
| Roles & permissions | `frontend/src/pages/hr/HRRolesPermissions.jsx` |
| API client | `frontend/src/api/hrApi.js` |
| Tests | `backend/tests/test_hr_module.py` (8 tests) |

Verification: `alembic upgrade head` on PostgreSQL; `ALLOW_SQLITE_RUNTIME=1 pytest tests/test_hr_module.py`; `npm run build` in `frontend/`.

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
| HR Settings | `frontend/src/pages/hr/OrganizationSetup.jsx` (routed as `/hr/settings`; org setup tabs) |

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

Verification: `npm run build` passes; `erpFormControls` code-split chunk. Details: [README — UI design system](#ui-design-system-colors--buttons).

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

**Convention:** toolbar/list **create** → `variant="add"`; form **Save/Submit** → `variant="primary"` (brand green). Details: [README — UI design system](#ui-design-system-colors--buttons).

### Known limitations (not bugs)

- **E-Invoice / E-Waybill / Digital Signature** — UI routes exist; live submission requires user-configured external portal credentials.
- **Settings → Alerts feedback link** — placeholder `href="#"` until a feedback URL or form is configured.
- **Vite bundle size** — `export-libs` chunk may exceed 900 kB; optional future code-splitting only.
- **HR demo fallbacks** — Hub/dashboard pages (Performance, Training, Recruitment) may show `hrMasterData.js` preview when APIs return empty; operational HR pages use API-only data.
- **Salary breakup API** — `GET /hr/payroll/salary-breakup` may return `[]` until breakup records are implemented; payroll run checks salary components/employees.
- **Recruitment / Training sub-routes** — Some secondary tabs remain placeholders.
- **Residual purple accents** — Some payment forms and inline document “+ Add Item” links still use legacy styling; migration tracked in UI_UX_AUDIT_REPORT.

---

## Security Audit & Hardening (Aug 2026)

Authorized full-stack security review of Insights Iva (React + FastAPI + SQLite). Scope: authentication, RBAC/IDOR, API validation, CORS/headers, secrets, error handling, frontend session handling, print XSS, and PostgreSQL migration readiness. **No destructive testing.** Full findings: [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md).

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
| Low | Fine-grained HR permissions in platform RBAC (`rbac_constants.py`) beyond UI toggles |
| Low | Alembic-only migrations before PostgreSQL cutover |

### PostgreSQL migration notes

SQLite-specific items to address before migration: `require_sqlite` in `config.py`, startup `ALTER TABLE` in `main.py`, boolean/JSON/datetime column types, and concurrent-write patterns. See [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md) for the full compatibility checklist.

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

# Insights Iva ERP — Project Analysis Report

**Last updated:** 24 August 2026

## 1. Executive Summary

Insights Iva is a multi-tenant manufacturing ERP with a React + Vite frontend and a FastAPI + SQLAlchemy backend. SQLite is typical for local development; PostgreSQL is supported via Alembic for workflow tables and production deployments. The product spans production, inventory, procurement, sales, finance, HR, quality, maintenance, analytics, alerts, documents, meetings, settings, and administration.

The codebase is modular and largely production-oriented: live APIs drive inventory, manufacturing workflow, and most operational modules. August 2026 work prioritized:

1. **Action-based button system (24 Aug)** — Central `Button` component with semantic variants (`add`, `primary`, `view`, `edit`, `danger`, …), `AddButton` / `TableActionButtons`, CSS tokens in `index.css`, and migration of list/toolbar Add/Create CTAs across sales, procurement, inventory, HR, production, accounts, and admin modules. No API, route, or RBAC changes.
2. **End-to-end RBAC (21 Aug)** — Seven registerable roles with a single permission source in `backend/app/core/rbac_constants.py` and frontend mirror in `frontend/src/config/permissions.js`. Login and `/auth/me` return **active-role-only** permissions; JWT role is preserved on refresh.
3. **Manufacturing workflow engine (18 Aug)** — Sales → Job Card → Inventory → Production → Quality → Packing → Billing with PostgreSQL persistence, state machine, and team actions.
4. **Design system & UI/UX (Aug 2026)** — Forest green brand (`#036f71`), `frontend/src/design-system/` barrel, accounts/inventory shells, Settings shell inside main ERP layout.
5. **Shared date/calendar controls (21 Aug)** — `dateUtils.js`, `dateControls.jsx`, duplicate calendar icon fix.
6. **HR dashboards** — Mockup-aligned pages with API merge fallbacks in `hrMasterData.js` when live data is empty.

For setup and features, see [README.md](./README.md). For security, see [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md). For UI migration status, see [README — UI design system](#ui-design-system-colors--buttons).

---

## 2. Project Structure

### Frontend (`frontend/src`)

| Area | Purpose |
|------|---------|
| `routes/` | `AppRoutes.jsx`, lazy-loaded `lazyPages.jsx` |
| `config/` | `permissions.js`, `sidebarNav.js`, `storeManagerNavConfig.js`, `rbacNavFilters.js`, `manufacturingWorkflow.js` |
| `design-system/` | Tokens, `classes.js`, `erpFormControls.jsx`, `dateControls.jsx`, domain shells |
| `components/common/` | `Button.jsx`, `AddButton`, `TableActionButtons`, `EmptyState`, `ResourcePage`, … |
| `context/` | `AuthContext` (JWT + user + refresh), `SettingsContext`, `ToastContext` |
| `hooks/` | `useAuth`, `usePermissions` (`hasRole`, `hasPermission`, `can`, `canAction`) |
| `components/layout/` | `Sidebar`, `ProtectedRoute`, `Navbar` |
| `pages/` | Domain pages by module (production, inventory, sales, hr, accounts, …) |
| `api/` | Axios clients per domain (`authApi`, `hrApi`, `procurementApi`, …) |

### Backend (`backend/app`)

| Area | Purpose |
|------|---------|
| `api/` | FastAPI routers (auth, rbac, hr, manufacturing_workflow, accounts, …) |
| `core/` | `rbac_constants.py`, `permissions.py`, `seed_roles.py`, `workflow_constants.py` |
| `services/` | Business logic (`auth_service`, `workflow_*`, `rbac_service`, …) |
| `models/` | SQLAlchemy models (tenant-scoped) |
| `alembic/versions/` | Workflow and meetings migrations |

---

## 3. RBAC Architecture (21 Aug 2026)

### Single source of truth

| Layer | Location |
|-------|----------|
| Permission matrix | `backend/app/core/rbac_constants.py` → `PERMISSION_MATRIX`, `MODULE_CATALOG`, `SIDEBAR_MENU_CATALOG` |
| Runtime enforcement | `backend/app/core/permissions.py` → `get_user_permissions`, `require_permission`, `require_action` |
| Role seeding | `backend/app/core/seed_roles.py` |
| Frontend mirror | `frontend/src/config/permissions.js` → `ROLE_PERMISSIONS`, `ROUTE_MODULES`, `userCanAccessPath` |
| Nav narrowing | `frontend/src/config/rbacNavFilters.js` |
| Store Manager UI | `frontend/src/config/storeManagerNavConfig.js` |

### Registerable roles

| Role | Primary modules | Notes |
|------|-----------------|-------|
| **Admin** | All modules | Full workflow visibility |
| **Sales Manager** | sales, masters, analytics, meetings | Sales dashboard redirect |
| **Production Manager** | production, quality, inventory (narrow UI) | Sidebar allowlist |
| **Store Manager** | inventory, procurement, accounts (ledger/expense) | Custom sidebar; full Purchases menu |
| **HR Manager** | hr, documents, analytics, settings | HR-only sidebar sections |
| **Accountant** | accounts, sales (billing docs), analytics | Accounts dashboard redirect |
| **Operator** | production, factoryMonitor, documents, alerts | Execution paths only |

### Auth → UI data flow

```
Login (role selected) → JWT carries role / role_id
  → AuthContext stores user + permissions in localStorage
  → GET /auth/me reads JWT role → permissions for that role only
  → usePermissions() → sidebar filterStaticNav / Store Manager nav
  → ProtectedRoute → userCanAccessPath()
  → API → require_permission / tenant_scope
```

---

## 4. UI Component Architecture (24 Aug 2026)

### Button system

| File | Responsibility |
|------|----------------|
| `components/common/Button.jsx` | Canonical button; variants, sizes, loading, Link/`to` polymorphism |
| `components/common/TableActionButtons.jsx` | Row inline View · Edit · Delete |
| `components/common/rowActionTone.js` | Label → tone mapping for `RowActionMenu` |
| `index.css` | `.ui-btn--*` classes and `--color-add`, `--color-action-view`, `--color-action-edit` tokens |
| `design-system/index.js` | Barrel export for `Button`, `AddButton`, shells |

**Convention:** Toolbar/list **create** actions use `variant="add"` (teal-blue). Form **submit/save** uses `variant="primary"` (brand green). Table row actions use `view` / `edit` / `danger`.

### Shared shells

| Shell | Covers |
|-------|--------|
| `accountsDesignSystem.jsx` | Ledger, COA, journals, reports |
| `inventoryDesignSystem.jsx` | Inventory V2, FG, RM, warehouses |
| `settingsUi.jsx` | Settings module (dark navy in dark mode) |
| `ResourcePage.jsx` | Generic CRUD list + modal create |
| `EmptyState.jsx` | Zero-state with `AddButton` CTA |

---

## 5. Key Modules

### Dashboard

- Admin: `ReferenceDashboard` + `ManufacturingWorkflowHub` (live API, 30s refresh).
- Role redirects via `roleRedirect.js`.

### Manufacturing workflow

| Route | Purpose |
|-------|---------|
| `/` | Admin workflow hub |
| `/manufacturing/workflow` | Team board |
| `/sales/orders/:id/job-card` | Sales Job Card |
| `/sales/orders/create` | Create sales order |

Persistence: `sales_job_cards`, material checks, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

### Inventory & Store Manager

- Live inventory APIs; Store Manager uses `storeManagerNavConfig.js`.
- Purchases: Stock In, Requisitions, Purchase, Payments Made, Debit Note, PO, GRN, Supplier Payments.

### HR

Dashboard pages under `/hr/*` with live API + `hrMasterData.js` merge fallbacks. Create CTAs migrated to `AddButton` / `variant="add"`.

### Accounts

- LedgerV2, ChartOfAccountsV2, journal entries — `accountsDesignSystem`; Add Customer/Vendor use action button variants.

---

## 6. Recent Fixes & Improvements

| Date | Area | Change |
|------|------|--------|
| 24 Aug | UI buttons | `add` variant (#0F5F78); action colors (view/edit/danger); `AddButton`, `TableActionButtons`; 80+ page migrations |
| 21 Aug | RBAC | Active-role permissions; JWT role on `/auth/me`; HR routes; Store Manager nav |
| 21 Aug | Calendar | `dateUtils.js`, `dateControls.jsx`; duplicate icon fix |
| 18 Aug | Workflow | State machine, job card API, Alembic migrations |
| 18 Aug | Design system | Forest green tokens, ERP form controls, domain shells |
| 16 Aug | Security | Full audit pass — see SECURITY_REPORT.md |

---

## 7. Verification

### Frontend

```bash
cd frontend && npm run build
cd frontend && npm test -- --run
cd frontend && npm test -- --run src/components/common/Button.test.jsx
```

### Backend

```bash
cd backend && pytest tests/test_rbac.py tests/test_permission_fallback.py tests/test_workflow_state_machine.py
cd backend && pytest
```

### Manual checks (recommended)

- Log in as each of the 7 roles: sidebar, dashboard redirect, forbidden URL → Access Denied.
- Refresh browser: role and menu unchanged.
- Spot-check Add/Create toolbar buttons: teal-blue `#0F5F78`, white Plus icon, 40px height.
- Table rows: View (green), Edit (blue), Delete (red).
- Form Save/Submit buttons remain brand green (`primary`).

---

## 8. Recommendations

- Run full `pytest` + `npm run build` in CI before releases.
- Extend E2E tests (Playwright) for role login → sidebar → workflow action.
- Finish migrating inline “+ Add Item” links inside document forms to consistent secondary/link pattern (optional).
- Migrate remaining raw `type="date"` inputs to shared `DatePicker`.
- Apply `alembic upgrade head` on all PostgreSQL environments.
- Extend `log_audit()` to workflow transitions and HR writes.

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Product overview, setup, API map, RBAC summary |
| [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md) | Auth, RBAC enforcement, tenant isolation |
| [README — UI design system](#ui-design-system-colors--buttons) | Design system, button migration, UX status |
| [backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md) | Production deploy checklist |

---

## 10. Change Log

| Date | Note |
|------|------|
| 2026-08-13 | Initial report: live-data inventory, design tokens, search UX |
| 2026-08-15 | HR dashboards, Chart of Accounts dedupe, HR nav |
| 2026-08-18 | Manufacturing workflow, design system, ERP form controls |
| 2026-08-21 | End-to-end RBAC, HR routes, Store Manager nav, shared date controls |
| 2026-08-24 | Action-based button system; AddButton; TableActionButtons; app-wide Add/Create CTA migration |


# Insights Iva Security Implementation Report

Generated after production-ready security hardening across the React + FastAPI Insights Iva application.

**Last reviewed:** 24 August 2026

## Executive Summary

Security features were implemented across authentication, session management, input validation, multi-tenant isolation, API protection, logging, and frontend auth flows. Backend suites covering auth, RBAC, tenant isolation, and CRUD smoke tests are in `backend/tests/`. Development mode preserves auto-verified registration for local testing. Production mode (`ENVIRONMENT=production`) enforces email verification before login.

**RBAC alignment pass (21 Aug 2026):** Seven registerable roles share one permission matrix in `rbac_constants.py`. `/auth/me` and `/auth/profile` read the **JWT role** so token refresh preserves the selected role; permissions returned are for the **active role only** (not a union of all assigned roles). Frontend `permissions.js` mirrors backend modules including `hr`. Store Manager uses a dedicated path allowlist — server-side `require_permission` remains authoritative; sidebar and `ProtectedRoute` are UX layers only.

Recent product UI work (design tokens, HR dashboards, manufacturing workflow, Settings shell, date controls, Store Manager nav) does **not** relax auth, CORS, or tenant isolation.

**Manufacturing workflow note (18 Aug 2026):** All `/manufacturing/workflow/*` endpoints require JWT and enforce team-based actions via `workflow_team_service` and `workflow_constants.ROLE_TO_TEAMS`. Transitions are validated by the state machine; invalid cross-team actions are rejected server-side. Job card and material-check records are tenant-scoped like other business entities. Frontend workflow UI is presentational — authorization is enforced on every API call.

**UI/UX pass note (18 Aug 2026):** Forest green rebrand and `design-system/` migration are styling-only. No new public routes without auth, no relaxation of CORS, and no change to token storage or session handling. See [README — UI design system](#ui-design-system-colors--buttons).

**Button consistency pass (24 Aug 2026):** Action-based button variants (`add`, `view`, `edit`, `danger`), `AddButton`, and `TableActionButtons` migrated across 80+ list/toolbar pages. **Styling and component structure only** — no changes to auth flows, JWT handling, RBAC matrices, route guards, API endpoints, or tenant isolation. Delete/Edit buttons remain client-side UX; server-side `require_permission` / `require_action` unchanged.

**HR module note (Aug 2026):** New HR Settings UI includes a “two-factor authentication” checkbox and session/password fields — these are **client-side only** until wired to backend policy. HR dashboard demo data in `hrMasterData.js` is read-only preview when APIs are empty; it does not bypass authentication or tenant isolation. HR write endpoints (leave, payroll, performance create) remain protected by existing JWT + RBAC + `tenant_scope`.

For product setup and module overview, see [README.md](./README.md). For architecture and recent UI/live-data analysis, see [README — Architecture overview](#architecture).

## Completed Security Features

### 1. Security Audit (Pre-Implementation)
- Reviewed auth flow, RBAC, tenant scoping, CORS, error handlers, password hashing, and test coverage.
- Identified gaps: lockout, email verification, password reset, refresh tokens, generic login errors, file upload validation, security headers.

### 2. Login Lockout
- Maximum **5 failed attempts** per account (`MAX_LOGIN_ATTEMPTS`).
- **30-minute lock** after threshold (`LOCKOUT_MINUTES`).
- Attempts stored in `login_attempts` table with IP, user agent, and failure reason.
- Locked accounts receive HTTP **429** with a generic lock message (not credential details).

### 3. Email Verification
- New users in **production** are inactive until verified (`email_verified=False`, `is_active=False`).
- Secure tokens (256-bit random, SHA-256 hashed in DB) with **24-hour** expiry.
- Endpoints: `POST /auth/verify-email`, `POST /auth/resend-verification`.
- Frontend page: `/verify-email`.
- **Development**: accounts auto-activate for local/demo use.

### 4. Generic Login Errors
- Failed login always returns **`"Invalid Credentials"`** (HTTP 401).
- No distinction between wrong email vs wrong password.

### 5. Password Reset
- One-time reset tokens (hashed, expiring in **30 minutes** by default).
- Tokens marked `used` after consumption — cannot be reused.
- `POST /auth/forgot-password` returns the same message whether or not the email exists.
- Frontend pages: `/forgot-password`, `/reset-password`.

### 6. Session Security
- Access token TTL: **30 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- Refresh tokens: **7 days**, stored hashed, rotatable, revocable.
- **Inactivity timeout**: 120 minutes (`SESSION_INACTIVITY_MINUTES`) — enforced on protected routes and refresh.
- Endpoints: `POST /auth/refresh`, `POST /auth/logout`.
- Frontend axios interceptor auto-refreshes on 401.

### 7. Backend Validation
- Pydantic schemas validate auth request bodies (email format, registration/reset password length ≥ 12, field length limits).
- FastAPI `RequestValidationError` handler returns structured 422 without stack traces.
- Existing module endpoints retain Pydantic validation.

### 8. Input Sanitization
- `app/utils/sanitize.py`: strips control characters, script tags, path traversal in filenames.
- Email normalization and validation in auth schemas.
- SQLAlchemy ORM uses parameterized queries throughout (SQL injection resistant).

### 9. Role-Based Access Control (RBAC)
- `require_permission`, `require_admin`, `tenant_scope`, and `require_action` on business APIs.
- **Registerable roles (7):** Admin, Sales Manager, Production Manager, Store Manager, HR Manager, Accountant, Operator.
- Permission matrix: `backend/app/core/rbac_constants.py` (`PERMISSION_MATRIX`, `MODULE_CATALOG`).
- Runtime resolution: `get_user_permissions()` uses active role; explicit role JSON overrides matrix when set.
- **Active role on refresh:** JWT `role` / `role_id` → `/auth/me` returns permissions for that role only (`auth_service.get_user_with_role`).
- **HR module:** `hr` in catalog; HR routes require module permission server-side.
- **Store Manager:** Frontend path whitelist in `permissions.js` / `storeManagerNavConfig.js`; backend still enforces inventory/procurement/accounts scopes.
- Admin-only routes protected; core tests in `test_rbac.py`, `test_permission_fallback.py`.
- **Frontend:** `ProtectedRoute` + `userCanAccessPath()` — UX only; never substitute for API checks.

### 10. Multi-Tenant Security
- **Existing** tenant isolation via `tenant_scope` and service-level filters unchanged.
- Tests in `test_tenant_isolation.py` pass.

### 11. API Security
- JWT Bearer required on protected endpoints via `get_current_user`.
- Checks: valid token, active user, email verified, session not inactive.
- Proper HTTP status codes: 401 (unauth), 403 (forbidden), 422 (validation), 429 (lockout), 500 (generic).

### 12. CORS Security
- Explicit origin list from `CORS_ORIGINS` env var — no wildcards.
- Production should set only trusted frontend URLs.

### 13. Password Security
- bcrypt via passlib (unchanged).
- Plain text passwords never stored.

### 14. HTTPS Ready
- `Strict-Transport-Security` header set when `ENVIRONMENT=production`.
- Security headers middleware on all responses.
- Deploy behind reverse proxy (nginx/Caddy) with TLS termination.

### 15. Logging
- Login attempts logged to `login_attempts` table.
- Password reset requests logged via `audit_logs` + `AccessLog` (rbac_service).
- Admin actions continue via existing `AccessLog` in admin module.
- Structured request logging with request IDs in `main.py`.

### 16. Audit Trail
- New `audit_logs` table and `audit_service.log_audit()`.
- Wired for: registration, email verification, password reset request/completion.
- Existing admin `AccessLog` covers user/role admin actions.
- **Note**: Full CRUD audit on every module endpoint is a future incremental task (see Remaining Issues).

### 17. File Upload Security
- `app/utils/file_validation.py`: extension allow/block lists, size limit (10 MB), secure random filenames.
- Ready for use when binary upload endpoints are added (documents module is currently metadata-only).

### 18. Error Handling
- Global handlers suppress stack traces from API responses.
- Generic 500: `"Internal server error."`
- Database errors: `"A database error occurred."`

### 19. Database Security
- Parameterized ORM queries.
- New indexes on security tables (`user_id`, `email`, `tenant_id`).
- Startup migrations add user security columns to existing SQLite DBs.

### 20. Code Quality
- Security logic centralized in `security_service.py`, `auth_service.py`, `audit_service.py`.
- Reusable frontend auth API and axios refresh interceptor.
- No duplication of token generation (shared `security_tokens.py`).

---

## Verification Results

| Area | Status |
|------|--------|
| Backend tests (`backend/tests/`) | Auth, RBAC, tenant isolation, CRUD, admin, notifications, and related suites |
| Auth: login, register, lockout, refresh | Covered in `test_auth.py` |
| RBAC | `test_rbac.py` / `test_rbac_roles.py` |
| Tenant isolation | `test_tenant_isolation.py` |
| CRUD smoke tests | `test_crud.py` |
| Generic login error message | Covered in auth tests |
| Frontend auth pages | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` |
| Demo seed accounts | Registration-based; no production default passwords |

---

## Remaining Issues & Recommendations

| Priority | Item | Recommendation |
|----------|------|----------------|
| High | Configure SMTP in production | Set `SMTP_*` env vars; without SMTP, emails log to console only |
| High | Rotate `JWT_SECRET_KEY` | Use `openssl rand -hex 32` in production `.env` |
| Medium | Rate limiting at edge | Add nginx/Cloudflare rate limits on `/auth/login` and `/auth/forgot-password` |
| Medium | Full CRUD audit coverage | Wire `log_audit()` into inventory, sales, HR (leave status, payroll create, performance review), etc. |
| Medium | HR Settings persistence | Do not treat client-side toggles (2FA, GDPR, export) as enforced until backed by API + policy |
| Medium | MFA / 2FA | Consider OTP for Admin accounts; HR Settings checkbox is UI-only today |
| Low | CSP header | Add Content-Security-Policy tuned for Vite build |
| Low | Migrate to Alembic-only migrations | Replace startup `ALTER TABLE` with formal migration revision |
| Low | Refresh token cookie option | HttpOnly cookies instead of localStorage for XSS resilience |
| Low | Account unlock admin API | Allow admins to manually unlock locked accounts |
| Low | HR demo data clarity | Document that `hrMasterData.js` fallbacks are display-only; never substitute for authz checks |

---

## HR Module — Security Considerations (Aug 2026)

| Topic | Status | Notes |
|-------|--------|-------|
| Route protection | Unchanged | All `/hr/*` pages behind `ProtectedRoute` + JWT |
| RBAC menu | Updated | `rbac_constants.py` mirrors expanded HR sidebar; permissions still module-scoped (`hr`, `attendance`, etc.) |
| Demo dashboards | Low risk | Recruitment/Training use static demo objects; no extra API surface |
| HR Settings page | UI only | Save/Reset does not call backend; security toggles are not enforced |
| Chart of Accounts dedupe | Data integrity | `_dedupe_gl_accounts()` prevents duplicate codes in list responses; does not weaken tenant filters |
| Row actions | Unchanged | `InventoryRowActionsMenu` is presentational; mutations still go through authenticated API calls |

When HR Settings persistence is implemented, validate: tenant-scoped storage, Admin/HR Manager write permission, audit log on change, and do not expose session timeout/password policy to non-admin roles without explicit RBAC rules.

---

## Manufacturing Workflow — Security Considerations (18 Aug 2026)

| Topic | Status | Notes |
|-------|--------|-------|
| Route protection | Enforced | Workflow pages (`/manufacturing/workflow`, `/manufacturing/job-card/:id`, job card from sales) behind `ProtectedRoute` + JWT |
| API authentication | Enforced | All routes under `/manufacturing/workflow/*` use `get_current_user` |
| Tenant isolation | Enforced | Job cards, material checks, transitions filtered by `tenant_id` in services |
| Team authorization | Enforced | Actions (confirm, material check, assign operator, quality, packing, billing) require caller’s ERP role to map to the workflow team for that stage (`workflow_team_service`) |
| State machine integrity | Enforced | `workflow_state_service.transition_allowed()` rejects invalid status jumps; tested in `test_workflow_state_machine.py` |
| Admin override | Limited | Admin role maps to all teams; backfill endpoint should remain admin-only |
| Audit trail | Partial | `manufacturing_workflow_transitions` records action, user, team, timestamps; extend `log_audit()` for compliance if required |
| Client-side workflow UI | UX only | Stepper, timeline, and team board do not bypass server checks — always call authenticated APIs |
| PostgreSQL migrations | Operational | Alembic revisions `d1e2f3a4b5c6_*`, `e2f3a4b5c6d7_*` — apply with least-privilege DB user in production |

**Recommendations:** Keep backfill (`POST /manufacturing/workflow/backfill`) admin-only; add IDOR regression tests for cross-tenant order IDs; log failed transition attempts at WARNING level for security monitoring.

---

## Files Modified

### Backend — New Files
| File | Purpose |
|------|---------|
| `backend/app/models/security.py` | RefreshToken, EmailVerificationToken, PasswordResetToken, LoginAttempt, AuditLog |
| `backend/app/services/security_service.py` | Lockout, tokens, session activity |
| `backend/app/services/email_service.py` | SMTP / dev email logging |
| `backend/app/services/audit_service.py` | CRUD audit helper |
| `backend/app/utils/sanitize.py` | Input sanitization |
| `backend/app/utils/security_tokens.py` | Token generation & hashing |
| `backend/app/utils/file_validation.py` | Upload validation helpers |

### Backend — Modified Files
| File | Changes |
|------|---------|
| `backend/app/core/config.py` | Security settings (TTL, lockout, SMTP, frontend URL) |
| `backend/app/models/user.py` | email_verified, failed_login_attempts, locked_until, last_activity_at |
| `backend/app/models/__init__.py` | Register security models |
| `backend/app/services/auth_service.py` | Token pairs, register verification flags |
| `backend/app/api/auth.py` | Full auth API (verify, reset, refresh, logout) |
| `backend/app/api/auth_deps.py` | Session inactivity, email verified check |
| `backend/app/schemas/auth.py` | Validated request/response schemas |
| `backend/app/main.py` | Security headers, DB migrations, security model import |
| `backend/app/core/seed_users.py` | No default demo users seeded; user accounts are created via registration |
| `backend/.env.example` | All security env vars documented |
| `backend/tests/conftest.py` | email_verified on test users |
| `backend/tests/test_auth.py` | Lockout, refresh, forgot-password tests |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `frontend/src/pages/auth/ForgotPassword.jsx` | Password reset request |
| `frontend/src/pages/auth/ResetPassword.jsx` | Password reset form |
| `frontend/src/pages/auth/VerifyEmail.jsx` | Email verification |

### Frontend — Modified Files
| File | Changes |
|------|---------|
| `frontend/src/api/authApi.js` | All auth endpoints |
| `frontend/src/api/axiosConfig.js` | Auto refresh on 401 |
| `frontend/src/context/AuthContext.jsx` | Refresh token storage, logout revokes |
| `frontend/src/pages/auth/Login.jsx` | Forgot password link, refresh token |
| `frontend/src/pages/auth/Register.jsx` | Verification pending UX, min 12 chars |
| `frontend/src/routes/AppRoutes.jsx` | New auth routes |
| `frontend/src/routes/lazyPages.jsx` | Lazy imports for new pages (incl. `HRSettings`, `Recruitment`, `Training`) |
| `frontend/src/pages/hr/*.jsx` | HR dashboard UIs (Aug 2026) |
| `frontend/src/data/hrMasterData.js` | Demo merge helpers for HR dashboards |
| `frontend/src/config/sidebarNav.js` | Expanded HR sidebar sections |
| `backend/app/core/rbac_constants.py` | HR menu children incl. `/hr/settings` |
| `backend/app/api/accounts.py` | GL account dedupe on list/seed |
| `backend/app/api/manufacturing_workflow_api.py` | Workflow hub, queue, job card, team actions (Aug 2026) |
| `backend/app/services/workflow_state_service.py` | State machine + transition validation |
| `backend/app/services/workflow_team_service.py` | Team membership and action authorization |
| `backend/app/core/workflow_constants.py` | Role-to-team mapping, workflow statuses |
| `backend/app/core/rbac_constants.py` | Manufacturing workflow menu permissions |

---

## APIs Updated

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Lockout, generic errors, refresh token in response |
| POST | `/auth/register` | Email verification in production; AuthResponse in dev |
| GET | `/auth/me` | Includes email_verified; session activity check |
| POST | `/auth/verify-email` | **New** — activate account |
| POST | `/auth/resend-verification` | **New** — resend verification email |
| POST | `/auth/forgot-password` | **New** — request reset link |
| POST | `/auth/reset-password` | **New** — consume one-time token |
| POST | `/auth/refresh` | **New** — rotate refresh token |
| POST | `/auth/logout` | **New** — revoke refresh token |

All other module APIs unchanged; continue using JWT + RBAC + tenant scope.

---

## Database Changes

### New Tables
- `refresh_tokens` — hashed refresh tokens with expiry and revocation
- `email_verification_tokens` — one-time verification tokens
- `password_reset_tokens` — one-time reset tokens
- `login_attempts` — login audit / lockout analysis
- `audit_logs` — CRUD and security event audit trail

### Modified Tables
- `users`:
  - `email_verified` (BOOLEAN, default false)
  - `failed_login_attempts` (INTEGER, default 0)
  - `locked_until` (DATETIME, nullable)
  - `last_activity_at` (DATETIME, nullable)

Startup migrations in `main.py` add columns to existing SQLite databases and backfill `email_verified=1` for existing users.

---

## Production Deployment Checklist

1. Set `ENVIRONMENT=production`
2. Set strong `JWT_SECRET_KEY`
3. Configure `CORS_ORIGINS` to your production frontend URL only
4. Configure SMTP for verification and reset emails
5. Set `FRONTEND_BASE_URL` to production frontend URL
6. Deploy behind HTTPS reverse proxy
7. Review `ACCESS_TOKEN_EXPIRE_MINUTES` and `SESSION_INACTIVITY_MINUTES` for your UX

---

## Environment Variables (Security-Related)

```env
JWT_SECRET_KEY=<strong-random-hex>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
SESSION_INACTIVITY_MINUTES=120
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=30
EMAIL_VERIFICATION_EXPIRE_HOURS=24
PASSWORD_RESET_EXPIRE_MINUTES=30
FRONTEND_BASE_URL=https://your-app.example.com
ENVIRONMENT=production
CORS_ORIGINS=https://your-app.example.com
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@your-domain.com
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Features, setup, API overview, design system notes |
| [README — Architecture overview](#architecture) | Structure review, live-data findings, workflow engine |
| [README — UI design system](#ui-design-system-colors--buttons) | Design system adoption, UI migration status |

## Change Log (Documentation)

| Date | Note |
|------|------|
| 2026-08-13 | Confirmed UI/design-system and Job Card read-path work do not alter auth, RBAC, tenant isolation, or CORS. Cross-linked README and Project Analysis Report. |
| 2026-08-15 | HR dashboard UI pass documented. HR Settings toggles are client-side only. RBAC menu expanded for HR sections. Chart of Accounts dedupe noted as data-integrity fix, not auth change. |
| 2026-08-16 | Full security audit + hardening pass (this section). |
| 2026-08-18 | Manufacturing workflow security considerations added. UI/UX rebrand documented as styling-only. Workflow API files listed. Cross-linked UI_UX_AUDIT_REPORT. |
| 2026-08-21 | RBAC alignment: active-role permissions, JWT role on `/auth/me`, `hr` module, Store Manager path allowlist documented. UI date/settings changes noted as non-security. |
| 2026-08-24 | Button consistency pass documented as styling-only. No auth, RBAC, route, or API contract changes. Cross-linked updated UI_UX_AUDIT_REPORT. |

---

## RBAC Alignment — 21 August 2026

End-to-end role → permission → sidebar → route → API alignment without changing database schema or API contracts.

| Topic | Status | Notes |
|-------|--------|-------|
| Permission source | Single matrix | `rbac_constants.py` + frontend `permissions.js` mirror |
| Login role selection | Enforced | Selected role embedded in JWT at login |
| Token refresh | Fixed | `/auth/me` reads JWT role — menu does not revert to default role |
| Permission union bug | Fixed | No longer unions permissions from all roles assigned to user |
| HR routes | Protected | `/hr/*` behind JWT + `hr` module; 19 routes registered |
| Store Manager nav | UX allowlist | Purchases paths added; Subscription/Logout removed from store sidebar only |
| Manufacturing workflow | Unchanged | Team actions still enforced in `workflow_team_service` |
| Client-side gates | UX only | `usePermissions`, `PermissionGate` — backend remains authoritative |

**Recommendations:** Add Playwright tests per role for forbidden URLs; extend `require_action` to remaining module DELETE routes; wire HR Settings security toggles to backend policy before treating as enforced.

---

## Security Audit — 16 August 2026

Authorized full-stack security review: audit → fix → test → re-check. No destructive testing, no architecture redesign, no UI changes beyond security-related behavior.

### Executive Summary

| Area | Status |
|------|--------|
| **Authentication** | Strong — bcrypt, JWT + refresh rotation, lockout, generic login errors, session inactivity |
| **Authorization / RBAC** | Good — JWT on business APIs, tenant scoping; action-level RBAC extended on accounts mutations |
| **API security** | Improved — destructive system routes locked down; OpenAPI disabled in production |
| **Database** | Good — ORM/parameterized queries; SQLite file gitignored |
| **Frontend** | Improved — session requires token; platform auth header collision fixed; print XSS mitigated |
| **CORS / headers** | Good — explicit origins; security headers middleware; localhost regex dev-only |
| **Dependencies** | Frontend `xlsx` has known advisories (no fix available); backend pip audit not available in env |

### Issues Found & Remediation

| Severity | Issue | Location | Status |
|----------|-------|----------|--------|
| **Critical** | Any authenticated user could wipe/seed tenant operational data | `backend/app/api/system_data.py` | **Fixed** — `require_admin` + blocked in production |
| **Critical** | Client auth bypass via `smrt-user` in localStorage without JWT | `frontend/src/context/AuthContext.jsx` | **Fixed** — `isAuthenticated` requires token + user; 401 clears session |
| **Critical** | Tenant axios interceptor overwrote platform `Authorization` header | `frontend/src/api/axiosConfig.js` | **Fixed** — skip tenant token on `/platform/*` |
| **High** | Finance mutations (expenses, journals, GL) used module-only RBAC | `backend/app/api/accounts.py` | **Fixed** — `require_action` / `tenant_scope_action` on writes |
| **High** | Demo passwords reset on every startup | `backend/app/core/seed_users.py` | **Fixed** — no password overwrite in production |
| **High** | Super-admin password synced from `.env` every startup | `backend/app/core/seed_super_admin.py` | **Fixed** — dev-only password sync |
| **High** | Real credentials in `.env.example` | `backend/.env.example` | **Fixed** — placeholders only |
| **High** | Platform login lacked IP rate limiting | `backend/app/api/platform_api.py` | **Fixed** — `check_rate_limit` on login |
| **High** | Hardcoded credentials in debug script | `backend/tmp_login_check.py` | **Fixed** — file removed |
| **Medium** | OpenAPI/Swagger exposed in production | `backend/app/main.py` | **Fixed** — docs/openapi disabled when `ENVIRONMENT=production` |
| **Medium** | `/health` leaked environment name | `backend/app/main.py` | **Fixed** — minimal response in production |
| **Medium** | CORS localhost regex with credentials in all envs | `backend/app/main.py` | **Fixed** — regex dev-only |
| **Medium** | Public `GET /roles` exposed role catalog | `backend/app/api/rbac_api.py` | **Fixed** — requires authentication |
| **Medium** | Unhandled exception handler could leak `str(exc)` | `backend/app/middleware/exception_handler.py` | **Fixed** — generic message only |
| **Medium** | 401 handler kept forged user object in storage | `frontend/src/api/axiosConfig.js`, `AuthContext.jsx` | **Fixed** |
| **Medium** | 5xx API errors forwarded raw backend `detail` to UI | `frontend/src/api/axiosConfig.js`, `utils/apiError.js` | **Fixed** — generic message for 500+ |
| **Medium** | XSS in print templates (`document.write`) | `Dispatch.jsx`, `printUtils.js` | **Fixed** — `escapeHtml()` on dynamic fields |
| **Low** | JWT in localStorage (XSS token theft risk) | Frontend auth | **Open** — recommend httpOnly cookies (future) |
| **Low** | `require_action` not used on all module DELETE routes | Various API routers | **Partial** — accounts done; extend incrementally |
| **Low** | Google OAuth tokens stored plaintext in SQLite | `google_calendar_service.py` | **Open** — use `field_crypto.py` |
| **Low** | In-memory rate limiting (single-process) | `middleware/security.py` | **Open** — Redis/edge limits for production |
| **Info** | `xlsx` package — prototype pollution / ReDoS advisories | `frontend/package.json` | **Open** — no upstream fix; review export usage |
| **Info** | HR Settings 2FA toggle is UI-only | `SettingsSectionContent.jsx` | **Open** — document; wire to backend when ready |

### Fixes Applied (16 Aug 2026)

**Backend**
- `system_data.py` — admin-only + production guard on clear/seed
- `permissions.py` — added `tenant_scope_action(module, action)`
- `accounts.py` — action-level RBAC on create/update/delete
- `main.py` — production docs off, minimal health, dev-only CORS regex
- `platform_api.py` — login rate limit
- `rbac_api.py` — authenticated `/roles`
- `seed_users.py`, `seed_super_admin.py` — no production credential resets
- `.env.example` — placeholder super-admin credentials
- `exception_handler.py` — no exception text in API responses
- Removed `tmp_login_check.py`

**Frontend**
- `AuthContext.jsx` — token required for session; clear on 401
- `axiosConfig.js` — platform route auth isolation; always clear on 401; generic 5xx toasts
- `apiError.js` — mask 500+ errors
- `htmlEscape.js` (new) — shared HTML escaping
- `printUtils.js`, `Dispatch.jsx` — escaped print output

### Verification Performed

| Check | Result |
|-------|--------|
| Frontend production build | **Pass** (`npm run build`) |
| Core backend security tests | **Pass** — `test_auth.py`, `test_rbac.py`, `test_tenant_isolation.py`, `test_journal_entries_api.py` |
| Full backend suite | **Pre-existing failures** in repository-layer tests (unrelated to this pass); documented, not bypassed |
| npm audit (high+) | **10 issues** — includes `xlsx` with no fix; no blind upgrades applied |
| pip audit | Not available in current Python environment |

### Authentication Status

- Passwords hashed with bcrypt; never returned in API responses
- JWT access (30 min) + refresh (7 days) with rotation and revocation
- Session inactivity enforced; email verification required in production
- Generic `"Invalid Credentials"` on failed login
- Account lockout after 5 failures (30 min)

### Authorization / RBAC Status

- All business routers require JWT via `get_current_user` / `require_permission` / `tenant_scope`
- Tenant isolation enforced in services (IDOR mitigated when IDs are scoped by `tenant_id`)
- Action-level checks now enforced on **accounts** write/delete endpoints
- **Gap:** Other modules still rely primarily on module-level `tenant_scope`; Operators with module access may mutate unless `require_action` is added per route

### API Security Status

- Pydantic validation on request bodies
- Global handlers return safe 500/DB error messages (no stack traces)
- Production: `/docs`, `/openapi.json`, `/redoc` disabled
- Destructive `/api/system/*` endpoints admin-only and dev-only

### Database Security Status

- SQLAlchemy ORM with parameterized queries (no user-controlled SQL concatenation in request paths)
- `smrt.db` in `.gitignore`
- Startup `ALTER TABLE` migrations are SQLite-specific — review before PostgreSQL migration

### Frontend Security Status

- ~200+ routes behind `ProtectedRoute` + path RBAC (UX layer)
- Session now requires valid JWT presence (not user JSON alone)
- No hardcoded production API keys in source
- AI markdown uses escape-first rendering; print flows now HTML-escaped
- Client RBAC remains **UX only** — backend is authoritative

### CORS & Security Headers Status

- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP (strict on API; relaxed on docs in dev)
- HSTS in production
- CORS: explicit `CORS_ORIGINS`; localhost regex only in development

### PostgreSQL Migration — Security Risks

| Risk | Notes |
|------|-------|
| SQLite-only validator in `config.py` | Must relax `require_sqlite` before PG cutover |
| Runtime `ALTER TABLE` in `main.py` startup | Replace with Alembic migrations |
| `check_same_thread=False` | Not applicable to PostgreSQL pool |
| Boolean / JSON / datetime types | Audit models using SQLite-specific defaults |
| Case-sensitive string uniqueness | PostgreSQL differs from SQLite for some collations |
| Concurrent writes | SQLite WAL not configured; PG will improve isolation under load |

### Remaining Security TODOs

1. Extend `require_action` to DELETE/PUT on inventory, sales, HR, procurement, documents
2. Move JWT to httpOnly Secure SameSite cookies
3. Encrypt Google OAuth and e-waybill credentials at rest (`field_crypto.py`)
4. Redis or edge rate limiting for multi-instance deployments
5. Replace or isolate `xlsx` for exports (known CVEs, no fix)
6. Wire HR Settings security toggles to backend policy
7. Full CRUD audit logging on business modules
8. Migrate to Alembic-only schema management before PostgreSQL

### Recommended Future Improvements

- MFA for Admin and Super Admin accounts
- CSRF tokens if moving to cookie-based auth
- Content-Security-Policy meta/header on Vite frontend build
- Periodic dependency review with `npm audit` / `pip-audit` in CI
- Security regression tests for IDOR on high-value IDs (invoice, payroll, stock adjustment)

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
- [Production Deployment](./backend/PRODUCTION_DEPLOYMENT.md) — auth/session (separate from visual UX)  
- [README — Architecture overview](#architecture) — architecture, RBAC flow  

---

## Change Log

| Date | Note |
|------|------|
| 2026-08-16 | Initial audit: badges, row menu, modal CSS, accounts shell |
| 2026-08-18 | Forest green rebrand; design-system module; ERP forms; manufacturing UI |
| 2026-08-21 | Manufacturing IA pass; 9-step pipeline; Store Manager nav; date controls |
| 2026-08-24 | **Action-based button system:** `add`/`view`/`edit` variants, `AddButton`, `TableActionButtons`, 80+ page Add/Create migration; button unit tests |
| 2026-08-25 | **Search bar standardization:** `SearchBar` default + `size="compact"`; Vendors reference; 40+ list pages + forms/dropdowns/comboboxes; dark theme tokens |
