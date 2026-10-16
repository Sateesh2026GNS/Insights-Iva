from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCostRowRead(BaseModel):
    product_id: int
    sku: str = ""
    product_name: str
    category: str = ""
    bom_status: str = Field(description="active | incomplete | missing")
    material_cost: Decimal | None = None
    labour_cost: Decimal | None = None
    machine_cost: Decimal | None = None
    overhead_cost: Decimal | None = None
    packaging_cost: Decimal | None = None
    other_cost: Decimal | None = None
    standard_unit_cost: Decimal | None = None
    actual_unit_cost: Decimal | None = None
    actual_cost_status: str = Field(
        default="unavailable",
        description="unavailable | partial | available — see actual_cost_note",
    )
    actual_cost_note: str | None = None
    production_quantity: float = Field(0, ge=0)
    selling_price: Decimal | None = None
    cost_variance: Decimal | None = None
    gross_margin_amount: Decimal | None = None
    gross_margin_pct: Decimal | None = None
    margin_basis: str | None = Field(None, description="standard when margin is computed")


class ProductCostChartPoint(BaseModel):
    name: str
    standard: float | None = None
    actual: float | None = None
    value: float | None = None


class ProductCostDashboardRead(BaseModel):
    cost_visible: bool = True
    margin_basis: str = "standard"
    actual_cost_readiness: str = Field(
        default="blocked",
        description="blocked | partial | ready — whether persisted actual costing is implemented",
    )
    costing_policy_status: str = Field(
        default="pending_approval",
        description="pending_approval | approved — business sign-off for valuation and denominator rules",
    )
    costing_policy_checklist: list[dict] = Field(
        default_factory=list,
        description="Approval items; see backend/docs/manufacturing_actual_cost_policy_gate.md",
    )
    costing_policy_version: str = Field(
        default="1.0.0-gate",
        description="Gate document version; bump when policy is approved",
    )
    unresolved_policy_rules: list[dict] = Field(
        default_factory=list,
        description="Business decisions still open; see policy gate doc §2",
    )
    approval_record: dict = Field(
        default_factory=dict,
        description="Empty until business sign-off; see policy gate doc §8",
    )
    recommended_costing_policy: str = ""
    costing_data_gaps: list[str] = Field(default_factory=list)
    standard_cost_definition: str
    actual_cost_definition: str
    kpis: list[dict]
    rows: list[ProductCostRowRead]
    cost_breakdown_avg: list[dict] = Field(default_factory=list)
    chart_standard_vs_price: list[ProductCostChartPoint] = Field(default_factory=list)
    chart_by_category: list[ProductCostChartPoint] = Field(default_factory=list)
    chart_top_unit_cost: list[ProductCostChartPoint] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
