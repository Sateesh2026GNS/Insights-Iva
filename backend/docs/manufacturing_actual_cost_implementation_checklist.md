# Manufacturing Actual Material Cost — Implementation Checklist (Future)

**Prerequisites:** [Policy gate](./manufacturing_actual_cost_policy_gate.md) status `APPROVED`, §8 approval record complete, [business decisions](./manufacturing_actual_cost_business_decisions.md) resolved.

**Do not start this checklist while `costing_policy_status` is `pending_approval`.**

---

## Phase 0 — Engineering prep (no production DB)

- [ ] Re-read Alembic head; draft migration (not applied to production).
- [ ] Audit every `record_stock_movement` and GRN call site.
- [ ] Confirm RBAC roles for any manual GRN cost override (if Option B approved).

## Phase 1 — Schema (nullable historical cost)

- [ ] Alembic: add to `stock_movements` (nullable only):
  - `unit_cost` Numeric(14,4)
  - `extended_cost` Numeric(16,4)
  - `work_order_id` FK → `work_orders.id` (nullable, indexed, tenant-safe)
- [ ] SQLAlchemy model + `StockMovementCreate` optional fields (backward compatible).
- [ ] **Existing rows:** leave cost columns NULL — no backfill.

## Phase 2 — GRN / moving average (after approved GRN price rule)

- [ ] Resolve unit cost from approved source (PO line / landed cost).
- [ ] Exclude rejected qty from accepted IN (existing rule).
- [ ] Update moving average on `inventory_items.unit_cost` per approved formula.
- [ ] Persist `unit_cost` / `extended_cost` on IN movement.
- [ ] Apply Option A or B from business decisions for missing PO price.

## Phase 3 — Production material issue

- [ ] On WO issue OUT: lock stock (`FOR UPDATE` — existing path).
- [ ] Snapshot `valuation_rate(item)` at issue time on movement.
- [ ] Set `work_order_id`, `extended_cost`, structured `reference`.
- [ ] Atomic with quantity deduction; idempotent duplicate handling per existing WO flags.

## Phase 4 — Returns and reversals

- [ ] Material return IN: restore **original issue unit cost** when linked to source movement/WO (if approved).
- [ ] GRN reversal: OUT at traced original IN cost or block if untraceable.

## Phase 5 — Actual material cost (dashboard API)

- [ ] Roll up WO-linked OUT (+/- returns) per FG product.
- [ ] Apply **approved** denominator and discrepancy rules; flag conflicts — no silent pick.
- [ ] `actual_unit_cost` only when material cost complete and good qty > 0.
- [ ] Variance vs standard only when same material scope and both complete.
- [ ] Labour, machine, overhead, packaging: remain **unavailable** (null + reason).
- [ ] Set `actual_cost_readiness` `partial` / `ready` per tenant/product data — not before movements carry cost.

## Phase 6 — Tests (disposable PostgreSQL only)

- [ ] GRN weighted average; reject qty excluded.
- [ ] Issue snapshot after price change.
- [ ] Partial issues, returns, reversals, concurrency, insufficient stock.
- [ ] Tenant isolation, WO isolation, `user_can_view_bom_cost` RBAC.
- [ ] Historical NULL → actual unavailable.
- [ ] Quantity disagreement → unavailable + flag.
- [ ] Regression: inventory, BOM, `test_production_product_cost_api.py`.

## Phase 7 — Release

- [ ] Run full migration on staging/disposable DB only.
- [ ] Document policy version bump in gate doc and API `costing_policy_version`.
- [ ] **Never** run migrations against production until operator runbook signed.

---

## Explicit non-goals

- No FIFO unless separately approved.
- No backfill of historical movement costs.
- No fabricated labour/machine/overhead on actual cost.
- No change to approval gate fields until business §8 is real.
