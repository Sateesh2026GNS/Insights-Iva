import { useCallback, useEffect, useState } from "react";

import { getSalesOrdersEnriched } from "../api/salesApi";
import { fetchCustomersWithFallback } from "../utils/customerOptions";
import { fetchProductsWithFallback } from "../utils/productOptions";
import { invalidateReferenceCache } from "../utils/referenceDataCache";
import { apiErrorMessage } from "../utils/apiError";

export default function useManualJobCardMasters() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [custList, prodList, soRes] = await Promise.all([
        fetchCustomersWithFallback(),
        fetchProductsWithFallback(),
        getSalesOrdersEnriched().catch(() => null),
      ]);
      setCustomers(Array.isArray(custList) ? custList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      const soBody = soRes?.data ?? soRes;
      const orders = Array.isArray(soBody?.items)
        ? soBody.items
        : Array.isArray(soBody)
          ? soBody
          : Array.isArray(soBody?.data)
            ? soBody.data
            : [];
      setSalesOrders(orders);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load master data."));
      setCustomers([]);
      setProducts([]);
      setSalesOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadCustomers = useCallback(async () => {
    invalidateReferenceCache("customers");
    const list = await fetchCustomersWithFallback({ force: true });
    setCustomers(Array.isArray(list) ? list : []);
    return list;
  }, []);

  const reloadProducts = useCallback(async () => {
    invalidateReferenceCache("products");
    const list = await fetchProductsWithFallback({ force: true });
    setProducts(Array.isArray(list) ? list : []);
    return list;
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    customers,
    products,
    salesOrders,
    loading,
    error,
    reloadCustomers,
    reloadProducts,
    reloadAll: loadAll,
  };
}
