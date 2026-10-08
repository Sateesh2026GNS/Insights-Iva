import api from "./axiosConfig";

function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return { ...res, data: body.data };
  }
  return res;
}

/** Inventory V2 — product items list */
export const listInventoryV2Items = async (params = {}) => {
  const query = {};
  if (typeof params === "string") {
    if (params) query.q = params;
  } else if (params && typeof params === "object") {
    if (params.q) query.q = params.q;
    if (params.category) query.category = params.category;
    if (params.categoryId != null && params.categoryId !== "") query.category_id = params.categoryId;
  }
  return unwrap(await api.get("/inventory/v2/items", { params: Object.keys(query).length ? query : undefined }));
};

export const getInventoryV2Item = async (id) =>
  unwrap(await api.get(`/inventory/v2/items/${id}`));

export const createInventoryV2Item = async (payload) =>
  unwrap(await api.post("/inventory/v2/items", payload));

export const updateInventoryV2Item = async (id, payload) =>
  unwrap(await api.put(`/inventory/v2/items/${id}`, payload));

export const deleteInventoryV2Item = async (id) =>
  unwrap(await api.delete(`/inventory/v2/items/${id}`));

export const getInventoryV2Timeline = async (id) =>
  unwrap(await api.get(`/inventory/v2/items/${id}/timeline`));

export const addInventoryV2Stock = async (id, payload) =>
  unwrap(await api.post(`/inventory/v2/items/${id}/add-stock`, payload));

export const removeInventoryV2Stock = async (id, payload) =>
  unwrap(await api.post(`/inventory/v2/items/${id}/remove-stock`, payload));

export const listInventoryV2Categories = async () =>
  unwrap(await api.get("/inventory/v2/categories"));

export const listInventoryV2CategorySummary = async () =>
  unwrap(await api.get("/inventory/v2/categories/summary"));

export const createInventoryV2Category = async (name) =>
  unwrap(await api.post("/inventory/v2/categories", { name }));

export const deleteInventoryV2Category = async (id) =>
  unwrap(await api.delete(`/inventory/v2/categories/${id}`));
