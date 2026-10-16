# Manufacturing Actual Cost — Policy Gate & Implementation Spec

| Field | Value |
|-------|--------|
| **Document status** | `PENDING_BUSINESS_APPROVAL` |
| **Policy version** | `1.0.0-gate` (gate-only; increment when decisions are approved) |
| **Implementation** | **Blocked** — no Alembic migration, no valuation code changes until approval record is completed below |

**Do not run the Alembic migration or change `record_stock_movement` / GRN valuation until each checklist item in §1 is explicitly approved and §8 Approval record is filled with a real approver and date.**

---

## 1. Decisions requiring approval (all pending)

None of the following are approved until recorded in §8. Recommendations are **not** approval.

| # | Decision ID | Decision | Recommendation (not approval) | Approved? | Sign-off |
|---|-------------|----------|-------------------------------|-----------|----------|
| 1 | `valuation_method` | **Valuation method** | Moving-average at transaction time on `inventory_items.unit_cost`; snapshot on each production OUT. FIFO deferred. | ☐ | |
| 2 | `good_output_denominator` | **Good-output denominator** | See §2 — requires resolution of authoritative quantity source. | ☐ | |
| 3 | `material_returns` | **Material returns to stock** | Restore at **original issue unit cost** on return IN when linked to source issue; otherwise block or documented exception. | ☐ | |
| 4 | `historical_transactions` | **Historical transactions** | Pre-migration movements: cost columns **NULL** → actual **unavailable**; **no backfill** from current prices. | ☐ | |
| 5 | `actual_cost_scope` | **Actual cost scope** | **Material consumption only** (WO-linked OUT). Labour, machine, overhead, packaging unavailable. | ☐ | |

**API mirror:** `costing_policy_status` = `pending_approval`; each checklist item `approved: false` until §8 is completed.

**Product dashboard:** `actual_unit_cost`, `cost_variance` remain **unavailable** (`actual_cost_readiness: blocked`) until implementation **after** approval.

---

## 2. Unresolved rules (require business decision before implementation)

These are **not** approved defaults. Engineering must not choose silently.

### 2.1 GRN unit cost when PO line price is missing

When posting accepted GRN quantity to stock, unit cost must come from an authoritative purchase/landed source.

| Option | Behavior | Audit / control |
|--------|----------|-----------------|
| **A — Reject posting** | GRN stock-in fails (or line skipped) until every accepted line has a resolvable PO/procurement unit cost. | No inventory IN without price; may block operations. |
| **B — Authorized manual override** | Allow a one-off receipt unit cost entered by an authorized role (e.g. Admin / Accountant / Store Manager per RBAC), stored on the movement and in audit log. | Requires role, reason, optional approval reference; never default to zero. |

**Status:** ☐ Unresolved — record choice in §8 `approved_decision_ids` as `grn_missing_po_price: reject` or `grn_missing_po_price: manual_override`.

### 2.2 Good-output denominator when sources disagree

Actual material unit cost needs a single **good quantity** denominator. The ERP currently holds:

| Source | Field(s) | Notes |
|--------|----------|--------|
| Production order | `production_orders.actual_quantity` | Rolled from WOs on completion |
| Daily production report | `daily_production_reports.produced_quantity`, `scrap_quantity` | Per date / WO |
| Shop-floor entry | `production_entries.quantity_produced`, `quantity_rejected` | Operator-recorded |

When these differ for the same WO/PO/product, **one source must be authoritative** for costing.

| Option | Authoritative source | Implication |
|--------|---------------------|-------------|
| **PO actual** | Sum `production_orders.actual_quantity` (non-cancelled) per product | Simple aggregate; may ignore intra-day scrap detail unless adjusted elsewhere. |
| **Daily reports** | Sum `produced_quantity − scrap_quantity` from reports for WOs under those POs | Closer to reported scrap; needs clear WO/PO linkage. |
| **Production entries** | Sum `quantity_produced − quantity_rejected` per WO | Shop-floor truth; may lag PO rollup. |
| **Hierarchy** | e.g. entries if present for WO else daily report else PO actual | Must be documented and tested. |

