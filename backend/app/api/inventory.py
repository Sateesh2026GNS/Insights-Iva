from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_any_permission, require_permission, tenant_scope, tenant_scope_any
from app.models.user import User
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
    StockLevelCreate,
    StockLevelRead,
    StockMovementCreate,
    StockMovementRead,
    SupplierCreate,
    SupplierRead,
    WarehouseCreate,
    WarehouseRead,
)
from app.schemas.warehouse import (
    WarehouseCreateExtended,
    WarehouseDetailRead,
    WarehouseListRead,
    WarehouseSummaryRead,
    WarehouseUpdate,
)
from app.services.warehouse_service import (
    create_warehouse_extended,
    deactivate_warehouse,
    get_warehouse_detail,
    get_warehouse_summary,
    list_warehouses_enriched,
    update_warehouse,
)
from app.services.inventory_service import (
    create_inventory_item,
    create_stock_level,
    create_supplier,
    create_warehouse,
    delete_inventory_item,
    get_inventory_dashboard,
    get_inventory_item,
    get_item_by_barcode,
    get_stock_by_item,
    get_total_stock,
    list_inventory_items,
    list_stock_levels_by_warehouse,
    list_suppliers,
    list_warehouses,
    record_stock_movement,
    update_inventory_item,
    update_stock_level,
)
from app.schemas.inventory_extended import (
    FinishedGoodListRead,
    InventoryHubRead,
    InventorySummaryRead,
    LedgerEntryRead,
    LedgerSummaryRead,
    MaterialDetailRead,
    MaterialListRead,
    StockAdjustmentCreate,
    StockAdjustmentRead,
    StockAdjustmentStatusUpdate,
    StockTransferCreate,
    StockTransferRead,
    StockTransferStatusUpdate,
    StockReturnCreate,
    StockReturnRead,
    StockReturnStatusUpdate,
    StockReturnSummaryRead,
    StockReturnUpdate,
    StockInCreate,
    StockInRead,
    StockInStatusUpdate,
    StockInSummaryRead,
    StockInUpdate,
)
from app.services.inventory_extended_service import (
    create_adjustment,
    update_adjustment_status,
    create_transfer,
    update_transfer_status,
    get_finished_goods_summary,
    get_inventory_hub,
    get_ledger_summary,
    get_material_detail,
    get_materials_summary,
    list_adjustments,
    list_finished_goods_enriched,
    list_ledger_entries,
    list_materials_enriched,
    list_transfers,
)
from app.services.stock_return_service import (
    create_stock_return as create_stock_return_doc,
    get_item_available_for_return,
    get_stock_return,
    list_stock_returns,
    update_stock_return,
    update_stock_return_status,
)
from app.services.stock_in_service import (
    create_stock_in as create_stock_in_doc,
    get_stock_in,
    list_stock_ins,
    update_stock_in,
    update_stock_in_status,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])

MODULE = "inventory"


@router.post("/warehouses", response_model=WarehouseRead)
def create_warehouse_endpoint(
    payload: WarehouseCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> WarehouseRead:
    payload.tenant_id = user.tenant_id
    return create_warehouse(db, payload)


@router.post("/warehouses/full", response_model=WarehouseListRead)
def create_warehouse_full_endpoint(
    payload: WarehouseCreateExtended,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> WarehouseListRead:
    payload.tenant_id = user.tenant_id
    wh = create_warehouse_extended(db, payload)
    from app.services.warehouse_service import _to_list_read
    return _to_list_read(db, wh)


@router.get("/warehouses/summary", response_model=WarehouseSummaryRead)
def warehouse_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
) -> WarehouseSummaryRead:
    return get_warehouse_summary(db, tenant_id)


@router.get("/warehouses", response_model=list[WarehouseListRead])
def list_warehouses_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
) -> list[WarehouseListRead]:
    return list_warehouses_enriched(db, tenant_id)


