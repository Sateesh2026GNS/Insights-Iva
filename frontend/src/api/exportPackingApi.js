import api from "./axiosConfig";

export const getExportPackingDashboard = (packingListId, { seedDemo = false } = {}) => {
  const params = { seed_demo: seedDemo };
  if (packingListId) params.packing_list_id = packingListId;
  return api.get("/export/packing-lists/dashboard", { params }).then((res) => res.data);
};

export const getDispatchOptionsForPacking = () =>
  api.get("/export/packing-lists/dispatch-options").then((res) => res.data);

export const createExportPackingList = (payload) =>
  api.post("/export/packing-lists", payload).then((res) => res.data);

export const createPackingListFromDispatch = (dispatchId) =>
  api.post(`/export/packing-lists/from-dispatch/${dispatchId}`).then((res) => res.data);

export const updateExportPackingList = (packingListId, payload) =>
  api.patch(`/export/packing-lists/${packingListId}`, payload).then((res) => res.data);

export const addExportPackingCarton = (packingListId, payload) =>
  api.post(`/export/packing-lists/${packingListId}/cartons`, payload).then((res) => res.data);

export const updateExportPackingCarton = (cartonId, payload) =>
  api.patch(`/export/packing-lists/cartons/${cartonId}`, payload).then((res) => res.data);

export const deleteExportPackingCarton = (cartonId) =>
  api.delete(`/export/packing-lists/cartons/${cartonId}`);

export const validateExportPackingList = (packingListId) =>
  api.post(`/export/packing-lists/${packingListId}/validate`).then((res) => res.data);