**Status:** ☐ Unresolved — record choice in §8 (e.g. `denominator: production_order_actual` or `denominator: hierarchy_v1`).

Until resolved, **do not** compute actual unit cost in production code.

---

## 3. Minimal schema (post-approval only)

Inspect Alembic head before implementing. Proposed additive columns on `stock_movements`:

| Column | Type | Purpose |
|--------|------|---------|
| `unit_cost` | `Numeric(14, 4)` nullable | Transaction-time cost per stock UOM |
| `extended_cost` | `Numeric(16, 4)` nullable | `quantity * unit_cost` per signed policy |
| `work_order_id` | `Integer` FK `work_orders.id` nullable, indexed | WO link for production issues/returns |

Existing rows: cost columns remain **NULL** (historical = unknown). **Never** backfill from current catalog prices.

---

## 4. Transaction rules (moving-average, when approved)

See prior spec: GRN IN (accepted qty only), moving average on `inventory_items.unit_cost`, WO OUT snapshot at issue, returns at original issue cost when traceable. Apply §2.1 once chosen.

---

## 5. Actual production cost (material only, when approved)

```
material_cost_actual = SUM(extended_cost) on WO-linked OUT (+/- returns per policy)
good_qty             = per §2.2 authoritative rule
actual_unit_cost     = material_cost_actual / good_qty  if good_qty > 0 and costs complete
variance             = actual − standard  only when same scope and both complete
```

---

## 6. API / dashboard (current)

- `GET /api/production/toolkit/product-cost` — backward compatible.
- Gate fields: `actual_cost_readiness`, `costing_policy_status`, `costing_policy_version`, `costing_policy_checklist`, `unresolved_policy_rules`, `approval_record`, `recommended_costing_policy`, `costing_data_gaps`.
- RBAC: `user_can_view_bom_cost` for amounts; tenant + operator rules unchanged.

---

## 7. Test plan (after implementation; PostgreSQL disposable only)

GRN WA, reject qty, issue snapshot after price change, returns, reversals, concurrency, tenant isolation, RBAC, historical NULL, variance, regressions.

---

## 8. Approval record (do not fabricate)

Complete this section only when a real business approver signs off. Leave blank until then.

```yaml
approval_record:
  recorded: false                    # set true only when fully signed
  policy_version: null               # e.g. "1.0.0" — must match released gate version
  approver_name: null                # full name of authorizing person
  approver_role: null                # e.g. CFO, Production Director
  approval_date: null                # ISO-8601 date (YYYY-MM-DD)
  approved_decision_ids: []          # subset of:
                                    #   valuation_method
                                    #   good_output_denominator
                                    #   material_returns
                                    #   historical_transactions
                                    #   actual_cost_scope
                                    #   grn_missing_po_price: reject | manual_override
                                    #   denominator: <chosen option from §2.2>
  unresolved_rules_resolved: []      # must include both §2.1 and §2.2 entries when recorded: true
  notes: null                        # optional scope or effective date
```

**When `recorded: true`:**

1. Update document status at top to `APPROVED`.
2. Set API `costing_policy_status` to `approved` and set matching checklist items `approved: true` in code or config **in the same change** as this record.
3. Bump `policy_version` and reference it in `approval_record.policy_version`.
4. Only then begin migration + valuation implementation.

**Current state:** No approver, date, or `recorded: true` in repository — gate remains closed.

---

## 9. Related documents (next-phase preparation)

| Document | Purpose |
|----------|---------|
| [manufacturing_actual_cost_business_decisions.md](./manufacturing_actual_cost_business_decisions.md) | Concise pending decisions for GRN pricing and quantity reconciliation (proposals only). |
| [manufacturing_actual_cost_implementation_checklist.md](./manufacturing_actual_cost_implementation_checklist.md) | Future engineering checklist — **not** started while gate is pending. |