@router.get("/warehouses/{warehouse_id}", response_model=WarehouseDetailRead)
def get_warehouse_endpoint(
    warehouse_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> WarehouseDetailRead:
    detail = get_warehouse_detail(db, tenant_id, warehouse_id)
    if not detail:
        raise HTTPException(404, "Warehouse not found")
    return detail


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseListRead)
def update_warehouse_endpoint(
    warehouse_id: int,
    payload: WarehouseUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> WarehouseListRead:
    wh = update_warehouse(db, tenant_id, warehouse_id, payload)
    if not wh:
        raise HTTPException(404, "Warehouse not found")
    enriched = list_warehouses_enriched(db, tenant_id)
    match = next((w for w in enriched if w.id == warehouse_id), None)
    if not match:
        raise HTTPException(404, "Warehouse not found")
    return match


@router.patch("/warehouses/{warehouse_id}/deactivate", response_model=WarehouseListRead)
def deactivate_warehouse_endpoint(
    warehouse_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> WarehouseListRead:
    wh = deactivate_warehouse(db, tenant_id, warehouse_id)
    if not wh:
        raise HTTPException(404, "Warehouse not found")
    enriched = list_warehouses_enriched(db, tenant_id)
    match = next((w for w in enriched if w.id == warehouse_id), None)
    if not match:
        raise HTTPException(404, "Warehouse not found")
    return match


@router.post("/suppliers", response_model=SupplierRead)
def create_supplier_endpoint(
    payload: SupplierCreate,
    user: User = Depends(require_any_permission("inventory", "procurement", "accounts")),
    db: Session = Depends(get_db),
) -> SupplierRead:
    payload.tenant_id = user.tenant_id
    return create_supplier(db, payload)


@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers_endpoint(
    tenant_id: int = Depends(tenant_scope_any("inventory", "procurement", "accounts")), db: Session = Depends(get_db)
) -> list[SupplierRead]:
    return list_suppliers(db, tenant_id)


@router.post("/items", response_model=InventoryItemRead)
def create_item_endpoint(
    payload: InventoryItemCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> InventoryItemRead:
    payload.tenant_id = user.tenant_id
    return create_inventory_item(db, payload)


@router.get("/items", response_model=list[InventoryItemRead])
def list_items_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    low_stock_only: bool = Query(False),
    item_type: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[InventoryItemRead]:
    return list_inventory_items(db, tenant_id, low_stock_only, item_type)


@router.get("/items/barcode/{barcode}")
def get_item_by_barcode_endpoint(
    barcode: str,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    item = get_item_by_barcode(db, tenant_id, barcode)
    if not item:
        raise HTTPException(404, "No item found for that barcode")
    total = get_total_stock(db, item.id)
    return {
        "found": True,
        "item": InventoryItemRead.model_validate(item),
        "total_stock": total,
        "needs_reorder": total < item.reorder_level if item.reorder_level else False,
    }


@router.get("/items/{item_id}", response_model=InventoryItemRead)
def get_item_endpoint(
    item_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> InventoryItemRead:
    item = get_inventory_item(db, tenant_id, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@router.put("/items/{item_id}", response_model=InventoryItemRead)
def update_item_endpoint(
    item_id: int,
    payload: InventoryItemUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> InventoryItemRead:
    item = update_inventory_item(
        db, tenant_id, item_id, payload.model_dump(exclude_unset=True)
    )
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@router.delete("/items/{item_id}")
def delete_item_endpoint(
    item_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    if not delete_inventory_item(db, tenant_id, item_id):
        raise HTTPException(404, "Item not found")
    return {"ok": True, "id": item_id}


@router.get("/dashboard")
def inventory_dashboard_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    item_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return get_inventory_dashboard(db, tenant_id, item_type)


@router.post("/stock-levels", response_model=StockLevelRead)
def create_stock_level_endpoint(
    payload: StockLevelCreate,
    _: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> StockLevelRead:
    return create_stock_level(db, payload)


@router.get("/stock-levels/warehouse/{warehouse_id}", response_model=list[StockLevelRead])
def list_stock_by_warehouse_endpoint(
    warehouse_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> list[StockLevelRead]:
    return list_stock_levels_by_warehouse(db, warehouse_id, tenant_id=user.tenant_id)


@router.get("/stock-levels/item/{item_id}", response_model=list[StockLevelRead])
def list_stock_by_item_endpoint(
    item_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> list[StockLevelRead]:
    return get_stock_by_item(db, item_id, tenant_id=user.tenant_id)


@router.put("/stock-levels")
def update_stock_endpoint(
    warehouse_id: int = Query(...),
    item_id: int = Query(...),
    quantity: int = Query(...),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    sl = update_stock_level(db, warehouse_id, item_id, quantity)
    if not sl:
        raise HTTPException(404, "Stock level not found for that warehouse/item")
    from app.services.alert_service import sync_low_stock_alerts

    sync_low_stock_alerts(db, user.tenant_id)
    return {"updated": True, "quantity": sl.quantity}


@router.get("/stock-movements", response_model=list[StockMovementRead])
def list_stock_movements_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    item_id: int | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[StockMovementRead]:
    from app.services.inventory_service import list_stock_movements

    return list_stock_movements(db, tenant_id, item_id, limit=limit, offset=offset)


@router.post("/stock-movements", response_model=StockMovementRead)
def record_movement_endpoint(
    payload: StockMovementCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> StockMovementRead:
    if hasattr(payload, "tenant_id"):
        payload.tenant_id = user.tenant_id
    movement = record_stock_movement(db, payload)
    from app.services.alert_service import sync_low_stock_alerts

    sync_low_stock_alerts(db, user.tenant_id)
    return movement


@router.get("/raw-materials/summary", response_model=InventorySummaryRead)
def raw_materials_summary(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_materials_summary(db, tenant_id)


@router.get("/raw-materials", response_model=list[MaterialListRead])
def raw_materials_list(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_materials_enriched(db, tenant_id)


@router.get("/raw-materials/{item_id}", response_model=MaterialDetailRead)
def raw_material_detail(
    item_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    detail = get_material_detail(db, tenant_id, item_id)
    if not detail:
        raise HTTPException(404, "Material not found")
    return detail


@router.get("/finished-goods/summary")
def finished_goods_summary(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_finished_goods_summary(db, tenant_id)


@router.get("/finished-goods", response_model=list[FinishedGoodListRead])
def finished_goods_list(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_finished_goods_enriched(db, tenant_id)


@router.get("/transfers", response_model=list[StockTransferRead])
def transfers_list(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_transfers(db, tenant_id)


@router.post("/transfers", response_model=StockTransferRead)
def create_transfer_endpoint(
    payload: StockTransferCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    t = create_transfer(db, tenant_id, payload)
    rows = list_transfers(db, tenant_id)
    match = next((r for r in rows if r.id == t.id), None)
    if not match:
        raise HTTPException(500, "Transfer created but could not be loaded")
    return match


@router.patch("/transfers/{transfer_id}/status", response_model=StockTransferRead)
def update_transfer_status_endpoint(
    transfer_id: int,
    payload: StockTransferStatusUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    t = update_transfer_status(db, tenant_id, transfer_id, payload.status, payload.approved_by)
    if not t:
        raise HTTPException(404, "Stock transfer not found")
    rows = list_transfers(db, tenant_id)
    match = next((r for r in rows if r.id == t.id), None)
    if not match:
        raise HTTPException(500, "Transfer updated but could not be loaded")
    return match



@router.get("/adjustments", response_model=list[StockAdjustmentRead])
def adjustments_list(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_adjustments(db, tenant_id)


@router.post("/adjustments", response_model=StockAdjustmentRead)
def create_adjustment_endpoint(
    payload: StockAdjustmentCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    a = create_adjustment(db, tenant_id, payload)
    rows = list_adjustments(db, tenant_id)
    match = next((r for r in rows if r.id == a.id), None)
    if not match:
        raise HTTPException(500, "Adjustment created but could not be loaded")
    return match


@router.patch("/adjustments/{adjustment_id}/status", response_model=StockAdjustmentRead)
def update_adjustment_status_endpoint(
    adjustment_id: int,
    payload: StockAdjustmentStatusUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    a = update_adjustment_status(db, tenant_id, adjustment_id, payload.status, payload.approved_by)
    if not a:
        raise HTTPException(404, "Stock adjustment not found")
    rows = list_adjustments(db, tenant_id)
    match = next((r for r in rows if r.id == a.id), None)
    if not match:
        raise HTTPException(500, "Adjustment updated but could not be loaded")
    return match


@router.get("/stock-returns", response_model=list[StockReturnSummaryRead])
def stock_returns_list(
    search: str | None = Query(None),
    status: str | None = Query(None),
    return_type: str | None = Query(None),
    department: str | None = Query(None),
    warehouse_id: int | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list_stock_returns(
        db,
        tenant_id,
        search=search,
        status=status,
        return_type=return_type,
        department=department,
        warehouse_id=warehouse_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/stock-returns/available-qty/{item_id}")
def stock_return_available_qty(
    item_id: int,
    warehouse_id: int = Query(..., ge=1),
    reference_id: int | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_item_available_for_return(
        db,
        tenant_id,
        item_id=item_id,
        warehouse_id=warehouse_id,
        reference_id=reference_id,
    )


@router.get("/stock-returns/{return_id}", response_model=StockReturnRead)
def stock_return_detail(
    return_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    row = get_stock_return(db, tenant_id, return_id)
    if not row:
        raise HTTPException(404, "Stock return not found")
    return row


@router.post("/stock-returns", response_model=StockReturnRead)
def create_stock_return_endpoint(
    payload: StockReturnCreate,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = create_stock_return_doc(db, user.tenant_id, payload, user, request=request)
    return result


@router.put("/stock-returns/{return_id}", response_model=StockReturnRead)
def update_stock_return_endpoint(
    return_id: int,
    payload: StockReturnUpdate,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    row = update_stock_return(db, user.tenant_id, return_id, payload, user, request=request)
    if not row:
        raise HTTPException(404, "Stock return not found")
    return row


@router.patch("/stock-returns/{return_id}/status", response_model=StockReturnRead)
def update_stock_return_status_endpoint(
    return_id: int,
    payload: StockReturnStatusUpdate,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    row = update_stock_return_status(
        db, user.tenant_id, return_id, payload, user, request=request
    )
    if not row:
        raise HTTPException(404, "Stock return not found")
    if row.status == "completed":
        from app.services.alert_service import sync_low_stock_alerts

        sync_low_stock_alerts(db, user.tenant_id)
    return row


@router.get("/stock-ins", response_model=list[StockInSummaryRead])
def stock_ins_list(
    search: str | None = Query(None),
    status: str | None = Query(None),
    reference_type: str | None = Query(None),
    warehouse_id: int | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list_stock_ins(
        db,
        tenant_id,
        search=search,
        status=status,
        reference_type=reference_type,
        warehouse_id=warehouse_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/stock-ins/{stock_in_id}", response_model=StockInRead)
def stock_in_detail(
    stock_in_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    row = get_stock_in(db, tenant_id, stock_in_id)
    if not row:
        raise HTTPException(404, "Stock in document not found")
    return row


@router.post("/stock-ins", response_model=StockInRead)
def create_stock_in_endpoint(
    payload: StockInCreate,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = create_stock_in_doc(db, user.tenant_id, payload, user, request=request)
    if result.status == "confirmed":
        from app.services.alert_service import sync_low_stock_alerts

        sync_low_stock_alerts(db, user.tenant_id)
    return result


@router.put("/stock-ins/{stock_in_id}", response_model=StockInRead)
def update_stock_in_endpoint(
    stock_in_id: int,
    payload: StockInUpdate,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    row = update_stock_in(db, user.tenant_id, stock_in_id, payload, user, request=request)
    if not row:
        raise HTTPException(404, "Stock in document not found")
    return row


@router.patch("/stock-ins/{stock_in_id}/status", response_model=StockInRead)
def update_stock_in_status_endpoint(
    stock_in_id: int,
    payload: StockInStatusUpdate,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    row = update_stock_in_status(
        db, user.tenant_id, stock_in_id, payload, user, request=request
    )
    if not row:
        raise HTTPException(404, "Stock in document not found")
    if row.status == "confirmed":
        from app.services.alert_service import sync_low_stock_alerts

        sync_low_stock_alerts(db, user.tenant_id)
    return row


@router.get("/ledger/summary", response_model=LedgerSummaryRead)
def ledger_summary(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_ledger_summary(db, tenant_id)


@router.get("/ledger", response_model=list[LedgerEntryRead])
def ledger_list(
    item_id: int | None = Query(None),
    limit: int | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list_ledger_entries(db, tenant_id, item_id=item_id, limit=limit)


@router.get("/hub", response_model=InventoryHubRead)
def inventory_hub(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_inventory_hub(db, tenant_id)


# ─── Manufacturing store workflow ───────────────────────────────────────────

from datetime import date as date_cls

from app.schemas.store_workflow import (
    PurchaseRequisitionCreated,
    PurchaseRequisitionFromLowStock,
    StoreConsumeCreate,
    StoreDashboardRead,
    StoreIssueRequestAction,
    StoreIssueRequestCreate,
    StoreIssueRequestRead,
    StoreReturnCreate,
    StoreReturnRead,
    StoreStockInCreate,
    StoreStockInRead,
)
from app.services import store_workflow_service as store_wf


def _user_label(user: User) -> str:
    return (
        getattr(user, "full_name", None)
        or getattr(user, "name", None)
        or getattr(user, "email", None)
        or "Store User"
    )


@router.get("/store/dashboard", response_model=StoreDashboardRead)
def store_dashboard(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return store_wf.get_store_dashboard(db, tenant_id)


@router.post("/store/stock-in", response_model=StoreStockInRead)
def store_stock_in(
    payload: StoreStockInCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = store_wf.create_stock_in(db, user.tenant_id, payload, _user_label(user))
    from app.services.alert_service import sync_low_stock_alerts

    sync_low_stock_alerts(db, user.tenant_id)
    return result


@router.get("/store/material-requests", response_model=list[StoreIssueRequestRead])
def store_list_material_requests(
    status: str | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.list_issue_requests(db, tenant_id, status)


@router.post("/store/material-requests", response_model=StoreIssueRequestRead)
def store_create_material_request(
    payload: StoreIssueRequestCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.create_issue_request(db, user.tenant_id, payload)


@router.post("/store/material-requests/{request_id}/approve", response_model=StoreIssueRequestRead)
def store_approve_material_request(
    request_id: int,
    payload: StoreIssueRequestAction | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.approve_issue_request(
        db, user.tenant_id, request_id, _user_label(user), payload.notes if payload else None
    )


@router.post("/store/material-requests/{request_id}/reject", response_model=StoreIssueRequestRead)
def store_reject_material_request(
    request_id: int,
    payload: StoreIssueRequestAction | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.reject_issue_request(
        db, user.tenant_id, request_id, _user_label(user), payload.notes if payload else None
    )


@router.post("/store/material-requests/{request_id}/issue", response_model=StoreIssueRequestRead)
def store_issue_material(
    request_id: int,
    payload: StoreIssueRequestAction | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = store_wf.issue_material(
        db,
        user.tenant_id,
        request_id,
        _user_label(user),
        payload.issued_qty if payload else None,
        payload.notes if payload else None,
    )
    from app.services.alert_service import sync_low_stock_alerts

    sync_low_stock_alerts(db, user.tenant_id)
    return result


@router.post("/store/material-requests/{request_id}/confirm", response_model=StoreIssueRequestRead)
def store_confirm_received(
    request_id: int,
    payload: StoreIssueRequestAction | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.confirm_received(
        db, user.tenant_id, request_id, _user_label(user)
    )


@router.post("/store/material-requests/{request_id}/consume", response_model=StoreIssueRequestRead)
def store_consume_material(
    request_id: int,
    payload: StoreConsumeCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = store_wf.record_consumption(
        db, user.tenant_id, request_id, payload, _user_label(user)
    )
    from app.services.alert_service import sync_low_stock_alerts

    sync_low_stock_alerts(db, user.tenant_id)
    return result


@router.post("/store/stock-return", response_model=StoreReturnRead)
def store_stock_return(
    payload: StoreReturnCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = store_wf.create_stock_return(db, user.tenant_id, payload, _user_label(user))
    from app.services.alert_service import sync_low_stock_alerts

    sync_low_stock_alerts(db, user.tenant_id)
    return result


@router.post("/store/purchase-requisitions/from-low-stock", response_model=PurchaseRequisitionCreated)
def store_pr_from_low_stock(
    payload: PurchaseRequisitionFromLowStock,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.create_pr_from_low_stock(db, user.tenant_id, payload, _user_label(user))


@router.get("/store/history")
def store_inventory_history(
    item_id: int | None = Query(None),
    warehouse_id: int | None = Query(None),
    movement_type: str | None = Query(None),
    user_name: str | None = Query(None),
    date_from: date_cls | None = Query(None),
    date_to: date_cls | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return store_wf.list_enriched_movements(
        db,
        tenant_id,
        item_id=item_id,
        warehouse_id=warehouse_id,
        movement_type=movement_type,
        user_name=user_name,
        date_from=date_from,
        date_to=date_to,
    )
