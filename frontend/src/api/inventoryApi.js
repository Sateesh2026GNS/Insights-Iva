import api from "./axiosConfig";
import { getCachedReference } from "../utils/referenceDataCache";

export const getWarehouses = (options = {}) =>
  getCachedReference("warehouses", () => api.get("/inventory/warehouses"), {
    force: options.force === true,
  });
export const getWarehouseSummary = () => api.get("/inventory/warehouses/summary");
export const getWarehouseDetail = (warehouseId) => api.get(`/inventory/warehouses/${warehouseId}`);
export const createWarehouseFull = (payload) => api.post("/inventory/warehouses/full", payload);
export const updateWarehouse = (warehouseId, payload) => api.put(`/inventory/warehouses/${warehouseId}`, payload);
export const deactivateWarehouse = (warehouseId) => api.patch(`/inventory/warehouses/${warehouseId}/deactivate`);
export const createWarehouse = (payload) => api.post("/inventory/warehouses", payload);
export const getSuppliers = () => api.get("/inventory/suppliers");
export const createSupplier = (payload) => api.post("/inventory/suppliers", payload);
export const getInventoryItems = (_tenantId, lowStockOnly = false) =>
  api.get("/inventory/items", { params: { low_stock_only: lowStockOnly } });
export const getInventoryItem = (itemId) => api.get(`/inventory/items/${itemId}`);
export const createInventoryItem = (payload) => api.post("/inventory/items", payload);
export const updateInventoryItem = (itemId, payload) =>
  api.put(`/inventory/items/${itemId}`, payload);
export const deleteInventoryItem = (itemId) => api.delete(`/inventory/items/${itemId}`);
export const getItemByBarcode = (_tenantId, barcode) =>
  api.get(`/inventory/items/barcode/${encodeURIComponent(barcode)}`);
export const getInventoryDashboard = (itemType) =>
  api.get("/inventory/dashboard", { params: itemType ? { item_type: itemType } : undefined });
export const getStockByWarehouse = (warehouseId) => api.get(`/inventory/stock-levels/warehouse/${warehouseId}`);
export const getStockByItem = (itemId) => api.get(`/inventory/stock-levels/item/${itemId}`);
export const updateStock = (warehouseId, itemId, quantity) =>
  api.put("/inventory/stock-levels", null, { params: { warehouse_id: warehouseId, item_id: itemId, quantity } });
export const getStockMovements = (_tenantId, itemId) =>
  api.get("/inventory/stock-movements", { params: { item_id: itemId } });
export const recordStockMovement = (payload) => api.post("/inventory/stock-movements", payload);

export const getRawMaterialsSummary = () => api.get("/inventory/raw-materials/summary");
export const getRawMaterials = () => api.get("/inventory/raw-materials");
export const getRawMaterialDetail = (itemId) => api.get(`/inventory/raw-materials/${itemId}`);
export const getFinishedGoodsSummary = () => api.get("/inventory/finished-goods/summary");
export const getFinishedGoods = () => api.get("/inventory/finished-goods");
export const getStockTransfers = () => api.get("/inventory/transfers");
export const createStockTransfer = (payload) => api.post("/inventory/transfers", payload);
export const updateStockTransferStatus = (transferId, payload) =>
  api.patch(`/inventory/transfers/${transferId}/status`, payload);

export const getStockAdjustments = () => api.get("/inventory/adjustments");
export const createStockAdjustment = (payload) => api.post("/inventory/adjustments", payload);
export const updateStockAdjustmentStatus = (adjustmentId, payload) =>
  api.patch(`/inventory/adjustments/${adjustmentId}/status`, payload);

export const getLedgerSummary = () => api.get("/inventory/ledger/summary");
export const getStockLedger = () => api.get("/inventory/ledger");
export const getInventoryHub = () => api.get("/inventory/hub");

/* Manufacturing store workflow */
export const getStoreDashboard = () => api.get("/inventory/store/dashboard");
export const createStoreStockIn = (payload) => api.post("/inventory/store/stock-in", payload);
export const getStoreMaterialRequests = (status) =>
  api.get("/inventory/store/material-requests", { params: status ? { status } : undefined });
export const createStoreMaterialRequest = (payload) =>
  api.post("/inventory/store/material-requests", payload);
export const approveStoreMaterialRequest = (id, payload = {}) =>
  api.post(`/inventory/store/material-requests/${id}/approve`, payload);
export const rejectStoreMaterialRequest = (id, payload = {}) =>
  api.post(`/inventory/store/material-requests/${id}/reject`, payload);
export const issueStoreMaterial = (id, payload = {}) =>
  api.post(`/inventory/store/material-requests/${id}/issue`, payload);
export const confirmStoreMaterialReceived = (id, payload = {}) =>
  api.post(`/inventory/store/material-requests/${id}/confirm`, payload);
export const consumeStoreMaterial = (id, payload) =>
  api.post(`/inventory/store/material-requests/${id}/consume`, payload);
export const createStoreStockReturn = (payload) => api.post("/inventory/store/stock-return", payload);
export const createPrFromLowStock = (payload) =>
  api.post("/inventory/store/purchase-requisitions/from-low-stock", payload);
export const getStoreInventoryHistory = (params = {}) =>
  api.get("/inventory/store/history", { params });

export const getStockReturns = (params = {}) => api.get("/inventory/stock-returns", { params });
export const getStockReturn = (id) => api.get(`/inventory/stock-returns/${id}`);
export const getStockReturnAvailableQty = (itemId, params = {}) =>
  api.get(`/inventory/stock-returns/available-qty/${itemId}`, { params });
export const createStockReturn = (payload) => api.post("/inventory/stock-returns", payload);
export const updateStockReturn = (id, payload) => api.put(`/inventory/stock-returns/${id}`, payload);
export const updateStockReturnStatus = (id, payload) =>
  api.patch(`/inventory/stock-returns/${id}/status`, payload);

export const getStockIns = (params = {}) => api.get("/inventory/stock-ins", { params });
export const getStockIn = (id) => api.get(`/inventory/stock-ins/${id}`);
export const createStockIn = (payload) => api.post("/inventory/stock-ins", payload);
export const updateStockIn = (id, payload) => api.put(`/inventory/stock-ins/${id}`, payload);
export const updateStockInStatus = (id, payload) =>
  api.patch(`/inventory/stock-ins/${id}/status`, payload);
