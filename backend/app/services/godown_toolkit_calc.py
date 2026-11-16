"""Pure godown toolkit calculations. No sample business records."""

from __future__ import annotations

import math
from decimal import Decimal

MASS_TO_KG = {
    "kg": 1.0,
    "kgs": 1.0,
    "kilogram": 1.0,
    "kilograms": 1.0,
    "g": 0.001,
    "gram": 0.001,
    "grams": 0.001,
    "quintal": 100.0,
    "qtl": 100.0,
    "tonne": 1000.0,
    "tonnes": 1000.0,
    "ton": 1000.0,
    "mt": 1000.0,
}

# 1 cubic foot = 28.316846592 litres. Volume-to-volume only.
LITRES_PER_CFT = 28.316846592
VOLUME_TO_CFT = {
    "cft": 1.0,
    "cuft": 1.0,
    "cubic foot": 1.0,
    "cubic feet": 1.0,
    "l": 1.0 / LITRES_PER_CFT,
    "ltr": 1.0 / LITRES_PER_CFT,
    "litre": 1.0 / LITRES_PER_CFT,
    "litres": 1.0 / LITRES_PER_CFT,
    "liter": 1.0 / LITRES_PER_CFT,
    "liters": 1.0 / LITRES_PER_CFT,
    "ml": 0.001 / LITRES_PER_CFT,
}

LOSS_REASONS = ("damage", "shrinkage", "loss", "scrap")

GATE_PASS_TRANSITIONS = {
    "draft": {"issued", "cancelled"},
    "issued": {"exited", "cancelled"},
    "exited": set(),
    "cancelled": set(),
}

QUOTE_TRANSITIONS = {
    "draft": {"sent", "cancelled"},
    "sent": {"accepted", "cancelled"},
    "accepted": set(),
    "cancelled": set(),
}

VALUATION_BLOCK_REASON = (
    "Stock valuation is unavailable. The valuation method "
    "(moving average versus FIFO) is not approved, and stock movements do not store a unit cost."
)


def _unit_key(unit: str | None) -> str:
    return " ".join(str(unit or "").strip().lower().split())


def money(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01")))


def convert_quantity(
    quantity: float,
    from_unit: str,
    to_unit: str,
    *,
    weight_kg_per_unit: float | None = None,
    volume_cft_per_unit: float | None = None,
) -> dict:
    if quantity < 0:
        return {"ok": False, "value": None, "reason": "Quantity cannot be negative."}
    source = _unit_key(from_unit)
    target = _unit_key(to_unit)
    if not source or not target:
        return {"ok": False, "value": None, "reason": "Both units are required."}
    if source == target:
        return {"ok": True, "value": quantity, "reason": None, "rule": "same unit"}

    source_mass = MASS_TO_KG.get(source)
    target_mass = MASS_TO_KG.get(target)
    source_volume = VOLUME_TO_CFT.get(source)
    target_volume = VOLUME_TO_CFT.get(target)

    if source_mass is not None and target_mass is not None:
        value = quantity * source_mass / target_mass
        return {"ok": True, "value": value, "reason": None, "rule": "mass"}
    if source_volume is not None and target_volume is not None:
        value = quantity * source_volume / target_volume
        return {"ok": True, "value": value, "reason": None, "rule": "volume"}

    if source_mass is not None and target_volume is not None:
        return {
            "ok": False,
            "value": None,
            "reason": "Mass and volume are not interchangeable without an item density, and none is configured.",
        }
    if source_volume is not None and target_mass is not None:
        return {
            "ok": False,
            "value": None,
            "reason": "Volume and mass are not interchangeable without an item density, and none is configured.",
        }

    if weight_kg_per_unit and weight_kg_per_unit > 0 and target_mass is not None and source_mass is None and source_volume is None:
        kg = quantity * weight_kg_per_unit
        return {"ok": True, "value": kg / target_mass, "reason": None, "rule": "item weight"}
    if weight_kg_per_unit and weight_kg_per_unit > 0 and source_mass is not None and target_mass is None and target_volume is None:
        kg = quantity * source_mass
        return {"ok": True, "value": kg / weight_kg_per_unit, "reason": None, "rule": "item weight"}

    if volume_cft_per_unit and volume_cft_per_unit > 0 and target_volume is not None and source_volume is None and source_mass is None:
        cft = quantity * volume_cft_per_unit
        return {"ok": True, "value": cft / target_volume, "reason": None, "rule": "item volume"}
    if volume_cft_per_unit and volume_cft_per_unit > 0 and source_volume is not None and target_volume is None and target_mass is None:
        cft = quantity * source_volume
        return {"ok": True, "value": cft / volume_cft_per_unit, "reason": None, "rule": "item volume"}

    return {
        "ok": False,
        "value": None,
        "reason": "No conversion rule is configured between these units.",
    }


def compute_eoq(annual_demand: float, order_cost: float, holding_cost_per_unit: float) -> float:
    if annual_demand <= 0 or order_cost <= 0 or holding_cost_per_unit <= 0:
        raise ValueError("Annual demand, order cost, and holding cost per unit must be greater than zero.")
    return math.sqrt((2 * annual_demand * order_cost) / holding_cost_per_unit)


def quote_totals(
    lines: list[dict],
    extra_amounts: list[float],
    discount: float,
    tax_pct: float | None,
) -> dict:
    if discount < 0:
        raise ValueError("Discount cannot be negative.")
    subtotal = 0.0
    for line in lines:
        qty = float(line["quantity"])
        rate = float(line["rate"])
        if qty <= 0 or rate < 0:
            raise ValueError("Each line needs a positive quantity and a rate that is zero or more.")
        subtotal += qty * rate
    for amount in extra_amounts:
        if amount < 0:
            raise ValueError("Extra charges cannot be negative.")
        subtotal += amount
    subtotal = money(subtotal)
    if discount > subtotal:
        raise ValueError("Discount cannot be more than the subtotal.")
    after_discount = money(subtotal - discount)
    if tax_pct is None:
        return {
            "subtotal": subtotal,
            "discount": money(discount),
            "taxable": after_discount,
            "tax_pct": None,
            "tax_amount": None,
            "total": after_discount,
            "tax_status": "not_configured",
        }
    if tax_pct < 0:
        raise ValueError("Tax percent cannot be negative.")
    tax_amount = money(after_discount * tax_pct / 100)
    return {
        "subtotal": subtotal,
        "discount": money(discount),
        "taxable": after_discount,
        "tax_pct": tax_pct,
        "tax_amount": tax_amount,
        "total": money(after_discount + tax_amount),
        "tax_status": "calculated",
    }


def capacity_utilization(capacity: int | None, used: int | None) -> float | None:
    if capacity is None or capacity <= 0 or used is None:
        return None
    if used < 0:
        return None
    return round(used / capacity * 100, 1)
