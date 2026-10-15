"""BOM quantity math (Decimal-safe)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

QTY_PLACES = Decimal("0.0001")


def D(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def gross_component_quantity(
    line_quantity: Decimal,
    scrap_percent: Decimal,
) -> Decimal:
    """Gross per base quantity: qty * (1 + scrap/100)."""
    factor = Decimal("1") + (scrap_percent / Decimal("100"))
    return (line_quantity * factor).quantize(QTY_PLACES, rounding=ROUND_HALF_UP)


def required_for_order_quantity(
    order_quantity: Decimal,
    base_quantity: Decimal,
    line_quantity: Decimal,
    scrap_percent: Decimal,
) -> Decimal:
    """required = order_qty / base_qty * line_qty * (1 + scrap/100)."""
    if base_quantity <= 0:
        raise ValueError("Base quantity must be greater than zero.")
    scale = order_quantity / base_quantity
    net = line_quantity * scale
    return gross_component_quantity(net, scrap_percent)
