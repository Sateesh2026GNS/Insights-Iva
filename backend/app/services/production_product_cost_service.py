"""Manufacturing product cost dashboard — standard BOM material cost + production actuals."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_bom_structure import BomHeader
from app.models.production import ProductionOrder
from app.schemas.production_product_cost import (
    ProductCostChartPoint,
    ProductCostDashboardRead,
    ProductCostRowRead,
)
from app.services.bom import bom_service as bom_svc
from app.services.bom.bom_validation import product_is_finished_good

CANCELLED_PO = frozenset({"cancelled", "canceled"})

STANDARD_COST_DEFINITION = (
    "Standard unit cost = active BOM rolled material cost using landed material pricing "
    "(same rules as BOM module _cost_for_version). Labour, machine, overhead, and packaging "
    "are not modeled on BOM lines in this ERP version."
)
ACTUAL_COST_DEFINITION = (
    "Actual unit cost is not available: stock issues and production entries do not persist "
    "historical unit costs on movements. Production quantity is from production order actuals."
)

RECOMMENDED_COSTING_POLICY = (
    "Adopt transaction-time unit cost on stock_movements (OUT captures valuation at issue; "
    "IN from GRN/PO line landed cost) plus moving-average on inventory_items.unit_cost. "
    "Link production material OUT movements to work_order_id. Roll up issued material extended "
    "cost per FG product using good quantity (produced minus rejected/scrap) as denominator. "
    "Do not use current MaterialPricing or BOM standard cost as actual cost."
)

COSTING_POLICY_VERSION = "1.0.0-gate"

UNRESOLVED_POLICY_RULES = [
    {
        "id": "grn_missing_po_price",
        "title": "GRN unit cost when PO line price is missing",
        "options": [
            {
                "id": "reject",
                "label": "Reject stock posting until PO/procurement unit cost exists",
            },
            {
                "id": "manual_override",
                "label": "Allow authorized, audited manual override on receipt (never default to zero)",
            },
        ],
        "proposed_recommendation": "reject",
        "proposal_status": "pending_business_approval",
        "status": "unresolved",
        "doc": "backend/docs/manufacturing_actual_cost_business_decisions.md#decision-1--grn-unit-cost-when-po-line-price-is-missing",
    },
    {
        "id": "good_output_denominator_conflict",
        "title": "Authoritative good quantity when PO actual, daily reports, and production entries disagree",
        "options": [
            {"id": "production_order_actual", "label": "Production order actual_quantity (per product)"},
            {"id": "daily_production_reports", "label": "Daily reports (produced minus scrap)"},
            {"id": "production_entries", "label": "Shop-floor production entries (produced minus rejected)"},
            {"id": "hierarchy_with_discrepancy_flag", "label": "Hierarchy per WO; flag costing unavailable when sources disagree"},
        ],
        "proposed_recommendation": "hierarchy_with_discrepancy_flag",
        "proposal_status": "pending_business_approval",
        "status": "unresolved",
        "doc": "backend/docs/manufacturing_actual_cost_business_decisions.md#decision-2--good-output-quantity-and-source-reconciliation",
    },
]

# Template only — do not set recorded=True without real approver (see manufacturing_actual_cost_policy_gate.md §8).
APPROVAL_RECORD_PENDING = {
    "recorded": False,
    "policy_version": None,
    "approver_name": None,
    "approver_role": None,
    "approval_date": None,
    "approved_decision_ids": [],
    "unresolved_rules_resolved": [],
    "notes": None,
}

COSTING_POLICY_CHECKLIST = [
    {
        "id": "valuation_method",
        "label": "Valuation: moving-average at issue (recommended) vs FIFO",
        "recommended": "moving_average",
        "approved": False,
    },
    {
        "id": "good_output_denominator",
        "label": "Good-output denominator (PO actual vs daily report vs production entry)",
        "recommended": "production_order_actual_quantity_with_scrap_adjustment",
        "approved": False,
    },
    {
        "id": "material_returns",
        "label": "Returns: restore original issue cost vs current average",
        "recommended": "original_issue_cost",
        "approved": False,
    },
    {
        "id": "historical_transactions",
        "label": "Pre-migration movements: actual unavailable, no backfill",
        "recommended": "unavailable_no_backfill",
        "approved": False,
    },
    {
        "id": "actual_cost_scope",
        "label": "Actual scope: material-only until labour/machine/overhead sources exist",
        "recommended": "material_only",
        "approved": False,
    },
]

COSTING_DATA_GAPS = [
    "stock_movements has quantity only — no unit_cost, extended_cost, or work_order_id",
    "WO material issue (issue_materials_for_work_order) posts OUT without reference or cost snapshot",
    "GRN stock post (_post_grn_stock) does not persist receipt unit cost or update moving average",
    "valuation_rate() reads inventory_items.unit_cost (point-in-time master), not movement history",
    "MaterialPricing is vendor master data (latest landed), not tied to issue transactions",
    "No FIFO/cost-layer tables; reports/valuation.py documents FIFO as TODO",
    "WorkflowMaterialIssueLine tracks qty/status only — no cost fields",
]


def _d(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _margin(price: Decimal | None, cost: Decimal | None) -> tuple[Decimal | None, Decimal | None]:
    if price is None or cost is None or price <= 0:
        return None, None
    amount = price - cost
    pct = (amount / price) * Decimal("100")
    return amount, pct.quantize(Decimal("0.1"))


def _production_qty_by_product(db: Session, tenant_id: int) -> dict[int, float]:
    rows = db.execute(
        select(
            ProductionOrder.product_id,
            func.coalesce(func.sum(ProductionOrder.actual_quantity), 0),
        )
        .where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.product_id.isnot(None),
            ProductionOrder.status.notin_(tuple(CANCELLED_PO)),
        )
        .group_by(ProductionOrder.product_id)
    ).all()
    return {int(pid): float(qty or 0) for pid, qty in rows if pid}


def get_product_cost_dashboard(
    db: Session,
    tenant_id: int,
    *,
    include_cost: bool,
    limit: int = 100,
) -> ProductCostDashboardRead:
    limit = min(max(limit, 1), 100)
    qty_map = _production_qty_by_product(db, tenant_id)

    bom_product_ids = set(
        db.scalars(
            select(BomHeader.product_id).where(
                BomHeader.tenant_id == tenant_id,
                BomHeader.is_archived.is_(False),
            )
        ).all()
    )

    product_filter = [Product.category.ilike("%finished%")]
    if bom_product_ids:
        product_filter.append(Product.id.in_(bom_product_ids))
    products = list(
        db.scalars(
            select(Product)
            .where(
                Product.tenant_id == tenant_id,
                Product.status == "active",
                or_(*product_filter),
            )
            .order_by(Product.name.asc())
            .limit(limit)
        ).all()
    )

    rows: list[ProductCostRowRead] = []
    standard_costs: list[Decimal] = []
    margins: list[Decimal] = []
    profitable = 0
    total_prod_qty = 0.0
    material_sum = Decimal("0")
    material_count = 0

    for product in products:
        if not product_is_finished_good(product) and product.id not in bom_product_ids:
            continue
        cost_info = bom_svc.standard_unit_cost_for_product(
            db, tenant_id, product.id, include_cost=include_cost
        )
        has_bom = cost_info["has_active_bom"]
        incomplete = cost_info.get("cost_incomplete", True)
        if not has_bom:
            bom_status = "missing"
        elif incomplete:
            bom_status = "incomplete"
        else:
            bom_status = "active"

        material = _d(cost_info.get("material_cost")) if include_cost else None
        standard = _d(cost_info.get("standard_unit_cost")) if include_cost else None
        price = _d(product.unit_price)
        prod_qty = qty_map.get(product.id, 0.0)
        total_prod_qty += prod_qty

        margin_amt, margin_pct = _margin(price, standard) if include_cost else (None, None)
        if margin_amt is not None and margin_amt > 0:
            profitable += 1
        if standard is not None:
            standard_costs.append(standard)
        if margin_pct is not None:
            margins.append(margin_pct)
        if material is not None:
            material_sum += material
            material_count += 1

        rows.append(
            ProductCostRowRead(
                product_id=product.id,
                sku=product.sku or "",
                product_name=product.name,
                category=product.category or "",
                bom_status=bom_status,
                material_cost=material,
                labour_cost=None,
                machine_cost=None,
                overhead_cost=None,
                packaging_cost=None,
                other_cost=None,
                standard_unit_cost=standard,
                actual_unit_cost=None,
                actual_cost_status="unavailable",
                actual_cost_note=ACTUAL_COST_DEFINITION,
                production_quantity=prod_qty,
                selling_price=price if include_cost else None,
                cost_variance=None,
                gross_margin_amount=margin_amt,
                gross_margin_pct=margin_pct,
                margin_basis="standard" if margin_amt is not None else None,
            )
        )

    avg_standard = (
        (sum(standard_costs) / Decimal(len(standard_costs))).quantize(Decimal("0.01"))
        if standard_costs
        else None
    )
    avg_margin = (
        (sum(margins) / Decimal(len(margins))).quantize(Decimal("0.1")) if margins else None
    )
    avg_material = (
        (material_sum / Decimal(material_count)).quantize(Decimal("0.01"))
        if material_count
        else None
    )

    with_standard = [r for r in rows if r.standard_unit_cost is not None]
    chart_std_price = [
        ProductCostChartPoint(
            name=(r.sku or r.product_name)[:12],
            standard=float(r.standard_unit_cost) if r.standard_unit_cost else None,
            actual=None,
            value=float(r.selling_price) if r.selling_price else None,
        )
        for r in with_standard[:12]
    ]

    by_cat: dict[str, float] = {}
    for r in with_standard:
        cat = r.category or "Other"
        by_cat[cat] = by_cat.get(cat, 0.0) + float(r.standard_unit_cost or 0)
    chart_cat = [
        ProductCostChartPoint(name=k[:14], value=round(v / max(1, sum(1 for x in rows if x.category == k)), 2))
        for k, v in sorted(by_cat.items(), key=lambda x: -x[1])[:8]
    ]
    top_cost = sorted(with_standard, key=lambda r: float(r.standard_unit_cost or 0), reverse=True)[:8]
    chart_top = [
        ProductCostChartPoint(name=(r.sku or r.product_name)[:12], value=float(r.standard_unit_cost))
        for r in top_cost
    ]

    breakdown_avg = []
    if avg_material is not None and include_cost:
        breakdown_avg = [{"name": "Raw Material (BOM)", "value": float(avg_material)}]

    missing_bom = sum(1 for r in rows if r.bom_status == "missing")
    incomplete_bom = sum(1 for r in rows if r.bom_status == "incomplete")
    missing_price = sum(1 for r in rows if r.bom_status == "active" and r.standard_unit_cost is None)

    insights: list[str] = []
    if not rows:
        insights.append("No finished goods or BOM products found for this tenant.")
    else:
        if include_cost:
            insights.append(
                f"{len(with_standard)} product(s) with complete standard BOM material cost "
                f"(margin basis: standard)."
            )
        if missing_bom:
            insights.append(f"{missing_bom} product(s) without an active BOM — standard cost unavailable.")
        if incomplete_bom or missing_price:
            insights.append(
                f"{incomplete_bom + missing_price} product(s) with incomplete BOM pricing "
                "(missing material landed costs)."
            )
        insights.append(ACTUAL_COST_DEFINITION)

    actions: list[str] = []
    if missing_bom:
        actions.append("Create and activate BOMs for finished goods missing standard cost.")
    if incomplete_bom:
        actions.append("Complete material pricing for all BOM components in Inventory / Procurement.")
    if include_cost:
        actions.append("Maintain product master selling prices (unit_price) for margin analysis.")
    actions.append("Review BOM module for authoritative standard cost updates.")

    kpis = [
        {
            "key": "total_products",
            "label": "Products (Costing Scope)",
            "value": str(len(rows)),
            "unit": "SKUs",
        },
        {
            "key": "avg_standard",
            "label": "Avg Standard Unit Cost",
            "value": str(avg_standard) if include_cost and avg_standard is not None else "—",
            "unit": "INR",
        },
        {
            "key": "avg_actual",
            "label": "Avg Actual Unit Cost",
            "value": "—",
            "unit": "N/A",
        },
        {
            "key": "prod_qty",
            "label": "Total Production Qty",
            "value": f"{total_prod_qty:,.0f}".replace(",", ","),
            "unit": "Units",
        },
        {
            "key": "variance",
            "label": "Total Cost Variance",
            "value": "—",
            "unit": "N/A",
        },
        {
            "key": "avg_margin",
            "label": "Average Margin",
            "value": str(avg_margin) if include_cost and avg_margin is not None else "—",
            "unit": "%",
        },
        {
            "key": "profitable",
            "label": "Profitable Products",
            "value": f"{profitable} / {len(rows)}" if include_cost and rows else "—",
            "unit": "Std margin",
        },
    ]

    return ProductCostDashboardRead(
        cost_visible=include_cost,
        margin_basis="standard",
        actual_cost_readiness="blocked",
        costing_policy_status="pending_approval",
        costing_policy_version=COSTING_POLICY_VERSION,
        costing_policy_checklist=COSTING_POLICY_CHECKLIST,
        unresolved_policy_rules=UNRESOLVED_POLICY_RULES,
        approval_record=APPROVAL_RECORD_PENDING,
        recommended_costing_policy=RECOMMENDED_COSTING_POLICY,
        costing_data_gaps=COSTING_DATA_GAPS,
        standard_cost_definition=STANDARD_COST_DEFINITION,
        actual_cost_definition=ACTUAL_COST_DEFINITION,
        kpis=kpis,
        rows=rows,
        cost_breakdown_avg=breakdown_avg,
        chart_standard_vs_price=chart_std_price,
        chart_by_category=chart_cat,
        chart_top_unit_cost=chart_top,
        insights=insights,
        actions=actions,
    )
