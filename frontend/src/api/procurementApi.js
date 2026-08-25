import api from "./axiosConfig";
import { getCachedReference } from "../utils/referenceDataCache";

export const getPurchaseOrders = () => api.get("/procurement/purchase-orders");
export const getPurchaseOrdersEnriched = () => api.get("/procurement/purchase-orders/enriched");
export const getPOSummary = () => api.get("/procurement/purchase-orders/summary");
export const getPurchaseOrder = (poId) => api.get(`/procurement/purchase-orders/${poId}`);
export const createPurchaseOrder = (payload) => api.post("/procurement/purchase-orders", payload);
export const updatePurchaseOrder = (poId, payload) =>
  api.put(`/procurement/purchase-orders/${poId}`, payload);
export const deletePurchaseOrder = (poId) => api.delete(`/procurement/purchase-orders/${poId}`);
export const updatePurchaseOrderStatus = (poId, status) =>
  api.patch(`/procurement/purchase-orders/${poId}/status`, null, { params: { status } });

export const getVendors = (params = {}) => {
  const filtered = params && Object.keys(params).length > 0;
  if (filtered) return api.get("/procurement/vendors", { params });
  return getCachedReference("vendors", () => api.get("/procurement/vendors"), {
    force: params.force === true,
  });
};
export const getVendorSummary = () => api.get("/procurement/vendors/summary");
export const getVendorDetail = (vendorId) => api.get(`/procurement/vendors/${vendorId}`);
export const getVendorPurchaseHistory = (vendorId) =>
  api.get(`/procurement/vendors/${vendorId}/purchase-history`);
export const getVendorProducts = (vendorId) =>
  api.get(`/procurement/vendors/${vendorId}/products`);
export const exportVendors = (params = {}) =>
  api.get("/procurement/vendors/export", { params });
export const lookupVendorBank = (ifsc, accountNumber) =>
  api.get("/procurement/vendors/bank-lookup", {
    params: { ifsc, account_number: accountNumber },
  });
export const createVendor = (payload) => api.post("/procurement/vendors", payload);
export const updateVendor = (vendorId, payload) =>
  api.put(`/procurement/vendors/${vendorId}`, payload);
export const deleteVendor = (vendorId) => api.delete(`/procurement/vendors/${vendorId}`);
export const bulkVendorStatus = (payload) =>
  api.post("/procurement/vendors/bulk-status", payload);
export const deactivateVendor = (vendorId) =>
  api.patch(`/procurement/vendors/${vendorId}/deactivate`);
export const updateVendorApproval = (vendorId, status) =>
  api.patch(`/procurement/vendors/${vendorId}/approval`, null, { params: { status } });

export const getMaterialRequests = () => api.get("/procurement/material-requests");
export const getMaterialRequest = (mrId) => api.get(`/procurement/material-requests/${mrId}`);
export const getMRSummary = () => api.get("/procurement/material-requests/summary");
export const getMREnriched = () => api.get("/procurement/material-requests/enriched");
export const createMaterialRequest = (payload) => api.post("/procurement/material-requests", payload);
export const updateMaterialRequest = (mrId, payload) =>
  api.put(`/procurement/material-requests/${mrId}`, payload);
export const deleteMaterialRequest = (mrId) =>
  api.delete(`/procurement/material-requests/${mrId}`);
export const convertMaterialRequestToPO = (mrId, payload) =>
  api.post(`/procurement/material-requests/${mrId}/convert-to-po`, payload);
export const approveMaterialRequest = (mrId, { approved = true, notes } = {}) =>
  api.post(`/procurement/material-requests/${mrId}/approve`, null, {
    params: { approved, notes },
  });


export const getRFQSummary = () => api.get("/procurement/rfq/summary");
export const getRFQList = () => api.get("/procurement/rfq");
export const getRFQComparison = (rfqId) => api.get(`/procurement/rfq/${rfqId}/comparison`);
export const createRFQ = (payload) => api.post("/procurement/rfq", payload);
export const addVendorQuotation = (rfqId, payload) => api.post(`/procurement/rfq/${rfqId}/quotation`, payload);
export const awardRFQ = (rfqId, payload) => api.patch(`/procurement/rfq/${rfqId}/award`, payload);
export const deleteRFQ = (rfqId) => api.delete(`/procurement/rfq/${rfqId}`);


export const getGoodsReceipts = () => api.get("/procurement/goods-receipt");
export const getGoodsReceipt = (grnId) => api.get(`/procurement/goods-receipt/${grnId}`);
export const getGRNSummary = () => api.get("/procurement/goods-receipt/summary");
export const getGRNEnriched = () => api.get("/procurement/goods-receipt/enriched");
export const createGoodsReceipt = (payload) => api.post("/procurement/goods-receipt", payload);
export const approveGoodsReceiptQC = (grnId, payload) =>
  api.post(`/procurement/goods-receipt/${grnId}/qc`, payload);
export const deleteGoodsReceipt = (grnId) => api.delete(`/procurement/goods-receipt/${grnId}`);

export const getVendorBills = () => api.get("/procurement/vendor-bills");
export const getVendorBillSummary = () => api.get("/procurement/vendor-bills/summary");
export const createVendorBill = (payload) => api.post("/procurement/vendor-bills", payload);
export const updateVendorBillStatus = (billId, status) =>
  api.patch(`/procurement/vendor-bills/${billId}/status`, { status });
export const deleteVendorBill = (billId) => api.delete(`/procurement/vendor-bills/${billId}`);


export const updateVendorBill = (billId, payload) => api.put(`/procurement/vendor-bills/${billId}`, payload);

export const getSupplierPayments = () => api.get("/procurement/supplier-payments");
export const getSupplierPayment = (paymentId) =>
  api.get(`/procurement/supplier-payments/${paymentId}`);
export const createSupplierPayment = (payload) => api.post("/procurement/supplier-payments", payload);
export const updateSupplierPayment = (paymentId, payload) =>
  api.put(`/procurement/supplier-payments/${paymentId}`, payload);
export const deleteSupplierPayment = (paymentId) =>
  api.delete(`/procurement/supplier-payments/${paymentId}`);

export const getProcurementHub = () => api.get("/procurement/hub");
