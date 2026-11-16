"""Operator page allowlist packaging: Docker-safe load + fail-closed."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core import operator_allowlist as allowlist_mod
from app.core.operator_allowlist import (
    _PACKAGED_PAGE_FILE,
    _MONOREPO_PAGE_FILE,
    load_operator_page_allowlist,
    operator_page_allowlist_candidates,
    operator_page_allowed,
    resolve_operator_page_allowlist_path,
)


def test_packaged_allowlist_file_exists_beside_module():
    assert _PACKAGED_PAGE_FILE.is_file(), (
        "Packaged operator_page_allowlist.json must ship with the backend image"
    )
    assert _PACKAGED_PAGE_FILE.parent == Path(allowlist_mod.__file__).resolve().parent


def test_resolve_prefers_packaged_path_for_docker():
    resolved = resolve_operator_page_allowlist_path()
    assert resolved == _PACKAGED_PAGE_FILE
    assert operator_page_allowlist_candidates()[0] == _PACKAGED_PAGE_FILE


def test_load_operator_page_allowlist_from_packaged_file():
    loaded = load_operator_page_allowlist(_PACKAGED_PAGE_FILE)
    assert "/dashboard" in loaded["exact"]
    assert "/my-job-cards/" in loaded["prefixes"]
    assert loaded["patterns"]
    assert operator_page_allowed("/dashboard") is True
    assert operator_page_allowed("/inventory") is False


def test_packaged_allowlist_matches_frontend_source_of_truth():
    """Keep backend package and frontend JSON identical (single allowlist)."""
    assert _MONOREPO_PAGE_FILE.is_file(), "frontend allowlist missing in monorepo checkout"
    packaged = json.loads(_PACKAGED_PAGE_FILE.read_text(encoding="utf-8"))
    frontend = json.loads(_MONOREPO_PAGE_FILE.read_text(encoding="utf-8"))
    assert packaged == frontend


def test_load_fail_closed_when_file_missing(tmp_path):
    missing = tmp_path / "missing-allowlist.json"
    with pytest.raises(FileNotFoundError, match="fail-closed"):
        load_operator_page_allowlist(missing)


def test_resolve_fail_closed_when_no_candidates(monkeypatch, tmp_path):
    missing_packaged = tmp_path / "operator_page_allowlist.json"
    missing_frontend = tmp_path / "operatorPageAllowlist.json"
    monkeypatch.setattr(allowlist_mod, "_PACKAGED_PAGE_FILE", missing_packaged)
    monkeypatch.setattr(allowlist_mod, "_MONOREPO_PAGE_FILE", missing_frontend)
    with pytest.raises(FileNotFoundError, match="fail-closed"):
        resolve_operator_page_allowlist_path()
