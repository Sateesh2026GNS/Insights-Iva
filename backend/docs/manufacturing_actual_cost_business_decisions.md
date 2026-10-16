# Manufacturing Actual Material Cost — Business Decisions (Pending)

| | |
|--|--|
| **Policy version** | `1.0.0-gate` (unchanged until formal approval) |
| **Status** | **PROPOSED — pending business approval** |
| **Parent gate** | [manufacturing_actual_cost_policy_gate.md](./manufacturing_actual_cost_policy_gate.md) |
| **Implementation** | **Blocked** — no valuation or migration until §8 approval record is completed |

Nothing in this document constitutes approval. Engineering must not implement costing behavior based on proposals alone.

---

## Decision 1 — GRN unit cost when PO line price is missing

**Context:** Accepted GRN quantities post to `stock_movements` with quantity only today. Future moving-average valuation requires a receipt unit cost per line.

| Option | Description |
|--------|-------------|
| **A — Reject posting** | Do not post stock IN for a GRN line until a valid PO/procurement unit cost exists for that item. Operationally strict; prevents silent zero-cost inventory. |
| **B — Authorized manual override** | Allow a role-governed override unit cost on receipt (audit log: user, reason, optional reference). Never default missing price to zero. |

### Proposed recommendation (not approved)

**Prefer Option A (reject posting)** for initial rollout to maximize cost integrity; add Option B only if operations require it, with explicit RBAC (e.g. Admin / Accountant) and mandatory audit fields.

**Record in approval gate when decided:** `grn_missing_po_price: reject` or `grn_missing_po_price: manual_override`

| Approved choice | ☐ A  ☐ B |
|-----------------|--------|
| Sign-off | |

---

## Decision 2 — Good output quantity and source reconciliation

**Context:** Actual material unit cost = material cost ÷ **good output quantity**. Multiple quantity sources can disagree.

| Source | Data |
|--------|------|
| Production order | `actual_quantity` (rolled from WOs) |
| Daily production report | `produced_quantity`, `scrap_quantity` |
| Production entry | `quantity_produced`, `quantity_rejected` |

### Proposed reconciliation policy (not approved)

1. **Primary rule (when approved):** Use a documented **hierarchy** per work order, e.g.  
   - If WO has production entries → good qty = Σ(`quantity_produced − quantity_rejected`)  
   - Else if WO has daily reports → good qty = Σ(`produced_quantity − scrap_quantity`)  
   - Else → use PO `actual_quantity` allocated to that WO (or PO-level sum only if no WO split).

2. **Discrepancy handling (recommended):** When two populated sources differ beyond a configured tolerance (e.g. 0 or 1% — **business to set**):
   - **Do not** silently pick one for costing.
   - Set `actual_cost_status: unavailable` for that product/WO with reason `quantity_sources_disagree`.
   - Surface a data-quality flag on the product-cost dashboard (insights/actions).
   - Require planner/QC correction before actual cost is computed.

3. **Scrap/reject:** Subtract only from the **same authoritative source** used for good qty (do not mix PO actual with entry-level reject without explicit rule).

### Options for single authoritative source (alternative to hierarchy)

| Option | Use when |
|--------|----------|
| PO actual only | Simplest reporting; weakest shop-floor alignment |
| Daily reports only | Operations trusts daily QC reporting |
| Production entries only | Shop-floor is system of record |
| Hierarchy (proposed above) | Balance coverage and traceability |

### Proposed recommendation (not approved)

**Prefer hierarchy + discrepancy flagging** over a single global source, so costing never hides quantity conflicts.

**Record in approval gate when decided:** e.g. `denominator: hierarchy_with_discrepancy_flag` plus tolerance if applicable.

| Approved choice | ☐ PO only  ☐ Daily  ☐ Entries  ☐ Hierarchy + flags |
|-----------------|-----------------------------------------------------|
| Sign-off | |

---

## Approval linkage

When business approves, update **only** [manufacturing_actual_cost_policy_gate.md](./manufacturing_actual_cost_policy_gate.md) §8 and the API `approval_record` / checklist in the **same change** — never pre-approve in code without a real approver.
