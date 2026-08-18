import pytest
from pydantic import ValidationError

from app.schemas.task import TaskBase, TaskCreate, TaskUpdate


def test_task_create_valid_positive_ids():
    task = TaskCreate(
        title="Check machinery",
        tenant_id=1,
        assigned_to=42,
    )
    assert task.tenant_id == 1
    assert task.assigned_to == 42


def test_task_create_empty_string_normalized_to_none():
    task = TaskCreate(
        title="Check machinery",
        tenant_id="",
        assigned_to="",
        due_date="",
        start_date=None,
    )
    assert task.tenant_id is None
    assert task.assigned_to is None
    assert task.due_date is None
    assert task.start_date is None


def test_task_create_string_null_rejected_for_date():
    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", due_date="null")
    assert any(err["loc"] == ("due_date",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", start_date="null")
    assert any(err["loc"] == ("start_date",) for err in exc_info.value.errors())


def test_task_create_string_null_rejected_for_int():
    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", assigned_to="null")
    assert any(err["loc"] == ("assigned_to",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", tenant_id="null")
    assert any(err["loc"] == ("tenant_id",) for err in exc_info.value.errors())


def test_task_create_zero_assigned_to_rejected():
    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", assigned_to=0)
    assert any(err["loc"] == ("assigned_to",) for err in exc_info.value.errors())


def test_task_create_zero_tenant_id_rejected():
    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", tenant_id=0)
    assert any(err["loc"] == ("tenant_id",) for err in exc_info.value.errors())


def test_task_create_negative_id_rejected():
    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", assigned_to=-5)
    assert any(err["loc"] == ("assigned_to",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="Check machinery", tenant_id=-1)
    assert any(err["loc"] == ("tenant_id",) for err in exc_info.value.errors())


def test_task_update_zero_assigned_to_rejected():
    with pytest.raises(ValidationError) as exc_info:
        TaskUpdate(assigned_to=0)
    assert any(err["loc"] == ("assigned_to",) for err in exc_info.value.errors())


def test_task_update_string_null_rejected():
    with pytest.raises(ValidationError) as exc_info:
        TaskUpdate(due_date="null")
    assert any(err["loc"] == ("due_date",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        TaskUpdate(assigned_to="null")
    assert any(err["loc"] == ("assigned_to",) for err in exc_info.value.errors())


def test_task_update_valid_assigned_to():
    update = TaskUpdate(assigned_to=10)
    assert update.assigned_to == 10

    update_none = TaskUpdate(assigned_to="")
    assert update_none.assigned_to is None
