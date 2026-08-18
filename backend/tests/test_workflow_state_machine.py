"""Tests for manufacturing workflow state machine."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.workflow_constants import transition_allowed, required_team_for_transition


def test_happy_path_transitions():
    assert transition_allowed("draft", "SALES_CONFIRMED")
    assert transition_allowed("SALES_CONFIRMED", "MATERIAL_CHECK_PENDING")
    assert transition_allowed("MATERIAL_CHECK_PENDING", "MATERIAL_AVAILABLE")
    assert transition_allowed("MATERIAL_AVAILABLE", "READY_FOR_PRODUCTION")
    assert transition_allowed("READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED")
    assert transition_allowed("PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS")
    assert transition_allowed("PRODUCTION_IN_PROGRESS", "PRODUCTION_COMPLETED")
    assert transition_allowed("PRODUCTION_COMPLETED", "QUALITY_CHECK_PENDING")
    assert transition_allowed("QUALITY_CHECK_PENDING", "QUALITY_APPROVED")
    assert transition_allowed("QUALITY_APPROVED", "PACKING_PENDING")
    assert transition_allowed("PACKING_PENDING", "PACKING_IN_PROGRESS")
    assert transition_allowed("PACKING_IN_PROGRESS", "PACKED")
    assert transition_allowed("PACKED", "BILLING_PENDING")
    assert transition_allowed("BILLING_PENDING", "INVOICED")
    assert transition_allowed("INVOICED", "COMPLETED")


def test_invalid_operator_to_invoiced_blocked():
    assert not transition_allowed("PRODUCTION_IN_PROGRESS", "INVOICED")
    assert not transition_allowed("QUALITY_CHECK_PENDING", "PACKED")
    assert not transition_allowed("PACKING_PENDING", "COMPLETED")


def test_team_requirements():
    assert required_team_for_transition("MATERIAL_CHECK_PENDING", "MATERIAL_AVAILABLE") == "inventory"
    assert required_team_for_transition("READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED") == "production"
    assert required_team_for_transition("PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS") == "operator"
    assert required_team_for_transition("QUALITY_CHECK_PENDING", "QUALITY_APPROVED") == "quality"
    assert required_team_for_transition("BILLING_PENDING", "INVOICED") == "billing"
