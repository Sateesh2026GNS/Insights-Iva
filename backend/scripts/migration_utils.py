"""Shared helpers for SQLite → PostgreSQL data migration."""

from __future__ import annotations

# Legacy HR archive tables present in old SQLite DBs but excluded from active schema.
LEGACY_HR_TABLES: frozenset[str] = frozenset(
    {
        "employees",
        "leave_requests",
        "shifts",
        "attendance_records",
        "payroll_records",
        "performance_reviews",
        "hr_assets",
        "safety_incidents",
        "job_openings",
        "recruitment_applicants",
        "training_programs",
        "training_enrollments",
    }
)


def active_schema_table_names() -> list[str]:
    """Return active ORM table names in FK-safe dependency order."""
    import app.models  # noqa: F401 — register models
    from app.models.base import Base

    return [table.name for table in Base.metadata.sorted_tables]


def tables_to_migrate(source_table_names: set[str]) -> list[str]:
    """Active-schema tables that also exist in the SQLite source."""
    ordered = active_schema_table_names()
    return [name for name in ordered if name in source_table_names and name not in LEGACY_HR_TABLES]


def primary_key_columns(insp, table_name: str) -> list[str]:
    """Return primary-key column names for a table (empty if none)."""
    pk = insp.get_pk_constraint(table_name) or {}
    return list(pk.get("constrained_columns") or [])


def row_primary_key(row: dict, pk_columns: list[str]):
    """Extract the primary-key value(s) from a row dict."""
    if not pk_columns:
        return None
    if len(pk_columns) == 1:
        return row.get(pk_columns[0])
    return tuple(row.get(col) for col in pk_columns)


def fetch_existing_primary_keys(conn, table_name: str, pk_columns: list[str]) -> set:
    """Load primary keys already present in the target table."""
    if not pk_columns:
        return set()
    quoted = ", ".join(f'"{col}"' for col in pk_columns)
    sql = f'SELECT {quoted} FROM "{table_name}"'
    from sqlalchemy import text

    rows = conn.execute(text(sql)).all()
    if len(pk_columns) == 1:
        return {row[0] for row in rows}
    return {tuple(row) for row in rows}


def unique_constraint_columns(insp, table_name: str) -> list[list[str]]:
    """Return non-PK unique constraint column groups for a table."""
    groups: list[list[str]] = []
    for constraint in insp.get_unique_constraints(table_name) or []:
        columns = list(constraint.get("column_names") or [])
        if columns:
            groups.append(columns)
    return groups


def fetch_existing_unique_keys(conn, table_name: str, columns: list[str]) -> set:
    """Load composite unique-key tuples already present in the target table."""
    if not columns:
        return set()
    quoted = ", ".join(f'"{col}"' for col in columns)
    from sqlalchemy import text

    rows = conn.execute(text(f'SELECT {quoted} FROM "{table_name}"')).all()
    if len(columns) == 1:
        return {row[0] for row in rows}
    return {tuple(row) for row in rows}


def row_unique_key(row: dict, columns: list[str]):
    if len(columns) == 1:
        return row.get(columns[0])
    return tuple(row.get(col) for col in columns)


def row_should_skip(
    row: dict,
    *,
    pk_columns: list[str],
    existing_pks: set,
    unique_groups: list[list[str]],
    existing_unique: dict[tuple[str, ...], set],
) -> bool:
    """True when the row already exists by primary key or unique constraint."""
    pk_value = row_primary_key(row, pk_columns)
    if pk_columns and pk_value in existing_pks:
        return True
    for columns in unique_groups:
        key = row_unique_key(row, columns)
        existing = existing_unique.get(tuple(columns), set())
        if key in existing:
            return True
    return False


def missing_foreign_key_parents(
    conn,
    insp,
    table_name: str,
    row: dict,
    *,
    parent_pk_cache: dict[str, set],
) -> list[str]:
    """Return referred tables missing for this row's foreign keys (empty if valid)."""
    missing: list[str] = []
    for fk in insp.get_foreign_keys(table_name) or []:
        constrained = fk.get("constrained_columns") or []
        referred = fk.get("referred_table")
        referred_cols = fk.get("referred_columns") or []
        if not referred or not constrained or not referred_cols:
            continue
        fk_values = [row.get(col) for col in constrained]
        if any(value is None for value in fk_values):
            continue
        if referred not in parent_pk_cache:
            parent_pk_cols = primary_key_columns(insp, referred)
            parent_pk_cache[referred] = fetch_existing_primary_keys(conn, referred, parent_pk_cols)
        parent_keys = parent_pk_cache[referred]
        if len(referred_cols) == 1:
            parent_key = fk_values[0]
        else:
            parent_key = tuple(fk_values)
        if parent_key not in parent_keys:
            missing.append(referred)
    return missing


def filter_row_for_target(row: dict, target_column_names: set[str]) -> dict:
    """Keep only columns that exist on the PostgreSQL table."""
    return {key: value for key, value in row.items() if key in target_column_names}


_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def is_bcrypt_hash(value: str | None) -> bool:
    """True when value looks like a bcrypt password hash."""
    if not value or not isinstance(value, str):
        return False
    s = value.strip()
    return s.startswith(_BCRYPT_PREFIXES) and len(s) >= 60


def normalize_user_password_for_migration(hashed_password: str | None) -> str | None:
    """
    Preserve bcrypt hashes from SQLite; hash plaintext legacy values before PostgreSQL insert.
    Never copy plaintext passwords into PostgreSQL.
    """
    if hashed_password is None:
        return None
    s = str(hashed_password).strip()
    if not s:
        return None
    if is_bcrypt_hash(s):
        return s
    from app.services.auth_service import hash_password

    return hash_password(s)
